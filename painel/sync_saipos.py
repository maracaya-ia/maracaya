#!/usr/bin/env python3
"""
Coletor Saipos -> PostgreSQL (loja Quadra 8 / Sobradinho).
Puxa o historico de vendas da API de Dados do Saipos e insere no mesmo banco
das outras lojas, traduzindo os termos pro idioma unico do sistema.

Vars de ambiente: SAIPOS_TOKEN, SAIPOS_STORE_ID (81530), PGPASSWORD
Opcionais: SYNC_INTERVAL (padrao 900s), MESES (backfill), PGHOST/PGUSER/PGDATABASE

Limite da API: cada consulta cobre no maximo 15 dias -> o backfill quebra em janelas.
"""

import os
import sys
import time
from datetime import datetime, timedelta, timezone

import requests
import psycopg2
from psycopg2.extras import Json

TOKEN = os.environ.get("SAIPOS_TOKEN", "").replace("Bearer ", "").strip()
STORE_ID = os.environ.get("SAIPOS_STORE_ID", "81530")
INTERVALO = int(os.environ.get("SYNC_INTERVAL", "900"))
UNIDADE = "Sobradinho"
MARCA_PADRAO = "Maracayá Burger"   # Quadra 8 é só Maracayá por ora

PG = dict(
    host=os.environ.get("PGHOST", "postgres"),
    port=int(os.environ.get("PGPORT", "5432")),
    dbname=os.environ.get("PGDATABASE", "operacao"),
    user=os.environ.get("PGUSER", "alvaro"),
    password=os.environ.get("PGPASSWORD"),
)

BASE = "https://data.saipos.io/v1"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/json"}
MAX_JANELA_DIAS = 15          # limite da API
PAGE_LIMIT = 1000

if not TOKEN or not PG["password"]:
    sys.exit("ERRO: defina SAIPOS_TOKEN e PGPASSWORD.")


def log(msg):
    print(f"[{datetime.now():%d/%m %H:%M:%S}] saipos {UNIDADE} | {msg}", flush=True)


def api_get(path, params=None, tentativa=1):
    r = requests.get(f"{BASE}{path}", headers=HEADERS, params=params, timeout=90)
    # Saipos as vezes devolve timeout de pool (PGRST003) -> tenta de novo
    if r.status_code == 200:
        try:
            return r.json()
        except Exception:
            if "PGRST003" in r.text and tentativa <= 5:
                espera = 10 * tentativa
                log(f"timeout do Saipos (PGRST003), tentativa {tentativa}, aguardando {espera}s")
                time.sleep(espera)
                return api_get(path, params, tentativa + 1)
            log(f"resposta nao-JSON: {r.text[:120]}")
            return None
    if r.status_code == 401:
        sys.exit("ERRO 401: token Saipos invalido. Confira o SAIPOS_TOKEN.")
    if r.status_code == 429 and tentativa <= 5:
        time.sleep(15 * tentativa)
        return api_get(path, params, tentativa + 1)
    log(f"status {r.status_code}: {r.text[:120]}")
    return None


def conectar():
    return psycopg2.connect(**PG)


def obter_loja_id(cur):
    cur.execute("SELECT id FROM lojas WHERE codigo_loja = %s", (STORE_ID,))
    row = cur.fetchone()
    if not row:
        sys.exit(f"ERRO: loja Saipos {STORE_ID} nao encontrada. Rode multiunidade.sql antes.")
    return row[0]


def traducao(cur):
    cur.execute("SELECT campo, origem, destino FROM traducao_saipos")
    t = {}
    for campo, origem, destino in cur.fetchall():
        t.setdefault(campo, {})[origem] = destino
    return t


def buscar_vendas(inicio, fim, cur, loja_id, trad):
    """Busca vendas numa janela (max 15 dias) e insere. Retorna qtd inserida."""
    offset, inseridos = 0, 0
    while True:
        params = {
            "p_date_column_filter": "shift_date",
            "p_filter_date_start": inicio.strftime("%Y-%m-%dT00:00:00"),
            "p_filter_date_end": fim.strftime("%Y-%m-%dT23:59:59"),
            "p_limit": PAGE_LIMIT,
            "p_offset": offset,
        }
        vendas = api_get("/search_sales", params)
        if not vendas:
            break
        for v in vendas:
            if gravar_venda(cur, loja_id, trad, v):
                inseridos += 1
        if len(vendas) < PAGE_LIMIT:
            break
        offset += PAGE_LIMIT
        time.sleep(1)
    return inseridos


def gravar_venda(cur, loja_id, trad, v):
    order_id = str(v.get("id_sale"))
    if not order_id or order_id == "None":
        return False

    # log bruto (o "seguro")
    cur.execute(
        """INSERT INTO webhook_eventos (loja_id, tipo_evento, payload, processado)
           VALUES (%s, 'saipos', %s, true)""",
        (loja_id, Json(v)),
    )

    # traducoes
    status = trad.get("status", {}).get(v.get("canceled"), "closed")
    tipo = trad.get("tipo", {}).get(str(v.get("id_sale_type")), "delivery")
    canal_raw = (v.get("partner_sale") or {}).get("desc_partner_sale") or "Saipos"
    canal = trad.get("canal", {}).get(canal_raw, canal_raw.lower())

    total = v.get("total_amount") or 0
    soma_itens = v.get("total_amount_items") or 0
    desconto = v.get("total_discount") or 0
    taxa = (v.get("delivery") or {}).get("delivery_fee") or 0
    pagamentos = v.get("payments") or []
    forma_pgto = pagamentos[0].get("desc_store_payment_type") if pagamentos else None

    cliente_id = upsert_cliente(cur, loja_id, v.get("customer"),
                                v.get("created_at"), total)

    entrega = v.get("delivery") or {}
    bairro = entrega.get("district")

    cur.execute(
        """INSERT INTO pedidos (loja_id, order_id_cw, cliente_id, status, tipo, origem,
                subtotal, taxa_entrega, desconto, total, forma_pagamento,
                cupom, criado_em, concluido_em, motivo_cancelamento, marca, unidade, bairro)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
           ON CONFLICT (loja_id, order_id_cw) DO UPDATE
             SET status = EXCLUDED.status, total = EXCLUDED.total,
                 concluido_em = EXCLUDED.concluido_em
           RETURNING id""",
        (loja_id, order_id, cliente_id, status, tipo, canal,
         soma_itens, taxa, desconto, total, forma_pgto,
         (v.get("discount_coupon") or None),
         v.get("created_at"), v.get("updated_at"),
         (v.get("discount_reason") if status == "canceled" else None),
         MARCA_PADRAO, UNIDADE, bairro),
    )
    row = cur.fetchone()
    return row is not None


def upsert_cliente(cur, loja_id, customer, criado_em, total):
    if not customer or not customer.get("id_customer"):
        return None
    cid = str(customer["id_customer"])
    fones = customer.get("phone") or []
    fone = fones[0] if isinstance(fones, list) and fones else None
    cur.execute(
        """INSERT INTO clientes (loja_id, cliente_id_cw, nome, telefone,
               primeiro_pedido_em, ultimo_pedido_em, total_pedidos, total_gasto)
           VALUES (%s,%s,%s,%s,%s,%s,1,%s)
           ON CONFLICT (loja_id, cliente_id_cw) DO UPDATE SET
               nome = COALESCE(EXCLUDED.nome, clientes.nome),
               telefone = COALESCE(EXCLUDED.telefone, clientes.telefone),
               ultimo_pedido_em = GREATEST(clientes.ultimo_pedido_em, EXCLUDED.ultimo_pedido_em),
               total_pedidos = clientes.total_pedidos + 1,
               total_gasto = clientes.total_gasto + EXCLUDED.total_gasto
           RETURNING id""",
        (loja_id, cid, customer.get("name"), fone, criado_em, criado_em, total),
    )
    return cur.fetchone()[0]


def buscar_itens(inicio, fim, cur, loja_id):
    """Busca itens de venda numa janela e insere, ligando pelo id_sale."""
    offset = 0
    # mapa order_id_cw -> pedido.id (pra ligar item ao pedido ja inserido)
    cur.execute("SELECT order_id_cw, id FROM pedidos WHERE loja_id = %s", (loja_id,))
    mapa = {r[0]: r[1] for r in cur.fetchall()}
    inseridos = 0
    while True:
        params = {
            "p_date_column_filter": "shift_date",
            "p_filter_date_start": inicio.strftime("%Y-%m-%dT00:00:00"),
            "p_filter_date_end": fim.strftime("%Y-%m-%dT23:59:59"),
            "p_limit": PAGE_LIMIT,
            "p_offset": offset,
        }
        vendas = api_get("/sales_items", params)
        if not vendas:
            break
        for v in vendas:
            pedido_id = mapa.get(str(v.get("id_sale")))
            if not pedido_id:
                continue
            # evita duplicar itens se o backfill rodar de novo
            cur.execute("SELECT 1 FROM pedido_itens WHERE pedido_id = %s LIMIT 1", (pedido_id,))
            if cur.fetchone():
                continue
            for item in (v.get("items") or []):
                if item.get("deleted") == "S":
                    continue
                qtd = item.get("quantity") or 1
                preco = item.get("unit_price") or 0
                cur.execute(
                    """INSERT INTO pedido_itens (pedido_id, item_id_cw, nome, categoria,
                           quantidade, preco_unitario, total)
                       VALUES (%s,%s,%s,%s,%s,%s,%s)
                       RETURNING id""",
                    (pedido_id, str(item.get("id_sale_item")),
                     item.get("desc_sale_item"), None,
                     qtd, preco, qtd * preco),
                )
                item_row = cur.fetchone()
                inseridos += 1
                # complementos (choices)
                if item_row and _tem_tabela_complementos(cur):
                    for ch in (item.get("choices") or []):
                        if ch.get("deleted") == "S":
                            continue
                        cur.execute(
                            """INSERT INTO pedido_complementos (pedido_item_id, nome, quantidade, preco)
                               VALUES (%s,%s,1,%s)""",
                            (item_row[0], ch.get("desc_sale_item_choice"),
                             ch.get("aditional_price") or 0),
                        )
        if len(vendas) < PAGE_LIMIT:
            break
        offset += PAGE_LIMIT
        time.sleep(1)
    return inseridos


_TAB_COMPL = None
def _tem_tabela_complementos(cur):
    global _TAB_COMPL
    if _TAB_COMPL is None:
        cur.execute("""SELECT 1 FROM information_schema.tables
                       WHERE table_name='pedido_complementos'""")
        _TAB_COMPL = cur.fetchone() is not None
    return _TAB_COMPL


def janelas(meses):
    fim = datetime.now(timezone.utc)
    inicio_total = fim - timedelta(days=meses * 30)
    js, ini = [], inicio_total
    while ini < fim:
        fim_j = min(ini + timedelta(days=MAX_JANELA_DIAS), fim)
        js.append((ini, fim_j))
        ini = fim_j
    return js


def backfill(meses):
    conn = conectar(); conn.autocommit = False
    cur = conn.cursor()
    loja_id = obter_loja_id(cur)
    trad = traducao(cur)
    total = 0
    for (ini, fim) in janelas(meses):
        log(f"backfill vendas {ini:%d/%m} -> {fim:%d/%m}")
        n = buscar_vendas(ini, fim, cur, loja_id, trad)
        conn.commit()
        # itens: precisa dos pedidos ja inseridos (por isso vem depois)
        log(f"backfill itens {ini:%d/%m} -> {fim:%d/%m}")
        ni = buscar_itens(ini, fim, cur, loja_id)
        conn.commit()
        total += n
        log(f"  janela: {n} vendas, {ni} itens")
        time.sleep(2)
    log(f"backfill concluido: {total} vendas inseridas")
    cur.close(); conn.close()


def loop():
    log(f"coletor Saipos iniciado (intervalo {INTERVALO}s)")
    while True:
        try:
            conn = conectar(); conn.autocommit = False
            cur = conn.cursor()
            loja_id = obter_loja_id(cur)
            trad = traducao(cur)
            fim = datetime.now(timezone.utc)
            ini = fim - timedelta(days=2)   # janela curta no tempo real
            n = buscar_vendas(ini, fim, cur, loja_id, trad)
            conn.commit()
            ni = buscar_itens(ini, fim, cur, loja_id)
            conn.commit()
            log(f"{n} vendas, {ni} itens novos/atualizados")
            cur.close(); conn.close()
        except Exception as e:
            log(f"erro no ciclo: {e}")
        time.sleep(INTERVALO)


if __name__ == "__main__":
    if os.environ.get("MESES"):
        backfill(int(os.environ["MESES"]))
    else:
        loop()
