#!/usr/bin/env python3
"""
Sincronizador continuo Cardapio Web -> PostgreSQL.
Roda em loop: a cada SYNC_INTERVAL segundos consulta o polling da API
(pedidos modificados nas ultimas 8h), busca os detalhes e insere/atualiza
no banco. Pedidos novos entram; pedidos existentes tem status atualizado.

Vars de ambiente: CW_API_KEY, LOJA_CODIGO, PGPASSWORD
Opcionais: SYNC_INTERVAL (padrao 900s), PGHOST/PGUSER/PGDATABASE
"""

import os
import sys
import time
from datetime import datetime, timedelta, timezone

import requests
import psycopg2
from psycopg2.extras import Json

API_KEY = os.environ.get("CW_API_KEY")
LOJA_CODIGO = os.environ.get("LOJA_CODIGO")
INTERVALO = int(os.environ.get("SYNC_INTERVAL", "900"))

PG = dict(
    host=os.environ.get("PGHOST", "postgres"),
    port=int(os.environ.get("PGPORT", "5432")),
    dbname=os.environ.get("PGDATABASE", "operacao"),
    user=os.environ.get("PGUSER", "alvaro"),
    password=os.environ.get("PGPASSWORD"),
)

BASE = "https://integracao.cardapioweb.com/api/partner/v1"
HEADERS = {"X-API-KEY": API_KEY or "", "Accept": "application/json"}

if not API_KEY or not LOJA_CODIGO or not PG["password"]:
    sys.exit("ERRO: defina CW_API_KEY, LOJA_CODIGO e PGPASSWORD.")


def log(msg):
    print(f"[{datetime.now():%d/%m %H:%M:%S}] loja {LOJA_CODIGO} | {msg}", flush=True)


def api_get(path, params=None):
    r = requests.get(f"{BASE}{path}", headers=HEADERS, params=params, timeout=60)
    if r.status_code == 429:
        log("rate limit; aguardando 70s")
        time.sleep(70)
        return api_get(path, params)
    r.raise_for_status()
    return r.json()


def obter_loja_id(cur):
    cur.execute("SELECT id FROM lojas WHERE codigo_loja = %s", (LOJA_CODIGO,))
    row = cur.fetchone()
    if not row:
        sys.exit(f"ERRO: loja {LOJA_CODIGO} nao existe na tabela lojas.")
    return row[0]


def upsert_cliente_novo(cur, loja_id, customer, criado_em, total):
    if not customer or not customer.get("id"):
        return None
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
        (loja_id, str(customer["id"]), customer.get("name"), customer.get("phone"),
         criado_em, criado_em, total or 0),
    )
    return cur.fetchone()[0]


def inserir_itens(cur, pedido_id, itens):
    for item in itens or []:
        cur.execute(
            """
            INSERT INTO pedido_itens (pedido_id, item_id_cw, nome, categoria,
                                      quantidade, preco_unitario, total)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (pedido_id,
             str(item.get("item_id")) if item.get("item_id") is not None else None,
             item.get("name"), item.get("kind"), item.get("quantity"),
             item.get("unit_price"), item.get("total_price")),
        )
        item_row_id = cur.fetchone()[0]
        for opt in item.get("options") or []:
            cur.execute(
                "INSERT INTO pedido_complementos (pedido_item_id, nome, quantidade, preco) "
                "VALUES (%s, %s, %s, %s)",
                (item_row_id, opt.get("name"), opt.get("quantity"),
                 opt.get("unit_price", opt.get("total_price"))),
            )
        if item.get("items"):
            inserir_itens(cur, pedido_id, item["items"])


def salvar(cur, loja_id, o):
    """Insere pedido novo ou atualiza existente. Retorna 'novo'/'atualizado'."""
    order_id = str(o["id"])

    cur.execute(
        "INSERT INTO webhook_eventos (loja_id, tipo_evento, payload, processado) "
        "VALUES (%s, 'polling', %s, true)",
        (loja_id, Json(o)),
    )

    total = o.get("total") or 0
    descontos = sum((d.get("total") or 0) for d in (o.get("discounts") or []))
    soma_itens = sum((i.get("total_price") or 0) for i in (o.get("items") or []))
    pagamentos = o.get("payments") or []
    forma_pgto = pagamentos[0].get("payment_method") if pagamentos else None
    cupom = next((d.get("coupon_name") for d in (o.get("discounts") or [])
                  if d.get("coupon_name")), None)

    cur.execute(
        "SELECT id FROM pedidos WHERE loja_id = %s AND order_id_cw = %s",
        (loja_id, order_id),
    )
    existente = cur.fetchone()

    if existente:
        pedido_id = existente[0]
        cur.execute(
            """
            UPDATE pedidos SET status=%s, tipo=%s, origem=%s, subtotal=%s,
                   taxa_entrega=%s, desconto=%s, total=%s, forma_pagamento=%s,
                   cupom=%s, concluido_em=%s, motivo_cancelamento=%s
            WHERE id=%s
            """,
            (o.get("status"), o.get("order_type"), o.get("sales_channel"),
             soma_itens, o.get("delivery_fee") or 0, descontos, total,
             forma_pgto, cupom, o.get("updated_at"),
             o.get("cancellation_reason"), pedido_id),
        )
        # regrava itens pra refletir alteracoes
        cur.execute("DELETE FROM pedido_itens WHERE pedido_id = %s", (pedido_id,))
        inserir_itens(cur, pedido_id, o.get("items"))
        return "atualizado"

    cliente_id = upsert_cliente_novo(cur, loja_id, o.get("customer"),
                                     o.get("created_at"), total)
    cur.execute(
        """
        INSERT INTO pedidos (loja_id, order_id_cw, cliente_id, status, tipo, origem,
                             subtotal, taxa_entrega, desconto, total, forma_pagamento,
                             cupom, criado_em, concluido_em, motivo_cancelamento)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
        """,
        (loja_id, order_id, cliente_id, o.get("status"), o.get("order_type"),
         o.get("sales_channel"), soma_itens, o.get("delivery_fee") or 0,
         descontos, total, forma_pgto, cupom, o.get("created_at"),
         o.get("updated_at"), o.get("cancellation_reason")),
    )
    inserir_itens(cur, cur.fetchone()[0], o.get("items"))
    return "novo"


def ciclo(conn, loja_id, desde):
    cur = conn.cursor()
    params = {}
    if desde:
        params["updated_since"] = desde.isoformat()
    lites = api_get("/orders", params) or []
    novos = atualizados = 0
    for lite in lites:
        try:
            detalhe = api_get(f"/orders/{lite['id']}")
            resultado = salvar(cur, loja_id, detalhe)
            conn.commit()
            if resultado == "novo":
                novos += 1
            else:
                atualizados += 1
            time.sleep(0.75)
        except Exception as e:
            conn.rollback()
            log(f"erro no pedido {lite.get('id')}: {e}")
    cur.close()
    log(f"{len(lites)} modificados | {novos} novos | {atualizados} atualizados")


def main():
    log(f"sincronizador iniciado (intervalo {INTERVALO}s)")
    desde = None
    while True:
        inicio = datetime.now(timezone.utc)
        try:
            conn = psycopg2.connect(**PG)
            loja_id = obter_loja_id(conn.cursor())
            ciclo(conn, loja_id, desde)
            conn.close()
            # margem de 10 min pra nao perder nada entre ciclos
            desde = inicio - timedelta(minutes=10)
        except Exception as e:
            log(f"erro no ciclo: {e}")
        time.sleep(INTERVALO)


if __name__ == "__main__":
    main()
