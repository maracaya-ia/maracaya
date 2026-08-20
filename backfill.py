#!/usr/bin/env python3
"""
Backfill de pedidos da Cardápio Web -> PostgreSQL local.

Uso (na pasta do projeto):
  docker run --rm --network dashboard-maracaya_default \
    -v "$PWD":/app -w /app \
    -e CW_API_KEY="SEU_TOKEN_AQUI" \
    -e LOJA_CODIGO="46472" \
    -e PGPASSWORD="sua_senha_do_banco" \
    -e MESES="12" \
    python:3.12-slim bash -c "pip install -q requests psycopg2-binary && python backfill.py"

Pode rodar de novo quantas vezes quiser: pedidos ja importados sao pulados.
Respeita os rate limits da API (historico: 5 req/min | detalhes: 300 req/3min).
"""

import os
import sys
import time
import json
from datetime import datetime, timedelta, timezone

import requests
import psycopg2
from psycopg2.extras import Json

# ----------------------------------------------------------------------
# Configuracao
# ----------------------------------------------------------------------
API_KEY = os.environ.get("CW_API_KEY")
LOJA_CODIGO = os.environ.get("LOJA_CODIGO")
MESES = int(os.environ.get("MESES", "12"))

PG = dict(
    host=os.environ.get("PGHOST", "postgres"),
    port=int(os.environ.get("PGPORT", "5432")),
    dbname=os.environ.get("PGDATABASE", "operacao"),
    user=os.environ.get("PGUSER", "alvaro"),
    password=os.environ.get("PGPASSWORD"),
)

BASE = "https://integracao.cardapioweb.com/api/partner/v1"
HEADERS = {"X-API-KEY": API_KEY or "", "Accept": "application/json"}

HIST_SLEEP = 13      # 5 req/min no historico -> 1 a cada 13s (folga)
DETAIL_SLEEP = 0.75  # 300 req/3min -> ~1,5/s; usamos ~1,3/s (folga)

if not API_KEY or not LOJA_CODIGO or not PG["password"]:
    sys.exit("ERRO: defina CW_API_KEY, LOJA_CODIGO e PGPASSWORD nas variaveis de ambiente.")


# ----------------------------------------------------------------------
# HTTP com retry basico
# ----------------------------------------------------------------------
def api_get(path, params=None, tentativa=1):
    r = requests.get(f"{BASE}{path}", headers=HEADERS, params=params, timeout=60)
    if r.status_code == 429:
        espera = 65 * tentativa
        print(f"  rate limit (429). aguardando {espera}s...")
        time.sleep(espera)
        if tentativa <= 5:
            return api_get(path, params, tentativa + 1)
    if r.status_code == 401:
        sys.exit("ERRO 401: token invalido. Confira o CW_API_KEY.")
    r.raise_for_status()
    return r.json()


# ----------------------------------------------------------------------
# Banco
# ----------------------------------------------------------------------
def conectar():
    return psycopg2.connect(**PG)


def obter_loja_id(cur):
    cur.execute("SELECT id FROM lojas WHERE codigo_loja = %s", (LOJA_CODIGO,))
    row = cur.fetchone()
    if not row:
        sys.exit(f"ERRO: loja com codigo {LOJA_CODIGO} nao encontrada na tabela lojas.")
    return row[0]


def pedidos_existentes(cur, loja_id):
    cur.execute("SELECT order_id_cw FROM pedidos WHERE loja_id = %s", (loja_id,))
    return {r[0] for r in cur.fetchall()}


def upsert_cliente(cur, loja_id, customer, criado_em, total):
    if not customer or not customer.get("id"):
        return None
    cid = str(customer["id"])
    cur.execute(
        """
        INSERT INTO clientes (loja_id, cliente_id_cw, nome, telefone,
                              primeiro_pedido_em, ultimo_pedido_em, total_pedidos, total_gasto)
        VALUES (%s, %s, %s, %s, %s, %s, 1, %s)
        ON CONFLICT (loja_id, cliente_id_cw) DO UPDATE SET
            nome = COALESCE(EXCLUDED.nome, clientes.nome),
            telefone = COALESCE(EXCLUDED.telefone, clientes.telefone),
            primeiro_pedido_em = LEAST(clientes.primeiro_pedido_em, EXCLUDED.primeiro_pedido_em),
            ultimo_pedido_em = GREATEST(clientes.ultimo_pedido_em, EXCLUDED.ultimo_pedido_em),
            total_pedidos = clientes.total_pedidos + 1,
            total_gasto = clientes.total_gasto + EXCLUDED.total_gasto
        RETURNING id
        """,
        (loja_id, cid, customer.get("name"), customer.get("phone"),
         criado_em, criado_em, total or 0),
    )
    return cur.fetchone()[0]


def inserir_itens(cur, pedido_id, itens):
    """Insere itens (inclusive itens dentro de combos) e seus complementos."""
    for item in itens or []:
        cur.execute(
            """
            INSERT INTO pedido_itens (pedido_id, item_id_cw, nome, categoria,
                                      quantidade, preco_unitario, total)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (pedido_id,
             str(item.get("item_id")) if item.get("item_id") is not None else None,
             item.get("name"),
             item.get("kind"),          # regular_item | combo
             item.get("quantity"),
             item.get("unit_price"),
             item.get("total_price")),
        )
        item_row_id = cur.fetchone()[0]

        for opt in item.get("options") or []:
            preco = opt.get("unit_price", opt.get("total_price"))
            cur.execute(
                """
                INSERT INTO pedido_complementos (pedido_item_id, nome, quantidade, preco)
                VALUES (%s, %s, %s, %s)
                """,
                (item_row_id, opt.get("name"), opt.get("quantity"), preco),
            )

        # combos carregam sub-itens no campo "items"
        if item.get("items"):
            inserir_itens(cur, pedido_id, item["items"])


def salvar_pedido(cur, loja_id, o):
    """Grava um pedido detalhado. Retorna True se inseriu, False se ja existia."""
    order_id = str(o["id"])

    # log bruto (o "seguro")
    cur.execute(
        """
        INSERT INTO webhook_eventos (loja_id, tipo_evento, payload, processado)
        VALUES (%s, 'backfill', %s, true)
        """,
        (loja_id, Json(o)),
    )

    total = o.get("total") or 0
    descontos = sum((d.get("total") or 0) for d in (o.get("discounts") or []))
    soma_itens = sum((i.get("total_price") or 0) for i in (o.get("items") or []))
    pagamentos = o.get("payments") or []
    forma_pgto = pagamentos[0].get("payment_method") if pagamentos else None
    cupom = next((d.get("coupon_name") for d in (o.get("discounts") or [])
                  if d.get("coupon_name")), None)

    cliente_row_id = upsert_cliente(cur, loja_id, o.get("customer"),
                                    o.get("created_at"), total)

    cur.execute(
        """
        INSERT INTO pedidos (loja_id, order_id_cw, cliente_id, status, tipo, origem,
                             subtotal, taxa_entrega, desconto, total, forma_pagamento,
                             cupom, criado_em, concluido_em, motivo_cancelamento)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (loja_id, order_id_cw) DO NOTHING
        RETURNING id
        """,
        (loja_id, order_id, cliente_row_id,
         o.get("status"), o.get("order_type"), o.get("sales_channel"),
         soma_itens, o.get("delivery_fee") or 0, descontos, total,
         forma_pgto, cupom, o.get("created_at"), o.get("updated_at"),
         o.get("cancellation_reason")),
    )
    row = cur.fetchone()
    if row is None:
        return False

    inserir_itens(cur, row[0], o.get("items"))
    return True


# ----------------------------------------------------------------------
# Backfill
# ----------------------------------------------------------------------
def janelas(meses):
    """Divide o periodo em janelas de ate 5 meses (limite da API: 6)."""
    fim = datetime.now(timezone.utc)
    inicio_total = fim - timedelta(days=meses * 30)
    janelas_ = []
    ini = inicio_total
    while ini < fim:
        fim_janela = min(ini + timedelta(days=150), fim)
        janelas_.append((ini, fim_janela))
        ini = fim_janela
    return janelas_


def main():
    conn = conectar()
    conn.autocommit = False
    cur = conn.cursor()

    loja_id = obter_loja_id(cur)
    ja_temos = pedidos_existentes(cur, loja_id)
    print(f"Loja {LOJA_CODIGO} (id interno {loja_id}). "
          f"{len(ja_temos)} pedidos ja no banco.")

    ids_novos = []
    for ini, fim in janelas(MESES):
        pagina = 1
        while True:
            print(f"Historico {ini:%d/%m/%Y} -> {fim:%d/%m/%Y} | pagina {pagina}...")
            data = api_get("/orders/history", {
                "start_date": ini.isoformat(),
                "end_date": fim.isoformat(),
                "page": pagina,
                "per_page": 100,
            })
            for lite in data.get("orders", []):
                oid = str(lite["id"])
                if oid not in ja_temos:
                    ids_novos.append(oid)
            pag = data.get("pagination", {})
            if pagina >= (pag.get("total_pages") or 1):
                break
            pagina += 1
            time.sleep(HIST_SLEEP)
        time.sleep(HIST_SLEEP)

    total_novos = len(ids_novos)
    print(f"\n{total_novos} pedidos novos para importar.")
    if total_novos:
        estimativa = int(total_novos * DETAIL_SLEEP / 60) + 1
        print(f"Tempo estimado: ~{estimativa} min. Pode deixar rodando.\n")

    inseridos = 0
    for n, oid in enumerate(ids_novos, 1):
        try:
            detalhe = api_get(f"/orders/{oid}")
            if salvar_pedido(cur, loja_id, detalhe):
                inseridos += 1
            conn.commit()
        except Exception as e:
            conn.rollback()
            print(f"  ! erro no pedido {oid}: {e}")
        if n % 100 == 0:
            print(f"  {n}/{total_novos} processados ({inseridos} inseridos)")
        time.sleep(DETAIL_SLEEP)

    print(f"\nConcluido: {inseridos} pedidos importados para a loja {LOJA_CODIGO}.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
