#!/usr/bin/env python3
"""Painel Operacional — backend.
Serve a pagina e um endpoint /api/dados com os agregados da operacao.
"""

import os
import re
import unicodedata
from datetime import date, timedelta
from fastapi import FastAPI, Query, Body
from fastapi.responses import FileResponse
import psycopg2
import psycopg2.extras

PG = dict(
    host=os.environ.get("PGHOST", "postgres"),
    port=int(os.environ.get("PGPORT", "5432")),
    dbname=os.environ.get("PGDATABASE", "operacao"),
    user=os.environ.get("PGUSER", "alvaro"),
    password=os.environ.get("PGPASSWORD"),
)

TZ = "America/Sao_Paulo"
app = FastAPI(title="Painel Operacional")


def executar(sql, params):
    with psycopg2.connect(**PG) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
        conn.commit()


@app.get("/static/_tema.css")
def static_tema_css():
    return FileResponse(os.path.join(os.path.dirname(__file__), "_tema.css"),
                        media_type="text/css")


@app.get("/static/_tema.js")
def static_tema_js():
    return FileResponse(os.path.join(os.path.dirname(__file__), "_tema.js"),
                        media_type="application/javascript")


@app.get("/static/logo-clara.png")
def static_logo_clara():
    return FileResponse(os.path.join(os.path.dirname(__file__), "logo-clara.png"),
                        media_type="image/png")


@app.get("/static/logo-escura.png")
def static_logo_escura():
    return FileResponse(os.path.join(os.path.dirname(__file__), "logo-escura.png"),
                        media_type="image/png")


@app.get("/favicon.ico")
def static_favicon_ico():
    return FileResponse(os.path.join(os.path.dirname(__file__), "favicon.ico"),
                        media_type="image/x-icon")


@app.get("/static/favicon-32.png")
def static_favicon_32():
    return FileResponse(os.path.join(os.path.dirname(__file__), "favicon-32.png"),
                        media_type="image/png")


@app.get("/static/apple-touch-icon.png")
def static_apple_touch_icon():
    return FileResponse(os.path.join(os.path.dirname(__file__), "apple-touch-icon.png"),
                        media_type="image/png")


def consultar(sql, params):
    with psycopg2.connect(**PG) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return cur.fetchall()


@app.get("/")
def pagina():
    return FileResponse(os.path.join(os.path.dirname(__file__), "index.html"))


@app.get("/clientes")
def pagina_clientes():
    return FileResponse(os.path.join(os.path.dirname(__file__), "clientes.html"))


@app.get("/operacao")
def pagina_operacao():
    return FileResponse(os.path.join(os.path.dirname(__file__), "operacao.html"))


@app.get("/cardapio")
def pagina_cardapio():
    return FileResponse(os.path.join(os.path.dirname(__file__), "cardapio.html"))


@app.get("/bairros")
def pagina_bairros():
    return FileResponse(os.path.join(os.path.dirname(__file__), "bairros.html"))


@app.get("/dre")
def pagina_dre():
    return FileResponse(os.path.join(os.path.dirname(__file__), "dre.html"))


@app.get("/performance")
def pagina_performance():
    return FileResponse(os.path.join(os.path.dirname(__file__), "performance.html"))


@app.get("/compras")
def pagina_compras():
    return FileResponse(os.path.join(os.path.dirname(__file__), "compras.html"))


@app.get("/lancar-nota")
def pagina_lancar_nota():
    return FileResponse(os.path.join(os.path.dirname(__file__), "lancar-nota.html"))


@app.get("/api/dados")
def dados(dias: int = Query(30, ge=1, le=365),
          marca: str = Query("todas"),
          unidade: str = Query("todas"),
          inicio: str = Query(None),
          fim: str = Query(None),
          comp_inicio: str = Query(None),
          comp_fim: str = Query(None)):
    filtro_marca = ""
    params = {"dias": dias}
    if marca != "todas":
        filtro_marca = "AND p.marca = %(marca)s"
        params["marca"] = marca
    if unidade != "todas":
        filtro_marca += " AND p.unidade = %(unidade)s"
        params["unidade"] = unidade

    dia_local = f"(p.criado_em AT TIME ZONE '{TZ}')::date"
    if inicio and fim:
        cond_periodo = f"{dia_local} BETWEEN %(inicio)s AND %(fim)s"
        params["inicio"], params["fim"] = inicio, fim
    else:
        cond_periodo = (f"{dia_local} >= (now() AT TIME ZONE '{TZ}')::date"
                        " - (%(dias)s - 1)")

    base = f"""
        FROM pedidos p
        WHERE {cond_periodo}
        {filtro_marca}
    """
    fechados = base + " AND p.status <> 'canceled'"

    sql_kpis = """
        SELECT
            coalesce(sum(p.total) FILTER (WHERE p.status <> 'canceled'), 0) AS faturamento,
            count(*) FILTER (WHERE p.status <> 'canceled') AS pedidos,
            coalesce(avg(p.total) FILTER (WHERE p.status <> 'canceled'), 0) AS ticket,
            count(*) FILTER (WHERE p.status = 'canceled') AS cancelados,
            count(*) AS total_geral
    """
    kpis = consultar(sql_kpis + base, params)[0]

    comparacao = None
    if comp_inicio and comp_fim:
        params_c = dict(params)
        params_c["inicio"], params_c["fim"] = comp_inicio, comp_fim
        base_c = f"""
            FROM pedidos p
            WHERE {dia_local} BETWEEN %(inicio)s AND %(fim)s
            {filtro_marca}
        """
        comparacao = consultar(sql_kpis + base_c, params_c)[0]

    por_dia = consultar(f"""
        SELECT to_char(p.criado_em AT TIME ZONE '{TZ}', 'YYYY-MM-DD') AS dia,
               round(sum(p.total), 2) AS faturamento,
               count(*) AS pedidos
        {fechados}
        GROUP BY 1 ORDER BY 1
    """, params)

    por_hora = consultar(f"""
        SELECT extract(hour FROM p.criado_em AT TIME ZONE '{TZ}')::int AS hora,
               count(*) AS pedidos
        {fechados}
        GROUP BY 1 ORDER BY 1
    """, params)

    dia_semana = consultar(f"""
        SELECT extract(dow FROM p.criado_em AT TIME ZONE '{TZ}')::int AS dow,
               count(*) AS pedidos,
               round(sum(p.total), 2) AS faturamento
        {fechados}
        GROUP BY 1 ORDER BY 1
    """, params)

    top_produtos = consultar(f"""
        SELECT max(i.nome) AS nome, sum(i.quantidade)::int AS qtd,
               round(sum(i.total), 2) AS receita
        FROM pedido_itens i
        JOIN pedidos p ON p.id = i.pedido_id
        LEFT JOIN produto_alias a ON a.alias = lower(trim(i.nome))
        WHERE {cond_periodo}
          AND p.status <> 'canceled'
          AND coalesce(i.categoria, '') <> 'combo'
          {filtro_marca}
        GROUP BY coalesce(a.canonico, lower(trim(i.nome))) ORDER BY qtd DESC LIMIT 10
    """, params)

    pagamentos = consultar(f"""
        SELECT coalesce(p.forma_pagamento, 'não informado') AS forma,
               count(*) AS pedidos
        {fechados}
        GROUP BY 1 ORDER BY 2 DESC
    """, params)

    tipos = consultar(f"""
        SELECT p.tipo, count(*) AS pedidos
        {fechados}
        GROUP BY 1 ORDER BY 2 DESC
    """, params)

    canais = consultar(f"""
        SELECT coalesce(p.origem, 'não informado') AS origem,
               count(*) AS pedidos,
               round(sum(p.total), 2) AS bruto,
               round(100 * sum(COMISSAO) / nullif(sum(p.total), 0), 2) AS comissao_pct,
               round(sum(COMISSAO), 2) AS pedagio,
               round(sum(p.total) - sum(COMISSAO), 2) AS liquido
        {fechados}
        GROUP BY 1
        ORDER BY 3 DESC
    """.replace("COMISSAO", _SQL_COMISSAO), params)

    marcas = consultar(
        "SELECT DISTINCT marca FROM pedidos WHERE marca IS NOT NULL ORDER BY 1", {})

    return {
        "kpis": kpis,
        "canais": canais,
        "comparacao": comparacao,
        "por_dia": por_dia,
        "por_hora": por_hora,
        "dia_semana": dia_semana,
        "top_produtos": top_produtos,
        "pagamentos": pagamentos,
        "tipos": tipos,
        "marcas": marcas,
    }


@app.get("/api/resumo_geral")
def resumo_geral(marca: str = Query("todas"), unidade: str = Query("todas")):
    """Resumo com a media dos principais indicadores de cada aba do painel
    (Clientes, Operacao, Cardapio, Bairros, DRE), janela fixa de 90 dias
    pra ficar estavel independente do filtro de periodo da Visao geral."""
    filtro_marca = ""
    params = {}
    if marca != "todas":
        filtro_marca = "AND p.marca = %(marca)s"
        params["marca"] = marca
    if unidade != "todas":
        filtro_marca += " AND p.unidade = %(unidade)s"
        params["unidade"] = unidade

    operacao = consultar(f"""
        SELECT round(avg(p.total), 2) AS ticket_medio,
               round(count(*)::numeric
                     / nullif(count(DISTINCT (p.criado_em AT TIME ZONE '{TZ}')::date), 0), 1)
                     AS pedidos_dia_medio
        FROM pedidos p
        WHERE p.status <> 'canceled'
          AND p.criado_em >= now() - interval '90 days'
          {filtro_marca}
    """, params)[0]

    clientes = consultar(f"""
        WITH agg AS (
            SELECT p.cliente_id,
                   count(*) FILTER (WHERE p.status <> 'canceled') AS pedidos,
                   coalesce(sum(p.total) FILTER (WHERE p.status <> 'canceled'), 0) AS gasto
            FROM pedidos p
            WHERE p.cliente_id IS NOT NULL {filtro_marca}
            GROUP BY p.cliente_id
            HAVING count(*) FILTER (WHERE p.status <> 'canceled') > 0
        )
        SELECT count(*) AS total,
               count(*) FILTER (WHERE pedidos >= 2) AS recorrentes,
               coalesce(round(avg(gasto), 2), 0) AS gasto_medio
        FROM agg
    """, params)[0]

    top_produto = consultar(f"""
        SELECT max(i.nome) AS nome, sum(i.quantidade)::int AS qtd
        FROM pedido_itens i
        JOIN pedidos p ON p.id = i.pedido_id
        LEFT JOIN produto_alias a ON a.alias = lower(trim(i.nome))
        WHERE p.status <> 'canceled'
          AND p.criado_em >= now() - interval '90 days'
          AND NOT EXISTS (
              SELECT 1 FROM produto_excluido e
              WHERE e.nome = coalesce(a.canonico, lower(trim(i.nome)))
          )
          {filtro_marca}
        GROUP BY coalesce(a.canonico, lower(trim(i.nome)))
        ORDER BY qtd DESC LIMIT 1
    """, params)
    top_produto = top_produto[0] if top_produto else None

    cmv = consultar(f"""
        SELECT coalesce(sum(i.total) FILTER (WHERE c.custo IS NOT NULL), 0) AS receita_mapeada,
               coalesce(sum(i.quantidade * c.custo), 0) AS cmv_mapeado,
               coalesce(sum(i.total), 0) AS receita_itens
        FROM pedido_itens i
        JOIN pedidos p ON p.id = i.pedido_id
        LEFT JOIN produto_alias a ON a.alias = lower(trim(i.nome))
        LEFT JOIN produto_custos c ON c.nome = coalesce(a.canonico, lower(trim(i.nome)))
        WHERE p.status <> 'canceled'
          AND p.criado_em >= now() - interval '90 days'
          {filtro_marca}
    """, params)[0]
    rec_map, rec_itens = float(cmv["receita_mapeada"]), float(cmv["receita_itens"])
    cmv_map = float(cmv["cmv_mapeado"])
    cobertura_cmv = (100 * rec_map / rec_itens) if rec_itens > 0 else 0
    # extrapola o CMV da fatia sem custo cadastrado pelo % medio da fatia mapeada
    cmv_total = cmv_map + ((rec_itens - rec_map) * (cmv_map / rec_map) if rec_map > 0 else 0)

    # so conta pedidos com condominio/quadra (regiao) de verdade cadastrado -
    # nao cai pro bairro genérico, senão "sem regiao" vira um falso campeao
    total_delivery = consultar(f"""
        SELECT count(*) AS n FROM pedidos p
        WHERE p.status <> 'canceled' AND p.tipo = 'delivery'
          AND p.criado_em >= now() - interval '90 days' {filtro_marca}
    """, params)[0]["n"]
    bairro_top = consultar(f"""
        SELECT nullif(trim(p.regiao), '') AS regiao, count(*) AS pedidos
        FROM pedidos p
        WHERE p.status <> 'canceled' AND p.tipo = 'delivery'
          AND p.criado_em >= now() - interval '90 days'
          AND nullif(trim(p.regiao), '') IS NOT NULL
          {filtro_marca}
        GROUP BY 1 ORDER BY 2 DESC LIMIT 1
    """, params)
    bairro_top = bairro_top[0] if bairro_top else None
    if bairro_top:
        bairro_top = {"bairro": bairro_top["regiao"],
                      "pct": round(100 * bairro_top["pedidos"] / total_delivery, 1)
                             if total_delivery > 0 else 0}

    vendas = consultar(f"""
        SELECT coalesce(sum(p.total), 0) AS receita
        FROM pedidos p
        WHERE p.status <> 'canceled' AND p.criado_em >= now() - interval '90 days' {filtro_marca}
    """, params)[0]
    pedagio = consultar(f"""
        SELECT coalesce(sum({_SQL_COMISSAO}), 0) AS pedagio
        FROM pedidos p
        WHERE p.status <> 'canceled' AND p.criado_em >= now() - interval '90 days' {filtro_marca}
    """, params)[0]
    cfg_rows = consultar("SELECT chave, valor FROM dre_config", {})
    cfg = {r["chave"]: float(r["valor"]) for r in cfg_rows}
    entregas_q = consultar(f"""
        SELECT count(*) FILTER (WHERE p.tipo = 'delivery') AS entregas
        FROM pedidos p
        WHERE p.status <> 'canceled' AND p.criado_em >= now() - interval '90 days' {filtro_marca}
    """, params)[0]

    receita = float(vendas["receita"])
    imposto = receita * cfg.get("imposto_pct", 0) / 100
    entrega = float(entregas_q["entregas"]) * cfg.get("custo_entrega", 0)
    lucro = receita - float(pedagio["pedagio"]) - imposto - cmv_total - entrega
    margem = (100 * lucro / receita) if receita > 0 else 0

    return {
        "operacao": {"ticket_medio": float(operacao["ticket_medio"] or 0),
                     "pedidos_dia_medio": float(operacao["pedidos_dia_medio"] or 0)},
        "clientes": {"total": int(clientes["total"]),
                     "pct_recorrentes": round(100 * clientes["recorrentes"] / clientes["total"], 1)
                                        if clientes["total"] > 0 else 0,
                     "gasto_medio": float(clientes["gasto_medio"])},
        "cardapio": {"top_produto": top_produto["nome"] if top_produto else None,
                     "top_produto_qtd": int(top_produto["qtd"]) if top_produto else 0,
                     "cobertura_cmv": round(cobertura_cmv, 0)},
        "bairros": {"nome": bairro_top["bairro"] if bairro_top else None,
                    "pct": float(bairro_top["pct"]) if bairro_top else 0},
        "dre": {"margem_pct": round(margem, 1)},
    }


# Mapa classico de 25 celulas (Recencia, Frequencia+Ticket combinados) -> 11
# segmentos RFM, usado tanto na Matriz RFV quanto na lista completa de clientes.
_SEGMENTO_RF = {
    (1,5):'Não posso perder', (1,4):'Não posso perder',
    (2,5):'Em risco', (3,5):'Em risco', (2,4):'Em risco', (3,4):'Em risco',
    (4,5):'Fieis', (4,4):'Fieis',
    (5,5):'Campeões', (5,4):'Campeões',
    (1,3):'Perdidos', (1,2):'Perdidos', (1,1):'Perdidos',
    (2,3):'Precisam de atenção', (3,3):'Precisam de atenção',
    (2,2):'Hibernando', (2,1):'Hibernando',
    (3,2):'Quase dormentes', (3,1):'Quase dormentes',
    (4,3):'Em potenciais', (5,3):'Em potenciais', (4,2):'Em potenciais', (5,2):'Em potenciais',
    (4,1):'Promissores',
    (5,1):'Novos',
}


@app.get("/api/clientes")
def analise_clientes(marca: str = Query("todas"),
                     unidade: str = Query("todas"),
                     sumido_apos: int = Query(30, ge=7, le=180),
                     canal: str = Query("todos"),
                     so_com_telefone: int = Query(0, ge=0, le=1)):
    filtros = ""
    params = {"sumido": sumido_apos}
    if marca != "todas":
        filtros += " AND p.marca = %(marca)s"
        params["marca"] = marca
    if unidade != "todas":
        filtros += " AND p.unidade = %(unidade)s"
        params["unidade"] = unidade
    if canal != "todos":
        filtros += " AND p.origem = %(canal)s"
        params["canal"] = canal

    filtro_tel = ""
    if so_com_telefone:
        filtro_tel = " AND c.telefone IS NOT NULL AND length(c.telefone) > 4"

    agg = f"""
        WITH agg AS (
            SELECT p.cliente_id,
                   count(*) FILTER (WHERE p.status <> 'canceled') AS pedidos,
                   coalesce(sum(p.total) FILTER (WHERE p.status <> 'canceled'), 0) AS gasto,
                   min(p.criado_em) AS primeiro,
                   max(p.criado_em) FILTER (WHERE p.status <> 'canceled') AS ultimo,
                   (array_agg(p.unidade ORDER BY p.criado_em DESC)
                       FILTER (WHERE p.status <> 'canceled'))[1] AS unidade
            FROM pedidos p
            WHERE p.cliente_id IS NOT NULL {filtros}
            GROUP BY p.cliente_id
            HAVING count(*) FILTER (WHERE p.status <> 'canceled') > 0
        )
    """

    kpis = consultar(agg + """
        SELECT count(*) AS total,
               count(*) FILTER (WHERE pedidos >= 2) AS recorrentes,
               count(*) FILTER (WHERE primeiro >= now() - interval '30 days') AS novos_30d,
               coalesce(round(avg(gasto), 2), 0) AS gasto_medio
        FROM agg
    """, params)[0]

    # Matriz RFV: Recencia (quinto mais recente = melhor), Frequencia e Ticket
    # medio (cada um em quintil, combinados na media = eixo Y do grafico). Mapa
    # de 25 celulas -> 11 segmentos classicos de RFM, com os mesmos nomes em
    # PT-BR do material de referencia do usuario.
    rfv_scores = consultar(agg + f"""
        SELECT a.cliente_id, c.nome, c.telefone, a.pedidos, round(a.gasto, 2) AS gasto,
               extract(day FROM now() - a.ultimo)::int AS dias, a.unidade,
               ntile(5) OVER (ORDER BY a.ultimo ASC) AS r,
               ntile(5) OVER (ORDER BY a.pedidos ASC) AS f,
               ntile(5) OVER (ORDER BY (a.gasto / a.pedidos) ASC) AS m
        FROM agg a JOIN clientes c ON c.id = a.cliente_id
        WHERE 1=1 {filtro_tel}
    """, params)
    rfv_contagem = {}
    rfv_por_segmento = {}
    rfv_por_unidade = {}
    for row in rfv_scores:
        fm = round((row["f"] + row["m"]) / 2) or 1
        seg = _SEGMENTO_RF.get((row["r"], fm), 'Perdidos')
        rfv_contagem[seg] = rfv_contagem.get(seg, 0) + 1
        rfv_por_segmento.setdefault(seg, []).append(row)
        un = row["unidade"] or "—"
        rfv_por_unidade.setdefault(seg, {})
        rfv_por_unidade[seg][un] = rfv_por_unidade[seg].get(un, 0) + 1
    total_rfv = len(rfv_scores) or 1
    rfv = [{"segmento": nome, "clientes": rfv_contagem.get(nome, 0),
            "pct": round(100 * rfv_contagem.get(nome, 0) / total_rfv, 2),
            "por_unidade": rfv_por_unidade.get(nome, {})}
           for nome in ('Não posso perder', 'Em risco', 'Fieis', 'Campeões',
                        'Perdidos', 'Hibernando', 'Quase dormentes',
                        'Precisam de atenção', 'Em potenciais', 'Promissores', 'Novos')]
    rfv_clientes = {
        seg: [{"nome": r["nome"], "telefone": r["telefone"], "pedidos": r["pedidos"],
               "gasto": float(r["gasto"]), "dias": r["dias"]}
              for r in sorted(linhas, key=lambda x: -float(x["gasto"]))[:30]]
        for seg, linhas in rfv_por_segmento.items()
    }

    frequencia = consultar(agg + """
        SELECT CASE
                 WHEN pedidos = 1 THEN '1 pedido'
                 WHEN pedidos BETWEEN 2 AND 3 THEN '2 a 3'
                 WHEN pedidos BETWEEN 4 AND 6 THEN '4 a 6'
                 ELSE '7 ou mais'
               END AS faixa,
               min(pedidos) AS ordem,
               count(*) AS clientes
        FROM agg GROUP BY 1 ORDER BY ordem
    """, params)

    recencia = consultar(agg + """
        SELECT CASE
                 WHEN ultimo >= now() - interval '30 days' THEN 'Últimos 30 dias'
                 WHEN ultimo >= now() - interval '60 days' THEN '30 a 60 dias'
                 WHEN ultimo >= now() - interval '90 days' THEN '60 a 90 dias'
                 WHEN ultimo >= now() - interval '180 days' THEN '90 a 180 dias'
                 ELSE 'Mais de 180 dias'
               END AS faixa,
               min(now() - ultimo) AS ordem,
               count(*) AS clientes
        FROM agg GROUP BY 1 ORDER BY ordem
    """, params)

    # "Nunca compraram": cadastro existe (pedido chegou a ser feito) mas todos
    # os pedidos foram cancelados - nao entra no "agg" (que exige 1+ pedido
    # valido), por isso e uma consulta a parte. Bem menor que num SaaS generico
    # (aqui so existe cliente por ter feito um pedido, nao por cadastro solto).
    nunca_compraram = consultar(f"""
        SELECT count(*) AS clientes FROM (
            SELECT p.cliente_id FROM pedidos p
            WHERE p.cliente_id IS NOT NULL {filtros}
            GROUP BY p.cliente_id
            HAVING count(*) FILTER (WHERE p.status <> 'canceled') = 0
        ) t
    """, params)[0]

    novos_semana = consultar(agg + """
        SELECT to_char(date_trunc('week', primeiro AT TIME ZONE 'America/Sao_Paulo'),
                       'DD/MM') AS semana,
               date_trunc('week', primeiro AT TIME ZONE 'America/Sao_Paulo') AS ord,
               count(*) AS clientes
        FROM agg GROUP BY 2, 1 ORDER BY ord
    """, params)

    ciclos = consultar(f"""
        WITH seq AS (
            SELECT p.cliente_id,
                   row_number() OVER (PARTITION BY p.cliente_id ORDER BY p.criado_em) AS n,
                   extract(epoch FROM p.criado_em
                       - lag(p.criado_em) OVER (PARTITION BY p.cliente_id
                                                ORDER BY p.criado_em)) / 86400 AS dias
            FROM pedidos p
            WHERE p.cliente_id IS NOT NULL AND p.status <> 'canceled' {filtros}
        )
        SELECT (n - 1) || 'º → ' || n || 'º' AS ciclo, n,
               round(avg(dias)::numeric, 1) AS media_dias,
               count(*) AS clientes
        FROM seq WHERE dias IS NOT NULL AND n <= 8
        GROUP BY n ORDER BY n
    """, params)

    media_geral = consultar(f"""
        WITH seq AS (
            SELECT extract(epoch FROM p.criado_em
                       - lag(p.criado_em) OVER (PARTITION BY p.cliente_id
                                                ORDER BY p.criado_em)) / 86400 AS dias
            FROM pedidos p
            WHERE p.cliente_id IS NOT NULL AND p.status <> 'canceled' {filtros}
        )
        SELECT coalesce(round(avg(dias)::numeric, 1), 0) AS media FROM seq
        WHERE dias IS NOT NULL
    """, params)[0]

    top = consultar(agg + f"""
        SELECT c.nome, c.telefone, a.pedidos, round(a.gasto, 2) AS gasto,
               to_char(a.ultimo AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS ultimo_pedido
        FROM agg a JOIN clientes c ON c.id = a.cliente_id
        WHERE 1=1 {filtro_tel}
        ORDER BY a.gasto DESC LIMIT 15
    """, params)

    sumidos = consultar(agg + f"""
        SELECT c.nome, c.telefone, a.pedidos, round(a.gasto, 2) AS gasto,
               extract(day FROM now() - a.ultimo)::int AS dias_sem_pedido
        FROM agg a JOIN clientes c ON c.id = a.cliente_id
        WHERE a.pedidos >= 2
          AND a.ultimo < now() - (%(sumido)s || ' days')::interval
          {filtro_tel}
        ORDER BY a.gasto DESC LIMIT 30
    """, params)

    em_risco = consultar(agg + f"""
        , intervalos AS (
            SELECT p.cliente_id,
                   extract(epoch FROM p.criado_em
                       - lag(p.criado_em) OVER (PARTITION BY p.cliente_id
                                                ORDER BY p.criado_em)) / 86400 AS dias
            FROM pedidos p
            WHERE p.cliente_id IS NOT NULL AND p.status <> 'canceled' {filtros}
        ),
        media_cliente AS (
            SELECT cliente_id, avg(dias) AS intervalo_medio
            FROM intervalos WHERE dias IS NOT NULL
            GROUP BY cliente_id
            HAVING count(*) >= 2 AND avg(dias) >= 1
        )
        SELECT c.nome, c.telefone, a.pedidos, round(a.gasto, 2) AS gasto,
               extract(day FROM now() - a.ultimo)::int AS dias_sem_pedido,
               round(mc.intervalo_medio::numeric, 1) AS intervalo_medio
        FROM agg a
        JOIN clientes c ON c.id = a.cliente_id
        JOIN media_cliente mc ON mc.cliente_id = a.cliente_id
        WHERE extract(day FROM now() - a.ultimo) >= mc.intervalo_medio * 2
          AND a.ultimo >= now() - (%(sumido)s || ' days')::interval
          {filtro_tel}
        ORDER BY (extract(day FROM now() - a.ultimo) / mc.intervalo_medio) DESC
        LIMIT 30
    """, params)

    resgate = consultar(agg + """
        SELECT count(*) AS clientes,
               coalesce(round(sum(gasto), 2), 0) AS gasto
        FROM agg
        WHERE pedidos >= 2
          AND ultimo < now() - (%(sumido)s || ' days')::interval
    """, params)[0]

    canais = consultar(
        "SELECT DISTINCT origem FROM pedidos WHERE origem IS NOT NULL ORDER BY 1", {})
    marcas = consultar(
        "SELECT DISTINCT marca FROM pedidos WHERE marca IS NOT NULL ORDER BY 1", {})

    return {"kpis": kpis, "frequencia": frequencia, "recencia": recencia,
            "nunca_compraram": nunca_compraram["clientes"],
            "novos_semana": novos_semana, "ciclos": ciclos,
            "media_entre_pedidos": media_geral["media"],
            "top": top, "sumidos": sumidos, "em_risco": em_risco,
            "resgate": resgate,
            "rfv": rfv, "rfv_clientes": rfv_clientes,
            "canais": canais, "marcas": marcas}


@app.get("/api/clientes/lista")
def lista_clientes(marca: str = Query("todas"), unidade: str = Query("todas"),
                   canal: str = Query("todos"), so_com_telefone: int = Query(0, ge=0, le=1),
                   busca: str = Query(""), pagina: int = Query(1, ge=1),
                   por_pagina: int = Query(10, ge=5, le=100),
                   ordenar_por: str = Query("pedidos"), direcao: str = Query("desc")):
    """Lista completa (paginada) de clientes com a classificacao RFV, pra
    conferir/buscar qualquer cliente individualmente - complementa a Matriz RFV,
    que so mostra os agregados por segmento."""
    filtros = ""
    params = {}
    if marca != "todas":
        filtros += " AND p.marca = %(marca)s"
        params["marca"] = marca
    if unidade != "todas":
        filtros += " AND p.unidade = %(unidade)s"
        params["unidade"] = unidade
    if canal != "todos":
        filtros += " AND p.origem = %(canal)s"
        params["canal"] = canal
    filtro_tel = " AND c.telefone IS NOT NULL AND length(c.telefone) > 4" if so_com_telefone else ""

    linhas = consultar(f"""
        WITH agg AS (
            SELECT p.cliente_id,
                   count(*) FILTER (WHERE p.status <> 'canceled') AS pedidos,
                   coalesce(sum(p.total) FILTER (WHERE p.status <> 'canceled'), 0) AS gasto,
                   min(p.criado_em) AS primeiro,
                   max(p.criado_em) FILTER (WHERE p.status <> 'canceled') AS ultimo
            FROM pedidos p
            WHERE p.cliente_id IS NOT NULL {filtros}
            GROUP BY p.cliente_id
            HAVING count(*) FILTER (WHERE p.status <> 'canceled') > 0
        )
        SELECT a.cliente_id, c.nome, c.telefone, a.pedidos, round(a.gasto, 2) AS gasto,
               round(a.gasto / a.pedidos, 2) AS ticket_medio,
               a.primeiro, a.ultimo,
               ntile(5) OVER (ORDER BY a.ultimo ASC) AS r,
               ntile(5) OVER (ORDER BY a.pedidos ASC) AS f,
               ntile(5) OVER (ORDER BY (a.gasto / a.pedidos) ASC) AS m
        FROM agg a JOIN clientes c ON c.id = a.cliente_id
        WHERE 1=1 {filtro_tel}
    """, params)

    for r in linhas:
        fm = round((r["f"] + r["m"]) / 2) or 1
        r["segmento"] = _SEGMENTO_RF.get((r["r"], fm), 'Perdidos')

    busca_norm = busca.strip().lower()
    if busca_norm:
        linhas = [r for r in linhas
                  if busca_norm in (r["nome"] or "").lower()
                  or busca_norm in (r["telefone"] or "")]

    chave_ordenacao = {
        "pedidos": lambda r: r["pedidos"], "gasto": lambda r: float(r["gasto"]),
        "ticket_medio": lambda r: float(r["ticket_medio"]),
        "ultimo": lambda r: r["ultimo"], "primeiro": lambda r: r["primeiro"],
    }.get(ordenar_por, lambda r: r["pedidos"])
    linhas.sort(key=chave_ordenacao, reverse=(direcao != "asc"))

    total = len(linhas)
    inicio = (pagina - 1) * por_pagina
    pagina_atual = linhas[inicio:inicio + por_pagina]

    return {
        "total": total, "pagina": pagina, "por_pagina": por_pagina,
        "clientes": [{
            "nome": r["nome"], "telefone": r["telefone"], "pedidos": r["pedidos"],
            "ticket_medio": float(r["ticket_medio"]), "gasto": float(r["gasto"]),
            "ultimo_pedido": r["ultimo"].isoformat() if r["ultimo"] else None,
            "cliente_desde": r["primeiro"].isoformat() if r["primeiro"] else None,
            "segmento": r["segmento"],
        } for r in pagina_atual],
    }


@app.get("/api/operacao")
def analise_operacao(marca: str = Query("todas"), unidade: str = Query("todas"), periodo: str = Query("60")):
    filtro_marca = ""
    params = {}
    if marca != "todas":
        filtro_marca = "AND p.marca = %(marca)s"
        params["marca"] = marca
    if unidade != "todas":
        filtro_marca += " AND p.unidade = %(unidade)s"
        params["unidade"] = unidade

    agora = f"(now() AT TIME ZONE '{TZ}')"
    dia = f"(p.criado_em AT TIME ZONE '{TZ}')::date"
    if periodo == "semana_atual":
        cond = f"{dia} >= date_trunc('week', {agora})::date"
    elif periodo == "mes_atual":
        cond = f"{dia} >= date_trunc('month', {agora})::date"
    elif periodo == "mes_passado":
        cond = (f"{dia} >= (date_trunc('month', {agora}) - interval '1 month')::date "
                f"AND {dia} < date_trunc('month', {agora})::date")
    else:
        params["dias"] = max(min(int(periodo), 365), 7)
        cond = "p.criado_em >= now() - (%(dias)s || ' days')::interval"

    pl = f"""
        WITH pl AS (
            SELECT (p.criado_em AT TIME ZONE '{TZ}') AS ts, p.total
            FROM pedidos p
            WHERE p.status <> 'canceled'
              AND {cond}
              {filtro_marca}
        )
    """

    dias_semana = consultar(pl + """
        , ph AS (
            SELECT extract(dow FROM ts)::int AS dow,
                   extract(hour FROM ts)::int AS hora, count(*) AS pedidos
            FROM pl GROUP BY 1, 2
        ),
        pico AS (SELECT dow, max(pedidos) AS maximo FROM ph GROUP BY 1),
        ini AS (
            SELECT h.dow, min(h.hora) AS inicio
            FROM ph h JOIN pico p USING (dow)
            WHERE h.pedidos >= 0.6 * p.maximo GROUP BY 1
        ),
        hp AS (SELECT DISTINCT ON (dow) dow, hora FROM ph ORDER BY dow, pedidos DESC),
        md AS (
            SELECT extract(dow FROM ts)::int AS dow,
                   round(count(*)::numeric / count(DISTINCT ts::date), 1) AS media,
                   round(avg(total), 2) AS ticket
            FROM pl GROUP BY 1
        )
        SELECT md.dow, md.media, md.ticket,
               ini.inicio AS pico_inicio, hp.hora AS hora_pico
        FROM md JOIN ini USING (dow) JOIN hp USING (dow)
        ORDER BY md.dow
    """, params)

    heatmap = consultar(pl + """
        SELECT extract(dow FROM ts)::int AS dow,
               extract(hour FROM ts)::int AS hora, count(*) AS pedidos
        FROM pl GROUP BY 1, 2 ORDER BY 1, 2
    """, params)

    grupos = consultar(pl + """
        SELECT CASE WHEN extract(dow FROM ts) IN (5, 6, 0)
                    THEN 'fds' ELSE 'meio' END AS grupo,
               round(count(*)::numeric / count(DISTINCT ts::date), 1) AS pedidos_dia,
               round(avg(total), 2) AS ticket
        FROM pl GROUP BY 1
    """, params)

    pl12 = f"""
        WITH pl AS (
            SELECT (p.criado_em AT TIME ZONE '{TZ}') AS ts, p.total
            FROM pedidos p
            WHERE p.status <> 'canceled'
              AND p.criado_em >= now() - interval '84 days'
              {filtro_marca}
        )
    """

    semanas = consultar(pl12 + """
        SELECT to_char(date_trunc('week', ts), 'DD/MM') AS semana,
               date_trunc('week', ts) AS ord,
               count(*) AS pedidos, round(sum(total), 2) AS faturamento
        FROM pl GROUP BY 2, 1 ORDER BY ord
    """, params)

    semana_vs = consultar(pl12 + f"""
        SELECT
            count(*) FILTER (
                WHERE ts >= date_trunc('week', {agora})
            ) AS atual,
            coalesce(round(sum(total) FILTER (
                WHERE ts >= date_trunc('week', {agora})), 2), 0) AS fat_atual,
            count(*) FILTER (
                WHERE ts >= date_trunc('week', {agora}) - interval '7 days'
                  AND ts <= {agora} - interval '7 days'
            ) AS anterior,
            coalesce(round(sum(total) FILTER (
                WHERE ts >= date_trunc('week', {agora}) - interval '7 days'
                  AND ts <= {agora} - interval '7 days'), 2), 0) AS fat_anterior
        FROM pl
    """, params)[0]

    tempos_cte = f"""
        WITH t AS (
            SELECT p.tipo,
                   extract(hour FROM p.criado_em AT TIME ZONE '{TZ}')::int AS hora,
                   extract(epoch FROM (p.concluido_em - p.criado_em)) / 60 AS minutos
            FROM pedidos p
            WHERE p.status IN ('closed', 'delivered')
              AND p.concluido_em > p.criado_em
              AND {cond}
              {filtro_marca}
        ), tv AS (SELECT * FROM t WHERE minutos BETWEEN 1 AND 180)
    """

    tempos_canal = consultar(tempos_cte + """
        SELECT tipo,
               round(percentile_cont(0.5) WITHIN GROUP (ORDER BY minutos)::numeric, 0) AS mediana,
               round(percentile_cont(0.9) WITHIN GROUP (ORDER BY minutos)::numeric, 0) AS p90,
               count(*) AS pedidos
        FROM tv GROUP BY tipo ORDER BY 4 DESC
    """, params)

    tempos_hora = consultar(tempos_cte + """
        SELECT hora,
               round(percentile_cont(0.5) WITHIN GROUP (ORDER BY minutos)::numeric, 0) AS mediana,
               count(*) AS pedidos
        FROM tv GROUP BY hora HAVING count(*) >= 5 ORDER BY hora
    """, params)

    cobertura = consultar(f"""
        SELECT count(*) FILTER (
                   WHERE p.status IN ('closed', 'delivered')
                     AND p.concluido_em > p.criado_em
                     AND extract(epoch FROM (p.concluido_em - p.criado_em)) / 60
                         BETWEEN 1 AND 180
               ) AS mediveis,
               count(*) AS total
        FROM pedidos p
        WHERE p.status <> 'canceled' AND {cond} {filtro_marca}
    """, params)[0]

    marcas = consultar(
        "SELECT DISTINCT marca FROM pedidos WHERE marca IS NOT NULL ORDER BY 1", {})

    return {"dias_semana": dias_semana, "heatmap": heatmap,
            "grupos": grupos, "semanas": semanas, "semana_vs": semana_vs,
            "tempos_canal": tempos_canal, "tempos_hora": tempos_hora,
            "cobertura": cobertura, "marcas": marcas}


@app.get("/api/cardapio")
def analise_cardapio(marca: str = Query("todas"), unidade: str = Query("todas"), dias: int = Query(90, ge=7, le=365)):
    filtro_marca = ""
    params = {"dias": dias}
    if marca != "todas":
        filtro_marca = "AND p.marca = %(marca)s"
        params["marca"] = marca
    if unidade != "todas":
        filtro_marca += " AND p.unidade = %(unidade)s"
        params["unidade"] = unidade

    produtos = consultar(f"""
        SELECT coalesce(a.canonico, lower(trim(i.nome))) AS chave,
               max(i.nome) AS nome,
               sum(i.quantidade)::int AS qtd,
               round(sum(i.total), 2) AS receita,
               round(sum(i.total) / nullif(sum(i.quantidade), 0), 2) AS preco_medio,
               c.custo
        FROM pedido_itens i
        JOIN pedidos p ON p.id = i.pedido_id
        LEFT JOIN produto_alias a ON a.alias = lower(trim(i.nome))
        LEFT JOIN produto_custos c ON c.nome = coalesce(a.canonico, lower(trim(i.nome)))
        WHERE p.status <> 'canceled'
          AND p.criado_em >= now() - (%(dias)s || ' days')::interval
          AND NOT EXISTS (
              SELECT 1 FROM produto_excluido e
              WHERE e.nome = coalesce(a.canonico, lower(trim(i.nome)))
          )
          {filtro_marca}
        GROUP BY 1, c.custo
        HAVING sum(i.quantidade) > 0
        ORDER BY qtd DESC
    """, params)

    marcas = consultar(
        "SELECT DISTINCT marca FROM pedidos WHERE marca IS NOT NULL ORDER BY 1", {})

    excluidos = consultar(
        "SELECT nome FROM produto_excluido ORDER BY excluido_em DESC", {})

    return {"produtos": produtos, "marcas": marcas,
            "excluidos": [e["nome"] for e in excluidos]}


@app.post("/api/custos")
def salvar_custo(dados: dict = Body(...)):
    nome = str(dados.get("nome", "")).strip().lower()
    try:
        custo = float(dados.get("custo"))
    except (TypeError, ValueError):
        return {"ok": False, "erro": "custo inválido"}
    if not nome or custo < 0:
        return {"ok": False, "erro": "dados inválidos"}
    executar("""
        INSERT INTO produto_custos (nome, custo, atualizado_em)
        VALUES (%(nome)s, %(custo)s, now())
        ON CONFLICT (nome) DO UPDATE
            SET custo = EXCLUDED.custo, atualizado_em = now()
    """, {"nome": nome, "custo": custo})
    return {"ok": True}


@app.post("/api/produtos/excluir")
def excluir_produto(dados: dict = Body(...)):
    nome = str(dados.get("nome", "")).strip().lower()
    if not nome:
        return {"ok": False, "erro": "nome inválido"}
    executar("""
        INSERT INTO produto_excluido (nome, excluido_em)
        VALUES (%(nome)s, now())
        ON CONFLICT (nome) DO NOTHING
    """, {"nome": nome})
    return {"ok": True}


@app.post("/api/produtos/restaurar")
def restaurar_produto(dados: dict = Body(...)):
    nome = str(dados.get("nome", "")).strip().lower()
    if not nome:
        return {"ok": False, "erro": "nome inválido"}
    executar("DELETE FROM produto_excluido WHERE nome = %(nome)s", {"nome": nome})
    return {"ok": True}


@app.get("/api/bairros")
def analise_bairros(marca: str = Query("todas"), unidade: str = Query("todas"), dias: int = Query(90, ge=7, le=365),
                    agrupar: str = Query("regiao")):
    filtro_marca = ""
    params = {"dias": dias}
    if marca != "todas":
        filtro_marca = "AND p.marca = %(marca)s"
        params["marca"] = marca
    if unidade != "todas":
        filtro_marca += " AND p.unidade = %(unidade)s"
        params["unidade"] = unidade

    base = f"""
        FROM pedidos p
        WHERE p.status <> 'canceled'
          AND p.tipo = 'delivery'
          AND p.criado_em >= now() - (%(dias)s || ' days')::interval
          {filtro_marca}
    """

    if agrupar == "bairro":
        col_grupo = "coalesce(nullif(trim(p.bairro), ''), 'Sem bairro informado')"
    else:
        # região mapeada; sem regra cai no bairro; sem nada, 'Sem endereço'
        col_grupo = ("coalesce(nullif(trim(p.regiao), ''), "
                     "nullif(trim(p.bairro), ''), 'Sem endereço')")

    ranking = consultar(f"""
        SELECT {col_grupo} AS bairro,
               count(*) AS pedidos,
               round(sum(p.total), 2) AS faturamento,
               round(avg(p.total), 2) AS ticket,
               count(DISTINCT p.cliente_id) AS clientes,
               round(avg(p.taxa_entrega), 2) AS taxa_media
        {base}
        GROUP BY 1 ORDER BY 2 DESC LIMIT 25
    """, params)

    pontos = consultar(f"""
        SELECT p.lat, p.lng, p.total
        {base}
          AND p.lat IS NOT NULL AND p.lng IS NOT NULL
        ORDER BY p.criado_em DESC LIMIT 3000
    """, params)

    totais = consultar(f"""
        SELECT count(*) AS pedidos,
               coalesce(round(sum(p.total), 2), 0) AS faturamento,
               count(*) FILTER (WHERE p.bairro IS NOT NULL) AS com_bairro
        {base}
    """, params)[0]

    marcas = consultar(
        "SELECT DISTINCT marca FROM pedidos WHERE marca IS NOT NULL ORDER BY 1", {})

    return {"ranking": ranking, "pontos": pontos, "totais": totais, "marcas": marcas}


@app.get("/api/sentinela")
def sentinela():
    """Compara o agora com o tipico das ultimas 8 semanas (mesmo dia da
    semana, ate o mesmo horario) e devolve alertas de anomalia."""
    tzagora = f"(now() AT TIME ZONE '{TZ}')"
    tzcriado = f"(p.criado_em AT TIME ZONE '{TZ}')"
    minuto = lambda expr: f"(extract(hour FROM {expr}) * 60 + extract(minute FROM {expr}))"

    volume = consultar(f"""
        WITH hoje AS (
            SELECT count(*) FILTER (WHERE p.status <> 'canceled') AS n,
                   count(*) FILTER (WHERE p.status = 'canceled') AS canc
            FROM pedidos p
            WHERE {tzcriado}::date = {tzagora}::date
        ),
        hist AS (
            SELECT {tzcriado}::date AS d,
                   count(*) FILTER (WHERE p.status <> 'canceled') AS n,
                   count(*) FILTER (WHERE p.status = 'canceled') AS canc
            FROM pedidos p
            WHERE {tzcriado}::date >= {tzagora}::date - 56
              AND {tzcriado}::date < {tzagora}::date
              AND extract(dow FROM {tzcriado}) = extract(dow FROM {tzagora})
              AND {minuto(tzcriado)} <= {minuto(tzagora)}
            GROUP BY 1
        )
        SELECT (SELECT n FROM hoje) AS hoje,
               (SELECT canc FROM hoje) AS canc_hoje,
               coalesce((SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY n)
                         FROM hist), 0) AS tipico,
               coalesce((SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY canc)
                         FROM hist), 0) AS canc_tipico,
               (SELECT count(*) FROM hist) AS amostras
    """, {})[0]

    ultima_hora = consultar(f"""
        WITH agora60 AS (
            SELECT count(*) AS n FROM pedidos p
            WHERE p.status <> 'canceled'
              AND p.criado_em >= now() - interval '60 minutes'
        ),
        hist60 AS (
            SELECT {tzcriado}::date AS d, count(*) AS n
            FROM pedidos p
            WHERE p.status <> 'canceled'
              AND {tzcriado}::date >= {tzagora}::date - 56
              AND {tzcriado}::date < {tzagora}::date
              AND extract(dow FROM {tzcriado}) = extract(dow FROM {tzagora})
              AND {minuto(tzcriado)} > {minuto(tzagora)} - 60
              AND {minuto(tzcriado)} <= {minuto(tzagora)}
            GROUP BY 1
        )
        SELECT (SELECT n FROM agora60) AS hoje,
               coalesce((SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY n)
                         FROM hist60), 0) AS tipico
    """, {})[0]

    pulso = consultar("""
        SELECT round(extract(epoch FROM (now() - max(recebido_em))) / 60) AS minutos
        FROM webhook_eventos
    """, {})[0]

    tzconcluido = f"(p.concluido_em AT TIME ZONE '{TZ}')"
    tempo_entrega = consultar(f"""
        WITH agora AS (
            SELECT percentile_cont(0.5) WITHIN GROUP (
                       ORDER BY extract(epoch FROM (p.concluido_em - p.criado_em)) / 60) AS mediana,
                   count(*) AS n
            FROM pedidos p
            WHERE p.status IN ('closed', 'delivered')
              AND p.concluido_em > p.criado_em
              AND p.concluido_em >= now() - interval '60 minutes'
              AND extract(epoch FROM (p.concluido_em - p.criado_em)) / 60 BETWEEN 1 AND 180
        ),
        hist AS (
            SELECT extract(epoch FROM (p.concluido_em - p.criado_em)) / 60 AS minutos
            FROM pedidos p
            WHERE p.status IN ('closed', 'delivered')
              AND p.concluido_em > p.criado_em
              AND {tzconcluido}::date >= {tzagora}::date - 56
              AND {tzconcluido}::date < {tzagora}::date
              AND extract(dow FROM {tzconcluido}) = extract(dow FROM {tzagora})
              AND {minuto(tzconcluido)} > {minuto(tzagora)} - 60
              AND {minuto(tzconcluido)} <= {minuto(tzagora)}
              AND extract(epoch FROM (p.concluido_em - p.criado_em)) / 60 BETWEEN 1 AND 180
        )
        SELECT (SELECT mediana FROM agora) AS hoje,
               (SELECT n FROM agora) AS amostras_hoje,
               (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY minutos) FROM hist) AS tipico,
               (SELECT count(*) FROM hist) AS amostras_hist
    """, {})[0]

    alertas = []
    hoje, tipico = float(volume["hoje"]), float(volume["tipico"])
    amostras = int(volume["amostras"])
    h60, t60 = float(ultima_hora["hoje"]), float(ultima_hora["tipico"])
    canc, canc_tip = float(volume["canc_hoje"]), float(volume["canc_tipico"])
    sem_eventos = float(pulso["minutos"]) if pulso["minutos"] is not None else None

    # 1. sincronizador parado em horario que deveria ter movimento
    if sem_eventos is not None and sem_eventos > 45 and t60 >= 2:
        alertas.append({"nivel": "critico", "icone": "🔌",
            "texto": f"Sincronizador sem receber eventos há {sem_eventos:.0f} min "
                     f"em horário de movimento — pedidos podem não estar chegando ao banco.",
            "dica": "Avise quem cuida da integração (Chatwoot/Saipos) agora. Enquanto isso, "
                    "confere pedidos manualmente no WhatsApp e nos apps de entrega pra não perder venda."})

    # 2. silencio suspeito na ultima hora
    elif t60 >= 3 and h60 == 0:
        alertas.append({"nivel": "critico", "icone": "🔇",
            "texto": f"Nenhum pedido na última hora — o típico nesse horário é {t60:.0f}.",
            "dica": "Testa fazer um pedido de teste no cardápio/site agora. Se não abrir, "
                    "é isso — chama o suporte da plataforma (iFood/Saipos) na hora."})

    # 3. dia bem abaixo do tipico (so com base historica suficiente)
    if amostras >= 4 and tipico >= 8 and hoje < 0.6 * tipico:
        queda = 100 * (1 - hoje / tipico)
        alertas.append({"nivel": "atencao", "icone": "📉",
            "texto": f"Dia {queda:.0f}% abaixo do típico até agora "
                     f"({hoje:.0f} pedidos vs {tipico:.0f} normais pra esse ponto do dia).",
            "dica": "Dispara um cupom relâmpago pra base de clientes recorrentes "
                    "(lista pronta em Clientes → Lista de resgate) ou reforça um impulsionamento "
                    "por 2-3h nas redes."})

    # 4. cancelamentos anormais
    if canc >= 3 and canc >= 3 * max(canc_tip, 0.5):
        motivo = consultar(f"""
            SELECT coalesce(nullif(trim(motivo_cancelamento), ''), 'não informado') AS motivo,
                   count(*) AS n
            FROM pedidos p
            WHERE p.status = 'canceled' AND {tzcriado}::date = {tzagora}::date
            GROUP BY 1 ORDER BY 2 DESC LIMIT 1
        """, {})
        motivo_txt = (f' O motivo mais comum hoje: "{motivo[0]["motivo"]}" ({int(motivo[0]["n"])}x).'
                      if motivo and motivo[0]["motivo"] != "não informado" else "")
        alertas.append({"nivel": "atencao", "icone": "🚫",
            "texto": f"{canc:.0f} cancelamentos hoje (típico: {canc_tip:.0f}).{motivo_txt}",
            "dica": "Se for atraso, pode ser o mesmo problema do tempo de entrega — confere cozinha "
                    "e motoboys. Se for item em falta, atualiza o cardápio agora pra não repetir."})

    # 5. tempo de entrega/preparo muito acima do tipico na ultima hora
    tempo_hoje = float(tempo_entrega["hoje"]) if tempo_entrega["hoje"] is not None else None
    tempo_tipico = float(tempo_entrega["tipico"]) if tempo_entrega["tipico"] is not None else None
    amostras_hoje_tempo = int(tempo_entrega["amostras_hoje"])
    amostras_hist_tempo = int(tempo_entrega["amostras_hist"])
    if (tempo_hoje is not None and tempo_tipico is not None
            and amostras_hoje_tempo >= 3 and amostras_hist_tempo >= 4
            and tempo_tipico >= 15 and tempo_hoje >= 1.4 * tempo_tipico):
        alertas.append({"nivel": "atencao", "icone": "🐌",
            "texto": f"Tempo de entrega/preparo subiu pra {tempo_hoje:.0f} min "
                     f"na última hora (típico: {tempo_tipico:.0f} min).",
            "dica": "Confere quantos motoboys estão online e se a cozinha tem fila. Se persistir "
                    "por mais de 1h, é hora de chamar reforço ou pausar novos pedidos por um instante."})

    # 6. dia excepcional (aviso bom)
    if amostras >= 4 and tipico >= 5 and hoje >= 1.5 * tipico:
        alta = 100 * (hoje / tipico - 1)
        alertas.append({"nivel": "boa", "icone": "🚀",
            "texto": f"Dia {alta:.0f}% acima do típico ({hoje:.0f} vs {tipico:.0f}).",
            "dica": "Garante que o estoque aguenta até o fim do dia e avisa a equipe pra segurar o ritmo."})

    niveis = [a["nivel"] for a in alertas]
    status = ("critico" if "critico" in niveis
              else "atencao" if "atencao" in niveis
              else "boa" if "boa" in niveis else "ok")

    return {"status": status, "alertas": alertas,
            "contexto": {"hoje": hoje, "tipico": tipico, "amostras": amostras}}


@app.post("/api/taxas")
def salvar_taxa(dados: dict = Body(...)):
    origem = str(dados.get("origem", "")).strip()
    try:
        comissao = float(dados.get("comissao"))
    except (TypeError, ValueError):
        return {"ok": False, "erro": "comissão inválida"}
    if not origem or not (0 <= comissao <= 60):
        return {"ok": False, "erro": "dados inválidos"}
    executar("""
        INSERT INTO canal_taxas (origem, comissao_pct, atualizado_em)
        VALUES (%(origem)s, %(comissao)s, now())
        ON CONFLICT (origem) DO UPDATE
            SET comissao_pct = EXCLUDED.comissao_pct, atualizado_em = now()
    """, {"origem": origem, "comissao": comissao})
    return {"ok": True}


# Combos tem um refrigerante FIXO cadastrado na ficha tecnica (ex: sempre
# "Guaraná Normal"), mas o cliente escolhe o sabor de verdade no pedido - essa
# escolha fica so no complemento ("Refrigerante Coca-Cola Zero Lata"), nunca
# no nome do produto. Usado no consumo de insumos da MIA e da aba Compras pra
# substituir o insumo fixo da ficha pelo sabor realmente pedido, quando da pra
# reconhecer o complemento (sem complemento reconhecido, mantem o fixo).
_CASE_REFRI = """CASE
    WHEN co.nome ILIKE '%%coca%%' AND co.nome ILIKE '%%zero%%' THEN 'Coca Zero'
    WHEN co.nome ILIKE '%%coca%%' THEN 'Coca Normal'
    WHEN co.nome ILIKE '%%guaran%%' AND co.nome ILIKE '%%zero%%' THEN 'Guaraná Zero'
    WHEN co.nome ILIKE '%%guaran%%' THEN 'Guaraná Normal'
    WHEN co.nome ILIKE '%%fanta%%' THEN 'Fanta Laranja'
    WHEN co.nome ILIKE '%%sprite%%' THEN 'Sprite'
    WHEN co.nome ILIKE '%%heineken%%' THEN 'Heineken'
    WHEN co.nome ILIKE '%%stella%%' THEN 'Stella Artois'
    WHEN co.nome ILIKE '%%suco%%' AND co.nome ILIKE '%%uva%%' THEN 'Suco Del Valle Uva'
    WHEN co.nome ILIKE '%%suco%%' AND co.nome ILIKE '%%maracuj%%' THEN 'Suco Del Valle Maracujá'
    WHEN co.nome ILIKE '%%suco%%' THEN 'Suco (genérico)'
    WHEN (co.nome ILIKE '%%agua%%' OR co.nome ILIKE '%%água%%') AND (co.nome ILIKE '%%gas%%' OR co.nome ILIKE '%%gás%%') THEN 'Água com Gás'
    WHEN co.nome ILIKE '%%agua%%' OR co.nome ILIKE '%%água%%' THEN 'Água Normal'
    WHEN co.nome ILIKE '%%cerveja%%' THEN 'Cerveja (genérica)'
    WHEN co.nome ILIKE '%%refriger%%' THEN 'Refrigerante (genérico)'
END"""
# Molho escolhido no pedido (complemento) vai a parte num pote de 30 ml (~30 g) e
# baixa a mais do molho escolhido; o molho padrao do lanche continua na ficha tecnica.
_GRAMAS_POTE_MOLHO = 30
# Nuggets: baixa pelo tamanho escolhido (P = 9, G = 12). Agua mineral "com ou sem gas":
# o insumo (com gas / normal) vem do complemento escolhido.
_CASE_NUGGET = "CASE WHEN co.nome ILIKE '%%tamanho p%%' THEN 9 WHEN co.nome ILIKE '%%tamanho g%%' THEN 12 END"
_PRODUTO_AGUA_ESCOLHA = "água mineral - com ou sem gás"
# produtos cuja bebida real vem do complemento: combos + itens de bebida genérica
_BEBIDA_ESCOLHIDA = "(b.produto ILIKE 'combo%%' OR b.produto IN ('refrigerantes', 'sucos', 'cervejas'))"
_CASE_MOLHO = """CASE
    WHEN co.nome ILIKE '%%maracay%%' AND co.nome ILIKE '%%molho%%' THEN 'Maionese Grill'
    WHEN co.nome ILIKE '%%baconese%%' THEN 'Molho Baconese'
    WHEN co.nome ILIKE '%%ervas%%' THEN 'Molho Ervas Finas'
    WHEN co.nome ILIKE '%%parmes%%' THEN 'Molho Parmesão'
    WHEN co.nome ILIKE '%%barbecue%%' THEN 'Molho Barbecue'
END"""
_SODAS = ("'Coca Zero','Coca Normal','Guaraná Normal','Guaraná Zero','Fanta Laranja','Sprite',"
          "'Heineken','Stella Artois','Suco Del Valle Uva','Suco Del Valle Maracujá',"
          "'Suco (genérico)','Água com Gás','Água Normal','Cerveja (genérica)',"
          "'Refrigerante (genérico)'")


# Comissao por canal, 100% por regra (validada em extratos reais no "Sistema Lucro"):
# iFood 12% + 3,2% s/ subtotal | 99Food: 3,2% s/ subtotal (+8,9% "Tarifa 99" so na Chomp)
# | Balcao/Site/outros: adquirente ~3,99% s/ valor pago (subtotal + entrega - desconto).
_SQL_COMISSAO = """CASE
    WHEN p.origem = 'ifood' THEN p.subtotal * (0.12 + 0.032)
    WHEN p.origem IN ('99food', 'food99')
        THEN p.subtotal * (0.032 + CASE WHEN p.marca = 'Chomp Burger' THEN 0.089 ELSE 0 END)
    ELSE greatest(p.subtotal + p.taxa_entrega - coalesce(p.desconto_loja, p.desconto, 0), 0) * 0.0399
END"""

_CANAIS = {
    "ifood": "p.origem = 'ifood'",
    "99food": "p.origem IN ('99food', 'food99')",
    "site": "p.origem IN ('catalog', 'site delivery (saipos)')",
    "balcao": "p.origem NOT IN ('ifood', '99food', 'food99', 'catalog', 'site delivery (saipos)')",
}


def _filtro_canal(canal):
    c = _CANAIS.get(canal)
    return f" AND {c}" if c else ""


def _filtro_periodo(marca, unidade, periodo, canal="todos"):
    filtro_marca = _filtro_canal(canal)
    params = {}
    if marca != "todas":
        filtro_marca += " AND p.marca = %(marca)s"
        params["marca"] = marca
    if unidade != "todas":
        filtro_marca += " AND p.unidade = %(unidade)s"
        params["unidade"] = unidade

    agora = f"(now() AT TIME ZONE '{TZ}')"
    dia = f"(p.criado_em AT TIME ZONE '{TZ}')::date"
    if periodo == "hoje":
        cond = f"{dia} = {agora}::date"
    elif periodo == "ontem":
        cond = f"{dia} = ({agora}::date - 1)"
    elif periodo == "semana_atual":
        cond = f"{dia} >= date_trunc('week', {agora})::date"
    elif periodo == "mes_passado":
        cond = (f"{dia} >= (date_trunc('month', {agora}) - interval '1 month')::date "
                f"AND {dia} < date_trunc('month', {agora})::date")
    elif periodo == "mes_atual":
        cond = f"{dia} >= date_trunc('month', {agora})::date"
    else:
        params["dias"] = max(min(int(periodo), 365), 1)
        cond = "p.criado_em >= now() - (%(dias)s || ' days')::interval"
    return cond, filtro_marca, params


def _menos_um_mes(d):
    """Mesmo dia do mes anterior (ou o ultimo dia dele, se o mes anterior for mais curto)."""
    import calendar
    m = d.month - 1 or 12
    y = d.year - 1 if d.month == 1 else d.year
    ultimo_dia = calendar.monthrange(y, m)[1]
    return d.replace(year=y, month=m, day=min(d.day, ultimo_dia))


def _limites_periodo(periodo, hoje_d):
    """Limites [inicio, fim) do periodo, espelhando os mesmos cond de _filtro_periodo -
    usado so pra montar a janela de comparacao (periodo anterior)."""
    if periodo == "hoje":
        return hoje_d, hoje_d + timedelta(days=1)
    if periodo == "ontem":
        return hoje_d - timedelta(days=1), hoje_d
    if periodo == "semana_atual":
        return hoje_d - timedelta(days=hoje_d.isoweekday() - 1), hoje_d + timedelta(days=1)
    if periodo == "mes_passado":
        primeiro_atual = hoje_d.replace(day=1)
        return _menos_um_mes(primeiro_atual), primeiro_atual
    if periodo == "mes_atual":
        return hoje_d.replace(day=1), hoje_d + timedelta(days=1)
    dias = max(min(int(periodo), 365), 1)
    return hoje_d - timedelta(days=dias - 1), hoje_d + timedelta(days=1)


def _periodo_anterior(periodo, hoje_d):
    """Janela [inicio, fim) do periodo anterior equivalente - semana/mes deslocam pelo
    calendario (mesmo trecho da semana/mes passado), os demais pela propria duracao."""
    ini, fim = _limites_periodo(periodo, hoje_d)
    if periodo == "semana_atual":
        return ini - timedelta(days=7), fim - timedelta(days=7)
    if periodo in ("mes_atual", "mes_passado"):
        return _menos_um_mes(ini), _menos_um_mes(fim)
    dias = (fim - ini).days
    return ini - timedelta(days=dias), fim - timedelta(days=dias)


# ---------------------------------------------------------------------------
# Motor de calculo por pedido - regras validadas pedido a pedido no "Sistema
# Lucro" (Cardapio Web). DRE, analitico por pedido e Performance saem daqui,
# entao a soma dos pedidos sempre bate com o DRE.
# ---------------------------------------------------------------------------
TABELA_FRETE = {5: 6, 6: 7, 7: 9, 8: 11, 9: 12, 10: 15, 22: 22}
LIMITE_FRETE_GRATIS = 9
CUSTO_MOTOBOY_SITE = 8.0
TARIFA_99_CHOMP = 0.089
LOGISTICA_CHOMP_99 = [(4.99, 3.00), (8.24, 5.00), (10.99, 7.00), (float("inf"), 8.50)]
COMISSAO_VARIAVEL_CHOMP = {"ate_3km": 3.99, "3_a_5km": 5.99, "5_a_7km": 7.99}
LIMITE_KM_3_A_5 = 5.0
LOJA_LAT, LOJA_LNG = -15.671791, -47.842354
ORIGENS_SITE = ("catalog", "site delivery (saipos)")


def R(v):
    return "R$ " + f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _rota_km(lat, lng):
    """Distancia de rota loja->cliente via OSRM publico (None se falhar)."""
    import json as _json
    import urllib.request
    url = (f"http://router.project-osrm.org/route/v1/driving/"
           f"{LOJA_LNG},{LOJA_LAT};{lng},{lat}?overview=false")
    try:
        with urllib.request.urlopen(url, timeout=4) as resp:
            d = _json.load(resp)
        if d.get("code") != "Ok":
            return None
        return d["routes"][0]["distance"] / 1000.0
    except Exception:
        return None


def _completar_distancias(pendentes, maximo):
    """Calcula e guarda (cache) a distancia de rota dos pedidos Chomp/iFood sem desconto de frete."""
    feitos = {}
    for pid, lat, lng in pendentes[:maximo]:
        km = _rota_km(float(lat), float(lng))
        if km is None:
            continue
        executar("INSERT INTO pedido_distancia (pedido_id, km) VALUES (%(p)s, %(k)s) "
                 "ON CONFLICT (pedido_id) DO UPDATE SET km = EXCLUDED.km, calculado_em = now()",
                 {"p": pid, "k": round(km, 2)})
        feitos[pid] = km
    return feitos


def _aquecer_distancias():
    try:
        pend = consultar("""
            SELECT p.id, p.lat, p.lng FROM pedidos p
            LEFT JOIN pedido_distancia d ON d.pedido_id = p.id
            WHERE p.marca = 'Chomp Burger' AND p.origem = 'ifood' AND p.tipo = 'delivery'
              AND p.status <> 'canceled' AND coalesce(p.desconto_loja, 0) = 0
              AND p.lat IS NOT NULL AND p.lng IS NOT NULL AND d.pedido_id IS NULL
            ORDER BY p.criado_em DESC LIMIT 400
        """, {})
        _completar_distancias([(r["id"], r["lat"], r["lng"]) for r in pend], 400)
    except Exception:
        pass


@app.on_event("startup")
def _iniciar_aquecimento():
    import threading
    threading.Thread(target=_aquecer_distancias, daemon=True).start()


def _custo_logistica_chomp_99(entrega):
    for limite, custo in LOGISTICA_CHOMP_99:
        if entrega <= limite:
            return custo
    return LOGISTICA_CHOMP_99[-1][1]


def _calcular_pedido(r, cfg, razao_cmv):
    sub, ent = float(r["subtotal"]), float(r["taxa_entrega"])
    dl, di = float(r["desconto_loja"]), float(r["desconto_ifood"])
    origem, marca = r["origem"], r["marca"]
    chomp = marca == "Chomp Burger"
    delivery = r["tipo"] == "delivery"
    ifood = origem == "ifood"
    n99 = origem in ("99food", "food99")
    site = origem in ORIGENS_SITE

    # --- comissao / taxa ---
    if ifood:
        comissao, taxa = sub * 0.12, sub * 0.032
    elif n99:
        comissao, taxa = (sub * TARIFA_99_CHOMP if chomp else 0.0), sub * 0.032
    else:
        comissao, taxa = 0.0, max(sub + ent - dl, 0) * 0.0399

    # --- custo de entrega / logistica ---
    tipo_frete, plataforma = "nenhum", False
    if not delivery and not (chomp and (ifood or n99)):
        frete = 0.0
    elif site:
        frete, tipo_frete = CUSTO_MOTOBOY_SITE, "site"
    elif chomp and ifood:
        plataforma = True
        if dl > 0:
            frete, tipo_frete = COMISSAO_VARIAVEL_CHOMP["ate_3km"], "chomp"
        elif r.get("km") is not None:
            km = float(r["km"])
            frete = COMISSAO_VARIAVEL_CHOMP["3_a_5km" if km <= LIMITE_KM_3_A_5 else "5_a_7km"]
            tipo_frete = "chomp"
        else:
            frete, tipo_frete = COMISSAO_VARIAVEL_CHOMP["3_a_5km"], "estimado"
    elif chomp and n99:
        frete, tipo_frete, plataforma = _custo_logistica_chomp_99(ent), "chomp", True
    elif chomp:
        frete = 0.0
    else:
        rep = TABELA_FRETE.get(round(ent))
        if rep is None:
            frete, tipo_frete = float(cfg.get("custo_entrega", 0)), "estimado"
        elif ent <= LIMITE_FRETE_GRATIS and round(dl, 2) >= round(ent, 2):
            frete, tipo_frete = float(rep), "gratis"
        else:
            frete, tipo_frete = max(rep - ent, 0.0), "tabela"

    # --- receita / repasse / lucro ---
    bruto = sub if chomp else sub + ent
    receita = bruto - dl
    repasse = receita - comissao - taxa - (frete if plataforma else 0.0)
    imposto = receita * float(cfg.get("imposto_pct", 0)) / 100
    rec_map = float(r["rec_map"])
    cmv = float(r["cmv_map"]) + max(float(r["rec_total"]) - rec_map, 0) * razao_cmv
    lucro = receita - comissao - taxa - imposto - cmv - frete
    return {
        "id": r["id"], "numero": r["numero_curto"], "data": r["criado_em"].isoformat(),
        "origem": origem, "marca": marca, "unidade": r["unidade"], "tipo": r["tipo"],
        "subtotal": sub, "entrega_cobrada": ent, "desconto_loja": dl, "desconto_ifood": di,
        "total": float(r["total"]), "bruto": bruto, "receita": receita,
        "comissao": comissao, "taxa_transacao": taxa, "imposto": imposto, "cmv": cmv,
        "frete": frete, "tipo_frete": tipo_frete, "repasse": repasse,
        "lucro": lucro, "margem": (100 * lucro / sub) if sub > 0 else 0.0,
        "_rec_map": rec_map, "_rec_total": float(r["rec_total"]),
    }


def _calcular_periodo(cond, filtro_marca, params):
    cfg = {r["chave"]: float(r["valor"]) for r in consultar("SELECT chave, valor FROM dre_config", {})}
    rows = consultar(f"""
        SELECT p.id, p.order_id_cw, coalesce(p.numero_curto, p.order_id_cw) AS numero_curto,
               p.criado_em, p.origem, p.marca, p.unidade, p.tipo,
               p.subtotal, p.taxa_entrega, p.total, p.lat, p.lng, d.km,
               coalesce(p.desconto_loja, p.desconto, 0) AS desconto_loja,
               coalesce(p.desconto_ifood, 0) AS desconto_ifood,
               coalesce(it.cmv_map, 0) + coalesce(op.cmv_map, 0) AS cmv_map,
               coalesce(it.rec_map, 0) + coalesce(op.rec_map, 0) AS rec_map,
               coalesce(it.rec_total, 0) + coalesce(op.rec_total, 0) AS rec_total
        FROM pedidos p
        LEFT JOIN pedido_distancia d ON d.pedido_id = p.id
        LEFT JOIN (
            SELECT i.pedido_id,
                   sum(i.quantidade * c.custo) AS cmv_map,
                   sum(i.total) FILTER (WHERE c.custo IS NOT NULL) AS rec_map,
                   sum(i.total) AS rec_total
            FROM pedido_itens i
            LEFT JOIN produto_custos c ON c.nome = lower(trim(i.nome))
            GROUP BY i.pedido_id
        ) it ON it.pedido_id = p.id
        LEFT JOIN (
            SELECT i.pedido_id,
                   sum(coalesce(co.quantidade, 1) * c.custo) AS cmv_map,
                   sum(co.preco * coalesce(co.quantidade, 1)) FILTER (WHERE c.custo IS NOT NULL) AS rec_map,
                   sum(co.preco * coalesce(co.quantidade, 1)) AS rec_total
            FROM pedido_complementos co
            JOIN pedido_itens i ON i.id = co.pedido_item_id
            LEFT JOIN produto_custos c ON c.nome = lower(trim(co.nome))
            WHERE co.preco > 0
            GROUP BY i.pedido_id
        ) op ON op.pedido_id = p.id
        WHERE p.status <> 'canceled' AND {cond} {filtro_marca}
        ORDER BY p.criado_em DESC
    """, params)

    # completa (com limite) a distancia de rota dos Chomp/iFood ainda sem cache
    pend = [(r["id"], r["lat"], r["lng"]) for r in rows
            if r["marca"] == "Chomp Burger" and r["origem"] == "ifood" and r["tipo"] == "delivery"
            and r["km"] is None and float(r["desconto_loja"]) == 0 and r["lat"] and r["lng"]]
    if pend:
        novos = _completar_distancias(pend, 6)
        for r in rows:
            if r["id"] in novos:
                r["km"] = novos[r["id"]]

    tot_map = sum(float(r["rec_map"]) for r in rows)
    tot_cmv = sum(float(r["cmv_map"]) for r in rows)
    razao = (tot_cmv / tot_map) if tot_map > 0 else 0.0
    return [_calcular_pedido(r, cfg, razao) for r in rows], cfg


def _agregar(linhas):
    s = lambda k: sum(l[k] for l in linhas)
    rec_tot = s("_rec_total")
    cont = lambda t: sum(1 for l in linhas if l["tipo_frete"] == t)
    return {
        "bruto": s("bruto"), "receita": s("receita"), "subtotal": s("subtotal"),
        "comissao": s("comissao"), "taxa": s("taxa_transacao"), "imposto": s("imposto"),
        "cmv": s("cmv"), "frete": s("frete"), "repasse": s("repasse"), "lucro": s("lucro"),
        "promo_loja": s("desconto_loja"), "promo_ifood": s("desconto_ifood"),
        "cobertura": (100 * s("_rec_map") / rec_tot) if rec_tot > 0 else 0,
        "margem": (100 * s("lucro") / s("subtotal")) if s("subtotal") > 0 else 0,
        "fr_tabela": cont("tabela"), "fr_gratis": cont("gratis"), "fr_site": cont("site"),
        "fr_chomp": cont("chomp"), "fr_estimado": cont("estimado"),
    }


@app.get("/api/dre")
def dre(marca: str = Query("todas"), unidade: str = Query("todas"), periodo: str = Query("mes_atual"),
        canal: str = Query("todos"), comparar: bool = Query(False)):
    cond, filtro_marca, params = _filtro_periodo(marca, unidade, periodo, canal)
    linhas, cfg = _calcular_periodo(cond, filtro_marca, params)
    a = _agregar(linhas)

    n_entregas = sum(1 for l in linhas if l["tipo"] == "delivery")
    nota_comissao = (f"Comissão {R(a['comissao'])} + taxa de transação/adquirência {R(a['taxa'])} · "
                     "iFood 12% + 3,2% s/ subtotal · 99Food 3,2% (Chomp +8,9%) · Balcão/Site 3,99% s/ valor pago")
    nota_desc = (f"Só desconto bancado pela loja. Promoções do iFood ({R(a['promo_ifood'])}) "
                 "são pagas pelo iFood e não afetam o lucro") if a["promo_ifood"] > 0 else None
    nota_frete = (f"{a['fr_tabela']} pela tabela real de repasse · {a['fr_gratis']} com frete grátis (custo integral)"
                  f" · {a['fr_site']} Site (R$ 8,00) · {a['fr_chomp']} Chomp (logística da plataforma)"
                  f" · {a['fr_estimado']} estimadas pela média R$ {cfg.get('custo_entrega', 0):.2f}")

    comparacao = None
    if comparar:
        hoje_d = consultar(f"SELECT (now() AT TIME ZONE '{TZ}')::date AS d", {})[0]["d"]
        ini2, fim2 = _periodo_anterior(periodo, hoje_d)
        cond_ant = (f"(p.criado_em AT TIME ZONE '{TZ}')::date >= %(_ini_ant)s "
                    f"AND (p.criado_em AT TIME ZONE '{TZ}')::date < %(_fim_ant)s")
        params_ant = {**params, "_ini_ant": ini2, "_fim_ant": fim2}
        linhas_ant, _ = _calcular_periodo(cond_ant, filtro_marca, params_ant)
        a_ant = _agregar(linhas_ant)
        comparacao = {
            "receita": a_ant["receita"], "lucro": a_ant["lucro"], "margem": a_ant["margem"],
            "pedidos": len(linhas_ant), "repasse_real": a_ant["repasse"],
            "vendas_cheias": a_ant["bruto"], "cmv": a_ant["cmv"],
            "inicio": ini2.isoformat(), "fim": (fim2 - timedelta(days=1)).isoformat(),
        }

    return {
        "linhas": [
            {"t": "+", "rotulo": "Vendas cheias (antes de descontos)", "valor": a["bruto"]},
            {"t": "-", "rotulo": "Descontos da loja e cupons", "valor": a["promo_loja"],
             **({"nota": nota_desc} if nota_desc else {})},
            {"t": "=", "rotulo": "Receita realizada", "valor": a["receita"]},
            {"t": "-", "rotulo": "Comissões de canais (pedágio)", "valor": a["comissao"] + a["taxa"],
             "nota": nota_comissao},
            {"t": "-", "rotulo": f"Impostos ({cfg.get('imposto_pct', 0):.1f}%)", "valor": a["imposto"]},
            {"t": "-", "rotulo": "CMV — custo dos produtos", "valor": a["cmv"],
             "nota": f"{a['cobertura']:.0f}% da receita com custo cadastrado"
                     + ("; restante estimado pela média" if a["cobertura"] < 99 else "")},
            {"t": "-", "rotulo": "Custo de entrega (motoboy)", "valor": a["frete"], "nota": nota_frete},
            {"t": "=", "rotulo": "Lucro bruto (antes das despesas fixas)", "valor": a["lucro"]},
        ],
        "resumo": {"receita": a["receita"], "lucro": a["lucro"], "margem": a["margem"],
                   "pedidos": len(linhas), "entregas": n_entregas, "cobertura_cmv": a["cobertura"],
                   "bruto_sem_taxa": 0,
                   "repasse_real": a["repasse"], "comissao": a["comissao"], "taxa_transacao": a["taxa"],
                   "custo_frete": a["frete"], "cmv": a["cmv"], "promo_loja": a["promo_loja"],
                   "promo_ifood": a["promo_ifood"], "impostos": a["imposto"], "subtotal": a["subtotal"],
                   "vendas_cheias": a["bruto"]},
        "config": cfg,
        "comparacao": comparacao,
        "marcas": consultar(
            "SELECT DISTINCT marca FROM pedidos WHERE marca IS NOT NULL ORDER BY 1", {}),
    }


@app.get("/api/cancelamentos")
def cancelamentos(marca: str = Query("todas"), unidade: str = Query("todas"),
                   periodo: str = Query("mes_atual"), canal: str = Query("todos")):
    """Motivo de cancelamento vem direto do canal (cancellation_reason no iFood/99Food,
    discount_reason na Saipos/Balcao) - so agrupa o que ja esta salvo em pedidos.motivo_cancelamento."""
    cond, filtro_marca, params = _filtro_periodo(marca, unidade, periodo, canal)
    motivos = consultar(f"""
        SELECT coalesce(nullif(trim(motivo_cancelamento), ''), 'Motivo não informado') AS motivo,
               count(*) AS pedidos,
               coalesce(sum(p.total), 0) AS faturamento,
               coalesce(avg(p.total), 0) AS ticket
        FROM pedidos p
        WHERE {cond} AND p.status = 'canceled' {filtro_marca}
        GROUP BY 1
        ORDER BY faturamento DESC
    """, params)
    resumo = consultar(f"""
        SELECT count(*) FILTER (WHERE p.status = 'canceled') AS cancelados,
               count(*) AS total_pedidos,
               coalesce(sum(p.total) FILTER (WHERE p.status = 'canceled'), 0) AS perdido
        FROM pedidos p
        WHERE {cond} {filtro_marca}
    """, params)[0]
    return {"motivos": motivos, "resumo": resumo}


@app.get("/api/pedidos_lucro")
def pedidos_lucro(marca: str = Query("todas"), unidade: str = Query("todas"),
                  periodo: str = Query("mes_atual"), limite: int = Query(300),
                  canal: str = Query("todos")):
    """Analitico por pedido - mesmas regras (e mesmos totais) do /api/dre."""
    cond, filtro_marca, params = _filtro_periodo(marca, unidade, periodo, canal)
    linhas, cfg = _calcular_periodo(cond, filtro_marca, params)
    return {"pedidos": [{k: v for k, v in l.items() if not k.startswith("_")} for l in linhas[:max(min(limite, 1000), 1)]], "config": cfg}


@app.get("/api/pedido_itens")
def pedido_itens(pedido_id: int = Query(...)):
    itens = consultar("""
        SELECT i.nome, i.quantidade, i.total, c.custo,
               (i.quantidade * c.custo) AS custo_total, false AS opcional
        FROM pedido_itens i
        LEFT JOIN produto_custos c ON c.nome = lower(trim(i.nome))
        WHERE i.pedido_id = %(id)s
        ORDER BY i.total DESC
    """, {"id": pedido_id})
    opcionais = consultar("""
        SELECT co.nome, coalesce(co.quantidade, 1) AS quantidade,
               co.preco * coalesce(co.quantidade, 1) AS total, c.custo,
               (coalesce(co.quantidade, 1) * c.custo) AS custo_total, true AS opcional
        FROM pedido_complementos co
        JOIN pedido_itens i ON i.id = co.pedido_item_id
        LEFT JOIN produto_custos c ON c.nome = lower(trim(co.nome))
        WHERE i.pedido_id = %(id)s AND co.preco > 0
        ORDER BY 3 DESC
    """, {"id": pedido_id})
    return itens + opcionais


@app.post("/api/dre_config")
def salvar_dre_config(dados: dict = Body(...)):
    chave = str(dados.get("chave", "")).strip()
    try:
        valor = float(dados.get("valor"))
    except (TypeError, ValueError):
        return {"ok": False, "erro": "valor inválido"}
    if chave not in ("imposto_pct", "custo_entrega") or valor < 0:
        return {"ok": False, "erro": "dados inválidos"}
    executar("""
        INSERT INTO dre_config (chave, valor, atualizado_em)
        VALUES (%(chave)s, %(valor)s, now())
        ON CONFLICT (chave) DO UPDATE
            SET valor = EXCLUDED.valor, atualizado_em = now()
    """, {"chave": chave, "valor": valor})
    return {"ok": True}


@app.get("/api/meta")
def meta_do_mes(marca: str = Query("todas"), unidade: str = Query("todas")):
    agora = f"(now() AT TIME ZONE '{TZ}')"
    filtro_marca = ""
    params = {"marca": marca}
    if marca != "todas":
        filtro_marca = "AND p.marca = %(marca)s"
    if unidade != "todas":
        filtro_marca += " AND p.unidade = %(unidade)s"
        params["unidade"] = unidade

    dados = consultar(f"""
        SELECT
            (SELECT valor FROM metas
              WHERE mes = date_trunc('month', {agora})::date
                AND marca = %(marca)s) AS meta,
            coalesce((SELECT sum(p.total) FROM pedidos p
              WHERE p.status <> 'canceled'
                AND (p.criado_em AT TIME ZONE '{TZ}')::date
                    >= date_trunc('month', {agora})::date
                {filtro_marca}), 0) AS realizado,
            extract(day FROM {agora})::int AS dia_hoje,
            extract(day FROM (date_trunc('month', {agora})
                + interval '1 month' - interval '1 day'))::int AS dias_no_mes
    """, params)[0]

    meta = float(dados["meta"]) if dados["meta"] is not None else None
    realizado = float(dados["realizado"])
    dia = int(dados["dia_hoje"])
    dias_mes = int(dados["dias_no_mes"])
    dias_restantes = dias_mes - dia + 1     # inclui hoje
    ritmo = realizado / max(dia - 1, 1) if dia > 1 else realizado
    projecao = ritmo * dias_mes

    resp = {"meta": meta, "realizado": realizado,
            "dia_hoje": dia, "dias_no_mes": dias_mes,
            "dias_restantes": dias_restantes,
            "ritmo_atual": round(ritmo, 2),
            "projecao": round(projecao, 2),
            "meta_e_do_grupo_todo": unidade != "todas"}
    if meta:
        falta = max(meta - realizado, 0)
        resp.update({
            "pct": round(100 * realizado / meta, 1),
            "falta": round(falta, 2),
            "necessario_por_dia": round(falta / max(dias_restantes, 1), 2),
            "no_ritmo": projecao >= meta,
        })
    return resp


@app.post("/api/meta")
def salvar_meta(dados: dict = Body(...)):
    marca = str(dados.get("marca", "todas")).strip() or "todas"
    try:
        valor = float(dados.get("valor"))
    except (TypeError, ValueError):
        return {"ok": False, "erro": "valor inválido"}
    if valor <= 0:
        return {"ok": False, "erro": "meta deve ser positiva"}
    executar(f"""
        INSERT INTO metas (mes, marca, valor, atualizado_em)
        VALUES (date_trunc('month', (now() AT TIME ZONE '{TZ}'))::date,
                %(marca)s, %(valor)s, now())
        ON CONFLICT (mes, marca) DO UPDATE
            SET valor = EXCLUDED.valor, atualizado_em = now()
    """, {"marca": marca, "valor": valor})
    return {"ok": True}


@app.get("/api/metas")
def metas_todas():
    agora = f"(now() AT TIME ZONE '{TZ}')"
    marcas = [r["marca"] for r in consultar(
        "SELECT DISTINCT marca FROM pedidos WHERE marca IS NOT NULL ORDER BY 1", {})]
    resultado = []
    for marca in ["todas"] + marcas:
        filtro = "" if marca == "todas" else "AND p.marca = %(marca)s"
        d = consultar(f"""
            SELECT
                (SELECT valor FROM metas
                  WHERE mes = date_trunc('month', {agora})::date
                    AND marca = %(marca)s) AS meta,
                coalesce((SELECT sum(p.total) FROM pedidos p
                  WHERE p.status <> 'canceled'
                    AND (p.criado_em AT TIME ZONE '{TZ}')::date
                        >= date_trunc('month', {agora})::date
                    {filtro}), 0) AS realizado,
                extract(day FROM {agora})::int AS dia_hoje,
                extract(day FROM (date_trunc('month', {agora})
                    + interval '1 month' - interval '1 day'))::int AS dias_no_mes
        """, {"marca": marca})[0]

        meta = float(d["meta"]) if d["meta"] is not None else None
        realizado = float(d["realizado"])
        dia, dias_mes = int(d["dia_hoje"]), int(d["dias_no_mes"])
        dias_restantes = dias_mes - dia + 1
        ritmo = realizado / max(dia - 1, 1) if dia > 1 else realizado
        projecao = ritmo * dias_mes

        item = {"marca": marca, "meta": meta, "realizado": realizado,
                "dia_hoje": dia, "dias_no_mes": dias_mes,
                "dias_restantes": dias_restantes,
                "ritmo_atual": round(ritmo, 2), "projecao": round(projecao, 2)}
        if meta:
            falta = max(meta - realizado, 0)
            item.update({
                "pct": round(100 * realizado / meta, 1),
                "falta": round(falta, 2),
                "necessario_por_dia": round(falta / max(dias_restantes, 1), 2),
                "no_ritmo": projecao >= meta,
            })
        resultado.append(item)
    return {"metas": resultado}


@app.get("/api/previsao")
def previsao_demanda(marca: str = Query("todas"), unidade: str = Query("todas")):
    """Preve os proximos 7 dias: mediana por dia da semana (8 semanas)
    ajustada pela tendencia (ultimas 4 semanas vs 4 anteriores)."""
    filtro_marca = ""
    params = {}
    if marca != "todas":
        filtro_marca = "AND p.marca = %(marca)s"
        params["marca"] = marca
    if unidade != "todas":
        filtro_marca += " AND p.unidade = %(unidade)s"
        params["unidade"] = unidade

    hist = consultar(f"""
        SELECT (p.criado_em AT TIME ZONE '{TZ}')::date AS dia,
               extract(dow FROM p.criado_em AT TIME ZONE '{TZ}')::int AS dow,
               count(*) AS pedidos,
               coalesce(sum(p.total), 0) AS faturamento
        FROM pedidos p
        WHERE p.status <> 'canceled'
          AND (p.criado_em AT TIME ZONE '{TZ}')::date
              >= (now() AT TIME ZONE '{TZ}')::date - 56
          AND (p.criado_em AT TIME ZONE '{TZ}')::date
              < (now() AT TIME ZONE '{TZ}')::date
          {filtro_marca}
        GROUP BY 1, 2 ORDER BY 1
    """, params)

    from datetime import date, timedelta
    import statistics

    por_dow = {}
    recentes, anteriores = 0.0, 0.0
    hoje = consultar(f"SELECT (now() AT TIME ZONE '{TZ}')::date AS d", {})[0]["d"]
    for h in hist:
        por_dow.setdefault(int(h["dow"]), {"p": [], "f": []})
        por_dow[int(h["dow"])]["p"].append(float(h["pedidos"]))
        por_dow[int(h["dow"])]["f"].append(float(h["faturamento"]))
        idade = (hoje - h["dia"]).days
        if idade <= 28:
            recentes += float(h["pedidos"])
        else:
            anteriores += float(h["pedidos"])

    fator = 1.0
    if anteriores >= 20:
        fator = max(0.6, min(1.5, recentes / anteriores))

    def faixa(valores):
        if not valores:
            return None
        vs = sorted(valores)
        med = statistics.median(vs)
        p25 = vs[max(int(len(vs) * 0.25) - (0 if len(vs) > 3 else 0), 0)]
        p75 = vs[min(int(len(vs) * 0.75), len(vs) - 1)]
        return med, p25, p75

    dias = []
    for i in range(1, 8):
        d = hoje + timedelta(days=i)
        dow = int(d.strftime("%w"))
        dados = por_dow.get(dow, {"p": [], "f": []})
        fp = faixa(dados["p"])
        ff = faixa(dados["f"])
        if fp is None:
            continue
        dias.append({
            "data": d.isoformat(),
            "dow": dow,
            "pedidos": round(fp[0] * fator),
            "pedidos_min": round(fp[1] * fator),
            "pedidos_max": round(fp[2] * fator),
            "faturamento": round(ff[0] * fator, 2),
            "faturamento_min": round(ff[1] * fator, 2),
            "faturamento_max": round(ff[2] * fator, 2),
            "amostras": len(dados["p"]),
        })

    return {
        "dias": dias,
        "fator_tendencia": round(fator, 3),
        "total_pedidos": sum(x["pedidos"] for x in dias),
        "total_faturamento": round(sum(x["faturamento"] for x in dias), 2),
        "marcas": consultar(
            "SELECT DISTINCT marca FROM pedidos WHERE marca IS NOT NULL ORDER BY 1", {}),
    }


@app.get("/api/compras")
def lista_compras(marca: str = Query("todas"), unidade: str = Query("todas")):
    """Necessidade de insumos pros proximos 7 dias: venda media semanal por
    produto (28 dias) x fator de tendencia x ficha tecnica."""
    filtro_marca = ""
    params = {}
    if marca != "todas":
        filtro_marca = "AND p.marca = %(marca)s"
        params["marca"] = marca
    if unidade != "todas":
        filtro_marca += " AND p.unidade = %(unidade)s"
        params["unidade"] = unidade

    fator_q = consultar(f"""
        SELECT count(*) FILTER (WHERE p.criado_em >= now() - interval '28 days') AS rec,
               count(*) FILTER (WHERE p.criado_em < now() - interval '28 days') AS ant
        FROM pedidos p
        WHERE p.status <> 'canceled'
          AND p.criado_em >= now() - interval '56 days' {filtro_marca}
    """, params)[0]
    rec, ant = float(fator_q["rec"]), float(fator_q["ant"])
    fator = max(0.6, min(1.5, rec / ant)) if ant >= 20 else 1.0

    insumos = consultar(f"""
        WITH vendas AS (
            SELECT coalesce(a.canonico, lower(trim(i.nome))) AS produto,
                   sum(i.quantidade) / 4.0 AS por_semana
            FROM pedido_itens i
            JOIN pedidos p ON p.id = i.pedido_id
            LEFT JOIN produto_alias a ON a.alias = lower(trim(i.nome))
            WHERE p.status <> 'canceled'
              AND p.criado_em >= now() - interval '28 days'
              {filtro_marca}
            GROUP BY 1
        )
        SELECT f.insumo, f.unidade,
               round((sum(v.por_semana * f.qtd) * %(fator)s)::numeric, 2) AS necessidade
        FROM vendas v
        JOIN ficha_tecnica f ON f.produto = v.produto
        GROUP BY 1, 2
        ORDER BY (f.unidade = 'kg') DESC, 3 DESC
    """, {**params, "fator": fator})

    cobertura = consultar(f"""
        WITH vendas AS (
            SELECT coalesce(a.canonico, lower(trim(i.nome))) AS produto,
                   max(i.nome) AS nome_original,
                   sum(i.quantidade) AS qtd
            FROM pedido_itens i
            JOIN pedidos p ON p.id = i.pedido_id
            LEFT JOIN produto_alias a ON a.alias = lower(trim(i.nome))
            WHERE p.status <> 'canceled'
              AND p.criado_em >= now() - interval '28 days'
              {filtro_marca}
            GROUP BY 1
        )
        SELECT coalesce(round(100.0 * sum(v.qtd) FILTER (
                   WHERE EXISTS (SELECT 1 FROM ficha_tecnica f
                                 WHERE f.produto = v.produto)) / nullif(sum(v.qtd), 0), 0), 0) AS pct,
               array_to_string(array(
                   SELECT v2.nome_original || ' (' || v2.qtd::int || ')'
                   FROM vendas v2
                   WHERE NOT EXISTS (SELECT 1 FROM ficha_tecnica f
                                     WHERE f.produto = v2.produto)
                   ORDER BY v2.qtd DESC LIMIT 8), ', ') AS sem_ficha
        FROM vendas v
    """, params)[0]

    return {"insumos": insumos, "fator_tendencia": round(fator, 3),
            "cobertura_pct": float(cobertura["pct"]),
            "sem_ficha": cobertura["sem_ficha"],
            "marcas": consultar(
                "SELECT DISTINCT marca FROM pedidos WHERE marca IS NOT NULL ORDER BY 1", {})}


@app.get("/api/retencao")
def retencao_cohorts(marca: str = Query("todas"), unidade: str = Query("todas")):
    """Cohorts mensais: turma = mes da primeira compra; para cada mes
    seguinte, % da turma que voltou a comprar."""
    filtro_marca = ""
    params = {}
    if marca != "todas":
        filtro_marca = "AND p.marca = %(marca)s"
        params["marca"] = marca
    if unidade != "todas":
        filtro_marca += " AND p.unidade = %(unidade)s"
        params["unidade"] = unidade

    linhas = consultar(f"""
        WITH primeiro AS (
            SELECT p.cliente_id,
                   date_trunc('month', min(p.criado_em AT TIME ZONE '{TZ}'))::date AS cohort
            FROM pedidos p
            WHERE p.cliente_id IS NOT NULL AND p.status <> 'canceled' {filtro_marca}
            GROUP BY 1
        ),
        atividade AS (
            SELECT DISTINCT p.cliente_id,
                   date_trunc('month', p.criado_em AT TIME ZONE '{TZ}')::date AS mes
            FROM pedidos p
            WHERE p.cliente_id IS NOT NULL AND p.status <> 'canceled' {filtro_marca}
        )
        SELECT pr.cohort,
               ((extract(year FROM a.mes) - extract(year FROM pr.cohort)) * 12
                + (extract(month FROM a.mes) - extract(month FROM pr.cohort)))::int AS m,
               count(DISTINCT a.cliente_id) AS ativos
        FROM primeiro pr
        JOIN atividade a USING (cliente_id)
        GROUP BY 1, 2
        ORDER BY 1, 2
    """, params)

    mes_atual = consultar(
        f"SELECT date_trunc('month', now() AT TIME ZONE '{TZ}')::date AS m", {})[0]["m"]

    cohorts = {}
    for l in linhas:
        c = l["cohort"].isoformat()
        cohorts.setdefault(c, {"mes": c, "tamanho": 0, "meses": {}})
        cohorts[c]["meses"][int(l["m"])] = int(l["ativos"])
    for c in cohorts.values():
        c["tamanho"] = c["meses"].get(0, 0)
        c["retencao"] = [
            {"m": m, "ativos": a,
             "pct": round(100 * a / c["tamanho"], 1) if c["tamanho"] else 0}
            for m, a in sorted(c["meses"].items())
        ]
        del c["meses"]

    return {"cohorts": sorted(cohorts.values(), key=lambda x: x["mes"]),
            "mes_atual": mes_atual.isoformat(),
            "marcas": consultar(
                "SELECT DISTINCT marca FROM pedidos WHERE marca IS NOT NULL ORDER BY 1", {})}


# ====================== MENSAGENS PRONTAS PRO ZAP ======================

@app.get("/api/zap/radar")
def zap_radar():
    base_recorrentes = """
        WITH base AS (
            SELECT p.cliente_id,
                   count(*) FILTER (WHERE p.status <> 'canceled') AS pedidos,
                   coalesce(sum(p.total) FILTER (WHERE p.status <> 'canceled'), 0) AS gasto,
                   max(p.criado_em) FILTER (WHERE p.status <> 'canceled') AS ultimo
            FROM pedidos p WHERE p.cliente_id IS NOT NULL
            GROUP BY 1 HAVING count(*) FILTER (WHERE p.status <> 'canceled') >= 2
        )
    """

    sumidos_resumo = consultar(base_recorrentes + """
        SELECT count(*) AS clientes, coalesce(sum(gasto), 0) AS gasto
        FROM base WHERE ultimo < now() - interval '30 days'
    """, {})[0]
    n = int(sumidos_resumo["clientes"])

    sumidos_top5 = consultar(base_recorrentes + """
        SELECT b.cliente_id, c.nome, round(b.gasto, 2) AS gasto,
               extract(day FROM now() - b.ultimo)::int AS dias
        FROM base b JOIN clientes c ON c.id = b.cliente_id
        WHERE b.ultimo < now() - interval '30 days'
        ORDER BY b.gasto DESC LIMIT 5
    """, {})

    risco_base = base_recorrentes + """
        , intervalos AS (
            SELECT p.cliente_id,
                   extract(epoch FROM p.criado_em
                       - lag(p.criado_em) OVER (PARTITION BY p.cliente_id
                                                ORDER BY p.criado_em)) / 86400 AS dias
            FROM pedidos p
            WHERE p.cliente_id IS NOT NULL AND p.status <> 'canceled'
        ),
        media_cliente AS (
            SELECT cliente_id, avg(dias) AS intervalo_medio
            FROM intervalos WHERE dias IS NOT NULL
            GROUP BY cliente_id HAVING count(*) >= 2 AND avg(dias) >= 1
        ),
        em_risco AS (
            SELECT b.cliente_id, b.gasto, b.ultimo, c.nome, mc.intervalo_medio
            FROM base b
            JOIN clientes c ON c.id = b.cliente_id
            JOIN media_cliente mc ON mc.cliente_id = b.cliente_id
            WHERE extract(day FROM now() - b.ultimo) >= mc.intervalo_medio * 2
              AND b.ultimo >= now() - interval '30 days'
        )
    """
    n_risco = int(consultar(risco_base + "SELECT count(*) AS n FROM em_risco", {})[0]["n"])
    risco_top5 = consultar(risco_base + """
        SELECT cliente_id, nome, round(intervalo_medio) AS intervalo_medio,
               extract(day FROM now() - ultimo)::int AS dias
        FROM em_risco
        ORDER BY (extract(day FROM now() - ultimo) / intervalo_medio) DESC
        LIMIT 5
    """, {})

    # Primeira compra sem segunda: só quem tem telefone (sem contato nao da pra
    # agir) e ainda comprou faz pouco tempo (30d - depois disso cai na mesma
    # logica do resgate). Oferta sugerida pelo proprio ticket do pedido unico:
    # ticket alto aguenta desconto %, ticket medio ganha mais com frete gratis
    # (peso proporcional maior no pedido pequeno), ticket baixo so vale um mimo.
    def _oferta(gasto):
        if gasto >= 80:
            return "cupom de 15% na próxima"
        if gasto >= 40:
            return "frete grátis na próxima"
        return "brinde (refri ou batata) na próxima"

    primeira = consultar("""
        WITH agg AS (
            SELECT p.cliente_id,
                   count(*) FILTER (WHERE p.status <> 'canceled') AS pedidos,
                   coalesce(sum(p.total) FILTER (WHERE p.status <> 'canceled'), 0) AS gasto,
                   max(p.id) FILTER (WHERE p.status <> 'canceled') AS pedido_id,
                   max(p.criado_em) FILTER (WHERE p.status <> 'canceled') AS quando
            FROM pedidos p WHERE p.cliente_id IS NOT NULL
            GROUP BY 1 HAVING count(*) FILTER (WHERE p.status <> 'canceled') = 1
        )
        SELECT a.cliente_id, a.pedido_id, a.gasto, c.nome, c.telefone,
               extract(day FROM now() - a.quando)::int AS dias
        FROM agg a JOIN clientes c ON c.id = a.cliente_id
        WHERE a.quando >= now() - interval '30 days'
          AND c.telefone IS NOT NULL AND length(c.telefone) > 4
        ORDER BY a.gasto DESC LIMIT 5
    """, {})
    n_primeira = len(primeira)
    if n_primeira:
        pedido_ids = [p["pedido_id"] for p in primeira]
        itens_por_pedido = {}
        if pedido_ids:
            itens = consultar(
                "SELECT pedido_id, nome, total FROM pedido_itens "
                "WHERE pedido_id = ANY(%(ids)s) ORDER BY total DESC",
                {"ids": pedido_ids})
            for i in itens:
                itens_por_pedido.setdefault(i["pedido_id"], i["nome"])
        linhas_primeira = "\n".join(
            f"• {p['nome']} — pediu {itens_por_pedido.get(p['pedido_id'], 'algo')} há {p['dias']}d, "
            f"R$ {float(p['gasto']):.2f} → sugestão: {_oferta(float(p['gasto']))}"
            for p in primeira)

    if n == 0 and n_risco == 0 and n_primeira == 0:
        return {"enviar": False, "texto": ""}

    sumidos_top5_txt = "\n".join(
        f"• {r['nome']} — {r['dias']} dias, R$ {float(r['gasto']):.2f}" for r in sumidos_top5)
    risco_top5_txt = "\n".join(
        f"• {r['nome']} — costuma pedir a cada {int(r['intervalo_medio'])}d, já {r['dias']}d sem pedir"
        for r in risco_top5)

    # Grava quem foi mostrado agora pra depois medir quantos voltaram a comprar
    # (taxa de recuperacao abaixo) - sem precisar de nenhuma marcacao manual do time.
    for cid in [r["cliente_id"] for r in sumidos_top5]:
        executar("INSERT INTO radar_contatados (cliente_id, categoria) VALUES (%(c)s, 'sumido')", {"c": cid})
    for cid in [r["cliente_id"] for r in risco_top5]:
        executar("INSERT INTO radar_contatados (cliente_id, categoria) VALUES (%(c)s, 'risco')", {"c": cid})
    for cid in [p["cliente_id"] for p in primeira]:
        executar("INSERT INTO radar_contatados (cliente_id, categoria) "
                 "VALUES (%(c)s, 'primeira_sem_segunda')", {"c": cid})

    # Taxa de recuperacao: dos sinalizados ha 7+ dias (tempo minimo pra ter dado
    # pra agir e a pessoa reagir), quantos % fizeram um pedido novo depois disso.
    recuperacao = consultar("""
        SELECT count(*) AS sinalizados,
               count(*) FILTER (WHERE EXISTS (
                   SELECT 1 FROM pedidos p
                   WHERE p.cliente_id = rc.cliente_id AND p.status <> 'canceled'
                     AND p.criado_em > rc.sinalizado_em
               )) AS voltaram
        FROM radar_contatados rc
        WHERE rc.sinalizado_em <= now() - interval '7 days'
          AND rc.sinalizado_em >= now() - interval '60 days'
    """, {})[0]
    n_sinalizados = int(recuperacao["sinalizados"])

    partes = ["🚨 *Radar de clientes — Grupo Maracayá*"]
    if n > 0:
        partes.append(f"{n} clientes recorrentes estão há 30+ dias sem pedir.\n"
                       f"💰 Eles já deixaram *R$ {float(sumidos_resumo['gasto']):,.2f}* na chapa.\n\n"
                       f"*Top 5 pra resgatar:*\n{sumidos_top5_txt}")
    if n_risco > 0:
        partes.append(f"⚠️ *{n_risco} clientes em risco* — já passaram do próprio "
                       f"padrão de compra, ainda não sumiram mas estão atrasados:\n{risco_top5_txt}")
    if n_primeira > 0:
        partes.append(f"🎯 *{n_primeira} pediram só 1 vez* (ainda dá tempo, com telefone) "
                       f"— oferta sugerida pelo perfil de cada um:\n{linhas_primeira}")
    if n_sinalizados >= 5:
        pct = 100 * int(recuperacao["voltaram"]) / n_sinalizados
        partes.append(f"📈 *Taxa de recuperação (últimos 60 dias):* {pct:.0f}% dos "
                       f"{n_sinalizados} sinalizados em radares passados já voltaram a pedir")
    partes.append("👉 Lista completa com telefones: painel → Clientes")
    texto = "\n\n".join(partes).replace(",", "@").replace(".", ",").replace("@", ".")
    return {"enviar": True, "texto": texto}


_SEM_SKU_ESTOQUE = {"Refrigerante (genérico)", "Suco (genérico)", "Cerveja (genérica)"}


def _fmt_qtd_estoque(valor, un):
    if un == "kg":
        return f"{valor:.1f} kg"
    return f"{valor:.0f} g" if un == "g" else f"{valor:.0f} un"


def _posicao_estoque():
    """Separa os insumos em negativo / zerado / abaixo do minimo (com a rota do
    fornecedor: ate quando pedir ou quantos dias fica sem produto) / sem registro -
    usado pela MIA e pelo aviso de compras das 23h40."""
    ep = estoque_plano(cobertura_dias=30, seguranca_pct=20)
    negativos, zerados, criticos, sem_registro = [], [], [], []
    for i in ep["itens"]:
        if i["ciclo"]:
            continue
        if i["estoque"] is None:
            if i["insumo"] not in _SEM_SKU_ESTOQUE:
                sem_registro.append(i["insumo"])
            continue
        dias = i["estoque"] / i["consumo_dia"] if i["consumo_dia"] > 0 else 999
        if i["estoque"] < 0:
            negativos.append((i["insumo"], i["estoque"], i["unidade"]))
        elif i["estoque"] == 0:
            zerados.append(i["insumo"])
        elif i["abaixo_minimo"] or i["dias_sem_produto"] > 0:
            if i["dias_sem_produto"] > 0:
                rota = (f"⚠️ fica {i['dias_sem_produto']} dia(s) sem produto — "
                        f"próxima entrega {_fmt_data_rota(date.fromisoformat(i['proxima_entrega']))}")
            elif i["pedir_hoje"]:
                rota = "pedir HOJE"
            elif i["pedir_ate"]:
                rota = f"pedir até {_fmt_data_rota(date.fromisoformat(i['pedir_ate']))}"
            else:
                rota = ""
            criticos.append((i["insumo"], i["estoque"], i["unidade"], dias, rota))
    negativos.sort(key=lambda x: x[1])
    criticos.sort(key=lambda x: x[3])
    return negativos, zerados, criticos, sem_registro


@app.get("/api/zap/sentinela")
def zap_sentinela():
    s = sentinela()
    if s["status"] not in ("critico", "atencao"):
        return {"enviar": False, "texto": ""}
    icone = "🔴" if s["status"] == "critico" else "🟠"
    corpo = "\n\n".join(
        f"{a['icone']} {a['texto']}" + (f"\n💡 {a['dica']}" if a.get("dica") else "")
        for a in s["alertas"] if a["nivel"] in ("critico", "atencao"))
    return {"enviar": True,
            "texto": f"{icone} *Sentinela — Grupo Maracayá*\n\n{corpo}"}


@app.get("/api/zap/fechamento")
def zap_fechamento():
    tzc = f"(p.criado_em AT TIME ZONE '{TZ}')"
    agora = f"(now() AT TIME ZONE '{TZ}')"
    d = consultar(f"""
        WITH hoje AS (
            SELECT count(*) FILTER (WHERE p.status <> 'canceled') AS pedidos,
                   coalesce(sum(p.total) FILTER (WHERE p.status <> 'canceled'), 0) AS fat,
                   coalesce(avg(p.total) FILTER (WHERE p.status <> 'canceled'), 0) AS ticket,
                   count(*) FILTER (WHERE p.status = 'canceled') AS canc
            FROM pedidos p WHERE {tzc}::date = {agora}::date
        ),
        hist AS (
            SELECT {tzc}::date AS dia, count(*) AS n
            FROM pedidos p
            WHERE p.status <> 'canceled'
              AND {tzc}::date >= {agora}::date - 56
              AND {tzc}::date < {agora}::date
              AND extract(dow FROM {tzc}) = extract(dow FROM {agora})
            GROUP BY 1
        )
        SELECT h.*, coalesce((SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY n)
                              FROM hist), 0) AS tipico
        FROM hoje h
    """, {})[0]
    top = consultar(f"""
        SELECT i.nome, sum(i.quantidade)::int AS q
        FROM pedido_itens i JOIN pedidos p ON p.id = i.pedido_id
        WHERE p.status <> 'canceled' AND {tzc}::date = {agora}::date
        GROUP BY 1 ORDER BY 2 DESC LIMIT 3
    """, {})
    ped, tip = float(d["pedidos"]), float(d["tipico"])
    comp = ""
    if tip > 0:
        pct = 100 * (ped - tip) / tip
        comp = f" ({'▲' if pct >= 0 else '▼'} {abs(pct):.0f}% vs o típico desse dia)"
    linhas_top = "\n".join(f"  {i+1}. {t['nome']} ({t['q']})" for i, t in enumerate(top))
    def brl(v):
        return f"R$ {v:,.2f}".replace(",", "@").replace(".", ",").replace("@", ".")
    texto = (f"🌙 *Fechamento do dia — Grupo Maracayá*\n\n"
             f"🧾 Pedidos: *{ped:.0f}*{comp}\n"
             f"💰 Faturamento: *{brl(float(d['fat']))}*\n"
             f"🎯 Ticket médio: {brl(float(d['ticket']))}\n"
             + (f"🚫 Cancelamentos: {float(d['canc']):.0f}\n" if float(d['canc']) > 0 else "")
             + (f"\n🏆 *Campeões do dia:*\n{linhas_top}" if top else ""))
    return {"enviar": True, "texto": texto}


@app.get("/api/zap/estoque")
def zap_estoque():
    """Aviso diario de compras pendentes - automacao separada do fechamento do
    dia, pra nao misturar o resumo de vendas com o alerta de reposicao."""
    from datetime import timedelta
    negativos, zerados, criticos, sem_registro = _posicao_estoque()

    # hortifruti: na vespera da troca, avisa quanto vai ser preciso ate a proxima
    bloco_troca = None
    hoje = consultar(f"SELECT (now() AT TIME ZONE '{TZ}')::date AS d", {})[0]["d"]
    amanha = hoje + timedelta(days=1)
    idx = _troca_idx()
    if amanha.weekday() in idx:
        _, dias_ciclo = _ciclo_troca(amanha, idx)
        seg_ = 1.2
        linhas_h = []
        for i in estoque_plano(cobertura_dias=30, seguranca_pct=20)["itens"]:
            if i["ciclo"] and i["consumo_dia"] > 0:
                qtd = i["consumo_dia"] * dias_ciclo * seg_
                linhas_h.append(f"• {i['insumo']}: ~{-(-qtd // 1):.0f} {i['unidade']}")
        if linhas_h:
            bloco_troca = (f"🥬 *Amanhã ({_fmt_data_rota(amanha)}) é dia de troca — hortifruti*\n"
                           f"Previsão até a próxima troca ({dias_ciclo} dia(s), já com folga de 20%):\n"
                           + "\n".join(linhas_h))

    if not negativos and not zerados and not criticos and not bloco_troca:
        return {"enviar": False, "texto": ""}
    if not negativos and not zerados and not criticos:
        return {"enviar": True, "texto": f"📦 *Compras — Grupo Maracayá*\n\n{bloco_troca}"}

    partes = ["📦 *Precisa repor — Grupo Maracayá*"]
    if negativos:
        linhas = "\n".join(f"• {nome}: {_fmt_qtd_estoque(qtd, un)}" for nome, qtd, un in negativos)
        partes.append(f"🔴 *Negativo — já deveria ter sido reposto:*\n{linhas}")
    if zerados:
        partes.append("🟠 *Zerado:* " + ", ".join(zerados))
    if criticos:
        linhas = "\n".join(f"• {nome}: {_fmt_qtd_estoque(qtd, un)} (~{dias:.1f} dia(s)) — {rota}"
                           for nome, qtd, un, dias, rota in criticos)
        partes.append(f"🟡 *Abaixo do mínimo:*\n{linhas}")
    if sem_registro:
        partes.append("❓ *Sem estoque cadastrado:* " + ", ".join(sem_registro[:10]))
    if bloco_troca:
        partes.append(bloco_troca)
    return {"enviar": True, "texto": "\n\n".join(partes)}


@app.get("/api/zap/bomdia")
def zap_bomdia():
    tzc = f"(p.criado_em AT TIME ZONE '{TZ}')"
    agora = f"(now() AT TIME ZONE '{TZ}')"
    sem = f"date_trunc('week', {agora})::date"
    d = consultar(f"""
        SELECT
            count(*) FILTER (WHERE {tzc}::date >= {sem} - 7 AND {tzc}::date < {sem}
                             AND p.status <> 'canceled') AS ped,
            coalesce(sum(p.total) FILTER (WHERE {tzc}::date >= {sem} - 7
                AND {tzc}::date < {sem} AND p.status <> 'canceled'), 0) AS fat,
            count(*) FILTER (WHERE {tzc}::date >= {sem} - 14 AND {tzc}::date < {sem} - 7
                             AND p.status <> 'canceled') AS ped_ant,
            coalesce(sum(p.total) FILTER (WHERE {tzc}::date >= {sem} - 14
                AND {tzc}::date < {sem} - 7 AND p.status <> 'canceled'), 0) AS fat_ant
        FROM pedidos p
    """, {})[0]
    marcas = consultar(f"""
        SELECT p.marca, count(*) AS ped, coalesce(sum(p.total), 0) AS fat
        FROM pedidos p
        WHERE p.status <> 'canceled' AND p.marca IS NOT NULL
          AND {tzc}::date >= {sem} - 7 AND {tzc}::date < {sem}
        GROUP BY 1 ORDER BY 3 DESC
    """, {})
    dias = consultar(f"""
        SELECT to_char({tzc}, 'TMDay') AS dia, coalesce(sum(p.total), 0) AS fat
        FROM pedidos p
        WHERE p.status <> 'canceled'
          AND {tzc}::date >= {sem} - 7 AND {tzc}::date < {sem}
        GROUP BY 1, extract(dow FROM {tzc}) ORDER BY 2 DESC
    """, {})
    def brl(v):
        return f"R$ {v:,.2f}".replace(",", "@").replace(".", ",").replace("@", ".")
    fat, fat_ant = float(d["fat"]), float(d["fat_ant"])
    comp = ""
    if fat_ant > 0:
        pct = 100 * (fat - fat_ant) / fat_ant
        comp = f" ({'▲' if pct >= 0 else '▼'} {abs(pct):.0f}% vs semana anterior)"
    linhas_marca = "\n".join(f"  • {m['marca']}: {brl(float(m['fat']))} ({int(m['ped'])} pedidos)"
                              for m in marcas)
    forte = dias[0]["dia"].strip() if dias else "—"
    fraco = dias[-1]["dia"].strip() if len(dias) > 1 else "—"
    texto = (f"☀️ *Bom dia, CEO! Semana fechada — Grupo Maracayá*\n\n"
             f"💰 Faturamento: *{brl(fat)}*{comp}\n"
             f"🧾 Pedidos: {float(d['ped']):.0f}\n\n"
             f"*Por marca:*\n{linhas_marca}\n\n"
             f"🥇 Melhor dia: {forte}\n📉 Dia mais fraco: {fraco}\n\n"
             f"Boa semana! 🔥 Detalhes no painel.")
    return {"enviar": True, "texto": texto}


@app.get("/api/zap/cmv")
def zap_cmv():
    sem_custo = consultar("""
        SELECT max(i.nome) AS nome, sum(i.quantidade)::int AS q
        FROM pedido_itens i
        JOIN pedidos p ON p.id = i.pedido_id
        LEFT JOIN produto_alias a ON a.alias = lower(trim(i.nome))
        LEFT JOIN produto_custos c ON c.nome = coalesce(a.canonico, lower(trim(i.nome)))
        WHERE p.status <> 'canceled' AND p.criado_em >= now() - interval '30 days'
          AND c.nome IS NULL
        GROUP BY lower(trim(i.nome)) ORDER BY 2 DESC LIMIT 10
    """, {})
    antigos = consultar("""
        SELECT count(*) AS n FROM produto_custos
        WHERE atualizado_em < now() - interval '60 days'
    """, {})[0]
    if not sem_custo and int(antigos["n"]) == 0:
        return {"enviar": False, "texto": ""}
    partes = ["🧾 *Revisão de custos (CMV) — Grupo Maracayá*"]
    if sem_custo:
        lista = "\n".join(f"  • {x['nome']} ({x['q']} vendidos)" for x in sem_custo)
        partes.append(f"*Vendendo sem custo cadastrado:*\n{lista}")
    if int(antigos["n"]) > 0:
        partes.append(f"⏳ {int(antigos['n'])} produtos com custo cadastrado há 60+ dias — "
                      f"insumo mudou de preço? Atualiza a ficha que o quadrante agradece.")
    partes.append("👉 Cadastro direto no painel → Cardápio")
    return {"enviar": True, "texto": "\n\n".join(partes)}


@app.post("/api/zap/pergunta")
def zap_pergunta(payload: dict = Body(...),
                 grupo: str = Query(...), dono: str = Query(...),
                 dono_lid: str = Query(None)):
    """Assistente do grupo: recebe o webhook da Evolution, responde perguntas
    quando o contato da loja e mencionado no grupo configurado.
    A Evolution manda o contextInfo na raiz do "data" (nao dentro de
    message.extendedTextMessage) e as vezes menciona por LID em vez de
    numero de telefone - por isso checamos os dois formatos e os dois campos."""
    data = payload.get("data") or payload.get("body", {}).get("data") or {}
    key = data.get("key", {})
    remote = key.get("remoteJid", "")
    if key.get("fromMe") or remote != grupo:
        return {"enviar": False, "texto": ""}

    msg = data.get("message", {}) or {}
    texto = (msg.get("conversation")
             or (msg.get("extendedTextMessage") or {}).get("text") or "")
    ctx = (data.get("contextInfo")
           or (msg.get("extendedTextMessage") or {}).get("contextInfo")
           or {})
    mencionados = ctx.get("mentionedJid") or []
    dono_num = dono.split("@")[0]
    dono_lid_num = dono_lid.split("@")[0] if dono_lid else None
    mencionou_dono = any(dono_num in m for m in mencionados) or (
        dono_lid_num and any(dono_lid_num in m for m in mencionados))
    if not mencionou_dono:
        return {"enviar": False, "texto": ""}

    q = texto.lower()

    # ----- unidade e marca -----
    def _sem_acento(s):
        return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii").lower()

    _DIAS_SEMANA_MIA = [
        (("segunda-feira", "segunda"), 0, "segunda-feira", "na"),
        (("terca-feira", "terca"), 1, "terça-feira", "na"),
        (("quarta-feira", "quarta"), 2, "quarta-feira", "na"),
        (("quinta-feira", "quinta"), 3, "quinta-feira", "na"),
        (("sexta-feira", "sexta"), 4, "sexta-feira", "na"),
        (("sabado",), 5, "sábado", "no"),
        (("domingo",), 6, "domingo", "no"),
    ]

    def _dia_semana_match(q_sa):
        for aliases, offset, nome_bonito, artigo in _DIAS_SEMANA_MIA:
            if any(a in q_sa for a in aliases):
                return offset, nome_bonito, artigo
        return None

    def _resolver_data(trecho_sa, hoje_d):
        """Tenta achar uma data especifica num trecho de texto sem acento:
        dd/mm, um numero de dia solto (mes/ano atual), dia da semana
        (com ou sem 'passada'), hoje ou ontem. Devolve None se nao achar."""
        m = re.search(r"\b([0-3]?\d)/([01]?\d)\b", trecho_sa)
        if m:
            d, mth = int(m.group(1)), int(m.group(2))
            try:
                return date(hoje_d.year, mth, d)
            except ValueError:
                return None
        m = re.search(r"\b([0-3]?\d)\b", trecho_sa)
        if m:
            try:
                return date(hoje_d.year, hoje_d.month, int(m.group(1)))
            except ValueError:
                return None
        achado = _dia_semana_match(trecho_sa)
        if achado is not None:
            offset, _, _ = achado
            segunda_semana = hoje_d - timedelta(days=hoje_d.isoweekday() - 1)
            base = segunda_semana + timedelta(days=offset)
            if "passad" in trecho_sa:
                base -= timedelta(days=7)
            return base
        if "hoje" in trecho_sa:
            return hoje_d
        if "ontem" in trecho_sa:
            return hoje_d - timedelta(days=1)
        return None

    _MESES_PT = [("janeiro", 1), ("fevereiro", 2), ("marco", 3), ("abril", 4),
                 ("maio", 5), ("junho", 6), ("julho", 7), ("agosto", 8),
                 ("setembro", 9), ("outubro", 10), ("novembro", 11), ("dezembro", 12)]

    def _mes_citado(q_sa):
        for nome, num in _MESES_PT:
            if re.search(rf"\b{nome}\b", q_sa):
                return nome, num
        return None

    unidades_disp = [row["unidade"] for row in consultar(
        "SELECT DISTINCT unidade FROM pedidos WHERE unidade IS NOT NULL "
        "AND unidade <> 'Chomp' ORDER BY 1", {})]
    marcas_disp = [row["marca"] for row in consultar(
        "SELECT DISTINCT marca FROM pedidos WHERE marca IS NOT NULL ORDER BY 1", {})]

    q_sem_acento = _sem_acento(q)

    # ----- memoria curta (continuacao de pergunta, ate 20min, por grupo) -----
    # Se a mensagem nova nao traz marca/unidade, periodo ou intencao reconheciveis,
    # reaproveita o que foi resolvido na ultima pergunta desse grupo, "colando" as
    # palavras-chave que faltam no texto antes de rodar o resto da analise - assim
    # todo o parser de periodo/filtro/intencao roda igual, sem duplicar logica.
    ctx_rows = consultar(
        "SELECT marca, unidade, periodo_frase, intent_keyword FROM mia_contexto "
        "WHERE grupo = %(g)s AND atualizado_em > now() - interval '20 minutes'",
        {"g": grupo})
    ctx = ctx_rows[0] if ctx_rows else None
    memoria_usada = []

    if ctx:
        tem_marca_unidade = (
            any(_sem_acento(u) in q_sem_acento for u in unidades_disp)
            or any(_sem_acento(m.split()[0]) in q_sem_acento for m in marcas_disp))
        tem_periodo = bool(
            "hoje" in q_sem_acento or "ontem" in q_sem_acento or "semana" in q_sem_acento
            or "mes" in q_sem_acento or _mes_citado(q_sem_acento)
            or _dia_semana_match(q_sem_acento))
        tem_intent = bool(
            "compar" in q_sem_acento
            or re.search(r"\bsumid\w*\b", q_sem_acento) or "resgate" in q_sem_acento
            or ("client" in q_sem_acento and any(
                w in q_sem_acento for w in ("telefone", "celular", "whatsapp", "contato", "fone")))
            or re.search(r"\bconsum\w*\b", q_sem_acento)
            or (re.search(r"\b(uso|usa|usamos|gasto|gasta|gastamos|preciso|precisa)\b", q_sem_acento)
                and any(p in q_sem_acento for p in ("quant", "media", "total")))
            or "meta" in q_sem_acento or "ticket" in q_sem_acento or "cancel" in q_sem_acento
            or any(p in q_sem_acento for p in ("fatur", "vendeu", "venda", "quanto fez", "receita"))
            or "pedido" in q_sem_acento
            or any(p in q_sem_acento for p in ("tempo de entrega", "tempo medio", "demora", "quanto tempo"))
            or any(p in q_sem_acento for p in ("estoque", "insumo", "posicao")))

        reforco = []
        if not tem_marca_unidade and (ctx["marca"] or ctx["unidade"]):
            if ctx["marca"]:
                reforco.append(_sem_acento(ctx["marca"].split()[0]))
            if ctx["unidade"]:
                reforco.append(_sem_acento(ctx["unidade"]))
            memoria_usada.append(" · ".join(x for x in (ctx["marca"], ctx["unidade"]) if x))
        if not tem_periodo and ctx["periodo_frase"]:
            reforco.append(ctx["periodo_frase"])
            memoria_usada.append(ctx["periodo_frase"])
        if not tem_intent and ctx["intent_keyword"]:
            reforco.append(ctx["intent_keyword"])
            memoria_usada.append(ctx["intent_keyword"])

        if reforco:
            q = q + " " + " ".join(reforco)
            q_sem_acento = q_sem_acento + " " + " ".join(reforco)

    unidade_d = next((u for u in unidades_disp if _sem_acento(u) in q_sem_acento), None)
    marca_d = next((m for m in marcas_disp if _sem_acento(m.split()[0]) in q_sem_acento), None)

    filtro_extra = ""
    params_extra = {}
    if marca_d:
        filtro_extra += " AND p.marca = %(marca_d)s"
        params_extra["marca_d"] = marca_d
    if unidade_d:
        filtro_extra += " AND p.unidade = %(unidade_d)s"
        params_extra["unidade_d"] = unidade_d
    partes_filtro = [x for x in (marca_d, unidade_d) if x]
    filtro_txt = f" _({' · '.join(partes_filtro)})_" if partes_filtro else ""

    # ----- periodo -----
    # Reconhece qualquer mencao de data: hoje/ontem, semana (atual/passada/
    # retrasada), mes (atual/passado/retrasado) e qualquer mes citado pelo nome
    # (esse ano, ou o ano passado se o mes citado ainda nao chegou este ano).

    agora = f"(now() AT TIME ZONE '{TZ}')"
    dia = f"(p.criado_em AT TIME ZONE '{TZ}')::date"
    mes_citado = _mes_citado(q_sem_acento)
    retrasada = "retrasad" in q_sem_acento
    passada = "passad" in q_sem_acento

    periodo_frase = None  # frase canonica pra memoria curta; None = nao vale a pena guardar
    if "hoje" in q_sem_acento:
        cond, rotulo, periodo_frase = f"{dia} = {agora}::date", "hoje", "hoje"
    elif "ontem" in q_sem_acento:
        cond, rotulo, periodo_frase = f"{dia} = {agora}::date - 1", "ontem", "ontem"
    elif "semana" in q_sem_acento and retrasada:
        cond = (f"{dia} >= date_trunc('week', {agora})::date - 14 "
                f"AND {dia} < date_trunc('week', {agora})::date - 7")
        rotulo, periodo_frase = "na semana retrasada", "semana retrasada"
    elif "semana" in q_sem_acento and passada:
        cond = (f"{dia} >= date_trunc('week', {agora})::date - 7 "
                f"AND {dia} < date_trunc('week', {agora})::date")
        rotulo, periodo_frase = "na semana passada", "semana passada"
    elif "semana" in q_sem_acento:
        cond, rotulo, periodo_frase = f"{dia} >= date_trunc('week', {agora})::date", "nesta semana", "semana"
    elif mes_citado and _dia_semana_match(q_sem_acento) is None:
        nome_mes, num_mes = mes_citado
        hoje_d = consultar(f"SELECT {agora}::date AS d", {})[0]["d"]
        ano = hoje_d.year if num_mes <= hoje_d.month else hoje_d.year - 1
        cond = (f"{dia} >= date '{ano}-{num_mes:02d}-01' "
                f"AND {dia} < (date '{ano}-{num_mes:02d}-01' + interval '1 month')::date")
        rotulo, periodo_frase = f"em {nome_mes.capitalize()}/{ano}", nome_mes
    elif "mes" in q_sem_acento and retrasada:
        cond = (f"{dia} >= (date_trunc('month', {agora}) - interval '2 month')::date "
                f"AND {dia} < (date_trunc('month', {agora}) - interval '1 month')::date")
        rotulo, periodo_frase = "no mês retrasado", "mes retrasado"
    elif "mes" in q_sem_acento and passada:
        cond = (f"{dia} >= (date_trunc('month', {agora}) - interval '1 month')::date "
                f"AND {dia} < date_trunc('month', {agora})::date")
        rotulo, periodo_frase = "no mês passado", "mes passado"
    elif _dia_semana_match(q_sem_acento) is not None:
        offset, nome_bonito, artigo = _dia_semana_match(q_sem_acento)
        recuo = 14 if retrasada else (7 if passada else 0)
        if retrasada:
            sufixo = " retrasada" if artigo == "na" else " retrasado"
        elif passada:
            sufixo = " passada" if artigo == "na" else " passado"
        else:
            sufixo = ""
        cond = f"{dia} = date_trunc('week', {agora})::date + {offset} - {recuo}"
        rotulo = f"{artigo} {nome_bonito}{sufixo}"
        periodo_frase = _sem_acento(nome_bonito) + sufixo
    else:
        cond, rotulo = f"{dia} >= date_trunc('month', {agora})::date", "no mês (até agora)"

    def brl(v):
        return f"R$ {v:,.2f}".replace(",", "@").replace(".", ",").replace("@", ".")

    r = consultar(f"""
        SELECT count(*) FILTER (WHERE p.status <> 'canceled') AS pedidos,
               coalesce(sum(p.total) FILTER (WHERE p.status <> 'canceled'), 0) AS fat,
               coalesce(avg(p.total) FILTER (WHERE p.status <> 'canceled'), 0) AS ticket,
               count(*) FILTER (WHERE p.status = 'canceled') AS canc
        FROM pedidos p WHERE {cond} {filtro_extra}
    """, params_extra)[0]

    aviso_filtro = (" (ainda não sei filtrar essa pergunta por unidade/marca)"
                    if partes_filtro else "")

    # ----- intencao -----
    intent_keyword = None
    if "compar" in q_sem_acento:
        hoje_d = consultar(f"SELECT {agora}::date AS d", {})[0]["d"]
        trecho = re.sub(r"@\S+", "", q_sem_acento)
        trecho = re.sub(r"\bcompar\w*\b", "", trecho).strip()
        lados = re.split(r"\s+(?:e|vs|versus|com|x)\s+", trecho)
        data_a = _resolver_data(lados[0], hoje_d) if len(lados) >= 1 else None
        data_b = _resolver_data(lados[1], hoje_d) if len(lados) >= 2 else None
        if not data_a or not data_b:
            resposta = ("🤔 Não consegui entender as duas datas pra comparar. "
                        "Tenta algo tipo: _compare domingo 23 com domingo 30_ "
                        "ou _compare segunda passada e essa segunda_")
        else:
            def _metricas_dia(d):
                return consultar(f"""
                    SELECT count(*) FILTER (WHERE p.status <> 'canceled') AS pedidos,
                           coalesce(sum(p.total) FILTER (WHERE p.status <> 'canceled'), 0) AS fat
                    FROM pedidos p
                    WHERE (p.criado_em AT TIME ZONE '{TZ}')::date = %(d)s {filtro_extra}
                """, {**params_extra, "d": d})[0]
            ma, mb = _metricas_dia(data_a), _metricas_dia(data_b)
            fat_a, fat_b = float(ma["fat"]), float(mb["fat"])
            if fat_a > 0:
                delta = 100 * (fat_b - fat_a) / fat_a
            else:
                delta = 100.0 if fat_b > 0 else 0.0
            seta = "🔼" if fat_b >= fat_a else "🔽"
            resposta = (f"📊 *Comparativo{filtro_txt}*\n\n"
                        f"{data_a.strftime('%d/%m')}: {brl(fat_a)} · {int(ma['pedidos'])} pedidos\n"
                        f"{data_b.strftime('%d/%m')}: {brl(fat_b)} · {int(mb['pedidos'])} pedidos\n\n"
                        f"{seta} {abs(delta):.0f}% "
                        f"{'a mais' if fat_b >= fat_a else 'a menos'} em {data_b.strftime('%d/%m')}")
    elif any(p in q_sem_acento for p in ("preciso comprar", "o que comprar", "que comprar", "sugestao de compra",
                                         "o que pedir", "lista de compra", "o que devo comprar",
                                         "o que precisa comprar", "o que tenho que comprar")):
        intent_keyword = "compras"
        resposta = _texto_sugestao(sugestao_compra(30, 20, 7), completo=True)
    elif re.search(r"\bsumid\w*\b", q_sem_acento) or "resgate" in q_sem_acento:
        intent_keyword = "sumido"
        s = zap_radar()
        resposta = s["texto"] if s["enviar"] else "✅ Nenhum cliente recorrente sumido há 30+ dias. Base quente!"
        resposta += aviso_filtro
    elif "client" in q_sem_acento and any(
            w in q_sem_acento for w in ("telefone", "celular", "whatsapp", "contato", "fone")):
        intent_keyword = "clientes telefone"
        filtro_cli = ("AND EXISTS (SELECT 1 FROM pedidos p WHERE p.cliente_id = c.id "
                      f"{filtro_extra})") if filtro_extra else ""
        tem_tel = "length(regexp_replace(coalesce(c.telefone, ''), '\\D', '', 'g')) >= 8"
        tot = consultar(f"""
            SELECT count(*) FILTER (WHERE {tem_tel}) AS com,
                   count(*) FILTER (WHERE NOT ({tem_tel})) AS sem
            FROM clientes c WHERE true {filtro_cli}
        """, params_extra)[0]
        com_n, sem_n = int(tot["com"]), int(tot["sem"])
        base_n = com_n + sem_n

        def _lista(condicao, mostra_fone):
            linhas = consultar(f"""
                SELECT c.nome, c.telefone, c.total_pedidos, c.total_gasto
                FROM clientes c WHERE {condicao} {filtro_cli}
                ORDER BY c.total_gasto DESC NULLS LAST LIMIT 10
            """, params_extra)
            return "\n".join(
                f"• {(l['nome'] or 'sem nome').title()}"
                + (f" — {l['telefone']}" if mostra_fone else "")
                + f" · {int(l['total_pedidos'] or 0)} ped · {brl(float(l['total_gasto'] or 0))}"
                for l in linhas) or "—"

        pct = lambda n: (100 * n / base_n) if base_n else 0
        resposta = (f"📇 *Clientes e telefone{filtro_txt}*\n"
                    f"Base: {base_n} clientes\n\n"
                    f"📞 *Com telefone: {com_n}* ({pct(com_n):.0f}%) — top 10 por gasto:\n"
                    f"{_lista(tem_tel, True)}\n\n"
                    f"🚫 *Sem telefone: {sem_n}* ({pct(sem_n):.0f}%) — top 10 por gasto:\n"
                    f"{_lista('NOT (' + tem_tel + ')', False)}\n\n"
                    "👉 Lista completa: painel → Clientes")
    elif (re.search(r"\bconsum\w*\b", q_sem_acento)
           or (re.search(r"\b(uso|usa|usamos|gasto|gasta|gastamos|preciso|precisa)\b", q_sem_acento)
               and any(p in q_sem_acento for p in ("quant", "media", "total")))):
        intent_keyword = "consumo"
        # ---- consumo de insumos (vendas x ficha tecnica): total do periodo ou media por dia da semana ----
        achado_dia = _dia_semana_match(q_sem_acento)
        # "domingo passado/retrasado" nomeia UM domingo especifico (total daquele
        # dia); "domingo" sozinho pede a media historica dos domingos.
        pede_total = ("total" in q_sem_acento or mes_citado is not None
                      or (achado_dia is not None and (passada or retrasada))
                      or (achado_dia is None and any(
                          p in q_sem_acento for p in ("semana", "hoje", "ontem", "mes"))))
        JANELA_DIAS = 56

        if achado_dia and pede_total:
            filtro_periodo = f"AND {cond}"
        elif achado_dia:
            filtro_periodo = (f"AND extract(isodow FROM {dia}) = {achado_dia[0] + 1} "
                              f"AND p.criado_em >= now() - interval '{JANELA_DIAS} days' AND {dia} < {agora}::date")
        elif pede_total:
            filtro_periodo = f"AND {cond}"
        else:
            filtro_periodo = f"AND p.criado_em >= now() - interval '{JANELA_DIAS} days' AND {dia} < {agora}::date"

        rows = consultar(f"""
            WITH base AS (
                SELECT {dia} AS d, i.id AS item_id, i.quantidade,
                       coalesce(a.canonico, lower(trim(i.nome))) AS produto
                FROM pedido_itens i
                JOIN pedidos p ON p.id = i.pedido_id
                LEFT JOIN produto_alias a ON a.alias = lower(trim(i.nome))
                WHERE p.status <> 'canceled' {filtro_periodo} {filtro_extra}
            ),
            receita AS (
                SELECT b.d, f.insumo, f.unidade,
                       CASE WHEN {_BEBIDA_ESCOLHIDA} AND f.insumo IN ({_SODAS})
                            THEN greatest(b.quantidade * f.qtd - coalesce((
                                     SELECT sum(coalesce(co.quantidade, 1)) FROM pedido_complementos co
                                     WHERE co.pedido_item_id = b.item_id AND {_CASE_REFRI} IS NOT NULL), 0), 0)
                            ELSE b.quantidade * f.qtd END AS consumo,
                       f.qtd AS porcao
                FROM base b
                JOIN ficha_tecnica f ON f.produto = b.produto
            ),
            refri_real AS (
                SELECT b.d, {_CASE_REFRI} AS insumo, 'un' AS unidade,
                       coalesce(co.quantidade, 1) AS consumo, 1::numeric AS porcao
                FROM base b
                JOIN pedido_complementos co ON co.pedido_item_id = b.item_id
                WHERE {_BEBIDA_ESCOLHIDA} AND {_CASE_REFRI} IS NOT NULL
            )
            , molho_extra AS (
                SELECT b.d, {_CASE_MOLHO} AS insumo, 'g' AS unidade,
                       coalesce(co.quantidade, 1) * {_GRAMAS_POTE_MOLHO} AS consumo,
                       {_GRAMAS_POTE_MOLHO}::numeric AS porcao
                FROM base b
                JOIN pedido_complementos co ON co.pedido_item_id = b.item_id
                WHERE {_CASE_MOLHO} IS NOT NULL
                UNION ALL
                SELECT b.d, 'Nuggets', 'un', b.quantidade * {_CASE_NUGGET}, 1::numeric
                FROM base b JOIN pedido_complementos co ON co.pedido_item_id = b.item_id
                WHERE b.produto = 'nuggets' AND {_CASE_NUGGET} IS NOT NULL
                UNION ALL
                SELECT b.d, {_CASE_REFRI}, 'un', b.quantidade * coalesce(co.quantidade, 1), 1::numeric
                FROM base b JOIN pedido_complementos co ON co.pedido_item_id = b.item_id
                WHERE b.produto = '{_PRODUTO_AGUA_ESCOLHA}' AND {_CASE_REFRI} IS NOT NULL
            ), adicionais AS (
                SELECT b.d, a.insumo, a.unidade, coalesce(co.quantidade, 1) * a.qtd AS consumo, a.qtd AS porcao
                FROM base b JOIN pedido_complementos co ON co.pedido_item_id = b.item_id
                JOIN adicional_insumo a ON a.complemento = lower(trim(co.nome))
                WHERE NOT (a.so_fora_combo AND b.produto ILIKE 'combo%%')
            )
            SELECT d, insumo, unidade, sum(consumo) AS consumo, min(porcao) AS porcao
            FROM (SELECT * FROM receita UNION ALL SELECT * FROM refri_real
                  UNION ALL SELECT * FROM molho_extra UNION ALL SELECT * FROM adicionais) t
            GROUP BY 1, 2, 3
        """, params_extra)
        n_dias = len({r_["d"] for r_ in rows})

        if achado_dia and not pede_total:
            o_, nb, art_ = achado_dia
            plural = nb.replace("-feira", "s-feiras") if "-feira" in nb else nb + "s"
            titulo = f"📦 *Consumo médio {art_} {nb}*{filtro_txt}"
            periodo_txt = f"últimas {JANELA_DIAS // 7} semanas: {n_dias} {plural} com vendas"
        elif achado_dia and pede_total:
            titulo = f"📦 *Total consumido {rotulo}*{filtro_txt}"
            periodo_txt = f"{n_dias} dia(s) com vendas nessa data"
        elif pede_total:
            titulo = f"📦 *Total consumido {rotulo}*{filtro_txt}"
            periodo_txt = f"{n_dias} dia(s) com vendas {rotulo}"
        else:
            titulo = f"📦 *Consumo médio por dia*{filtro_txt}"
            periodo_txt = f"últimos {JANELA_DIAS} dias ({n_dias} dias com vendas)"

        agreg = {}
        for r_ in rows:
            a_ = agreg.setdefault(r_["insumo"], {"un": r_["unidade"], "tot": 0.0, "max": 0.0,
                                                  "porcao": float(r_["porcao"])})
            v_ = float(r_["consumo"])
            a_["tot"] += v_
            a_["max"] = max(a_["max"], v_)

        # filtro por insumo citado na pergunta (carne, batata, queijo...)
        _stop = {"mia", "uso", "usa", "por", "que", "dia", "com", "sem", "quantas", "quantos",
                 "quanto", "quanta", "media", "consumo", "gasto", "gasta", "preciso", "precisa",
                 "usamos", "gastamos", "consumimos", "consome", "hoje", "ontem", "semana", "insumo",
                 "insumos", "todos", "todas", "para", "vez", "tem", "fica", "quais", "qual",
                 "total", "totais", "mes", "passada", "passado", "essa", "esse", "nessa", "nesse"}
        tokens = [t for t in re.findall(r"[a-z]+", re.sub(r"@\S+", "", q_sem_acento))
                  if len(t) >= 3 and t not in _stop and _dia_semana_match(t) is None]

        def _variantes(t):
            v = {t}
            if t.endswith("s"):
                v.add(t[:-1])
            if t.endswith(("aes", "oes")):
                v.add(t[:-3] + "ao")
            return v

        nomes_ok = {n_: _sem_acento(n_) for n_ in agreg}
        # "molho" tambem vale pras maioneses (sao molhos de lanche, controlados em g)
        tokens_busca = tokens + (["maionese"] if any(t.startswith("molho") for t in tokens) else [])
        filtrados = {n_ for n_, ns in nomes_ok.items()
                     if any(vv in ns for t in tokens_busca for vv in _variantes(t))}
        escolhidos = filtrados if filtrados else set(agreg)

        def _fmt_num(x, casas):
            return f"{x:,.{casas}f}".replace(",", "@").replace(".", ",").replace("@", ".")

        linhas_kg, linhas_un, linhas_g = [], [], []
        for nome_ in sorted(escolhidos, key=lambda n_: -agreg[n_]["tot"]):
            a_ = agreg[nome_]
            valor = agreg[nome_]["tot"] if pede_total else (a_["tot"] / n_dias if n_dias else 0)
            maximo = a_["max"]
            sufixo_max = "" if pede_total or n_dias <= 1 else f" · máx {{max_fmt}} num dia"
            if a_["un"] == "kg":
                gramas = a_["porcao"] * 1000
                porcoes = f" (~{valor / a_['porcao']:.0f} porções de {gramas:.0f}g)" if 0 < a_["porcao"] < 0.5 else ""
                max_fmt = f"{_fmt_num(maximo, 1)} kg"
                linhas_kg.append(f"• {nome_}: *{_fmt_num(valor, 1)} kg*{porcoes}{sufixo_max.format(max_fmt=max_fmt)}")
            elif a_["un"] == "g":
                max_fmt = f"{_fmt_num(maximo, 0)} g"
                em_kg = f" (≈ {_fmt_num(valor / 1000, 1)} kg)" if valor >= 1000 else ""
                linhas_g.append(f"• {nome_}: *{_fmt_num(valor, 0)} g*{em_kg}{sufixo_max.format(max_fmt=max_fmt)}")
            else:
                max_fmt = f"{maximo:.0f}"
                linhas_un.append(f"• {nome_}: *{_fmt_num(valor, 0 if valor >= 10 else 1)} un*{sufixo_max.format(max_fmt=max_fmt)}")

        if not n_dias or not (linhas_kg or linhas_un or linhas_g):
            resposta = f"📦 Sem vendas suficientes {filtro_txt} pra calcular isso."
        else:
            partes = [titulo, f"_base: {periodo_txt}_"]
            if not filtrados and tokens:
                partes.append("_não achei esse insumo — mostrando todos_")
            if linhas_kg:
                partes.append("*Por peso:*\n" + "\n".join(linhas_kg))
            if linhas_g:
                partes.append("*Por grama:*\n" + "\n".join(linhas_g))
            if linhas_un:
                partes.append("*Por unidade:*\n" + "\n".join(linhas_un))
            partes.append("_calculado pelas vendas × ficha técnica (+ potes de molho extra); não inclui outros adicionais_")
            resposta = "\n\n".join(partes)
    elif "meta" in q:
        intent_keyword = "meta"
        m = meta_do_mes(marca_d or "todas", unidade_d or "todas")
        if m.get("meta"):
            resposta = (f"🎯 *Meta do mês{filtro_txt}:* {brl(m['realizado'])} de {brl(m['meta'])} "
                        f"({m['pct']:.0f}%)\nFaltam {brl(m['falta'])} · precisa de "
                        f"{brl(m['necessario_por_dia'])}/dia · ritmo atual "
                        f"{brl(m['ritmo_atual'])}/dia {'✅' if m['no_ritmo'] else '⚠️'}")
            if m.get("meta_e_do_grupo_todo"):
                resposta += "\n⚠️ a meta é do grupo inteiro — só o realizado está filtrado pela unidade"
        else:
            resposta = "🎯 Nenhuma meta definida pro mês — define lá no painel!"
    elif "ticket" in q:
        intent_keyword = "ticket"
        resposta = f"🎯 Ticket médio {rotulo}{filtro_txt}: *{brl(float(r['ticket']))}* ({int(r['pedidos'])} pedidos)"
    elif "cancel" in q:
        intent_keyword = "cancelamento"
        resposta = f"🚫 Cancelamentos {rotulo}{filtro_txt}: *{int(r['canc'])}*"
    elif any(p in q for p in ("fatur", "vendeu", "venda", "quanto fez", "receita")):
        intent_keyword = "faturamento"
        resposta = (f"💰 Faturamento {rotulo}{filtro_txt}: *{brl(float(r['fat']))}*\n"
                    f"🧾 {int(r['pedidos'])} pedidos · ticket {brl(float(r['ticket']))}")
    elif "pedido" in q:
        intent_keyword = "pedidos"
        resposta = (f"🧾 Pedidos {rotulo}{filtro_txt}: *{int(r['pedidos'])}*\n"
                    f"💰 Faturamento: {brl(float(r['fat']))}")
    elif any(p in q for p in ("tempo de entrega", "tempo médio", "tempo medio",
                              "demora", "quanto tempo")):
        intent_keyword = "tempo de entrega"
        te = consultar(f"""
            SELECT percentile_cont(0.5) WITHIN GROUP (
                       ORDER BY extract(epoch FROM (p.concluido_em - p.criado_em)) / 60) AS mediana,
                   count(*) AS n
            FROM pedidos p
            WHERE p.status IN ('closed', 'delivered')
              AND p.concluido_em > p.criado_em
              AND extract(epoch FROM (p.concluido_em - p.criado_em)) / 60 BETWEEN 1 AND 180
              AND {cond} {filtro_extra}
        """, params_extra)[0]
        n_te = int(te["n"])
        if n_te == 0:
            resposta = f"⏱️ Sem pedidos concluídos {rotulo}{filtro_txt} pra calcular tempo de entrega."
        else:
            resposta = (f"⏱️ Tempo médio de entrega/preparo {rotulo}{filtro_txt}: "
                        f"*{float(te['mediana']):.0f} min* ({n_te} pedidos medidos)")
    elif any(p in q for p in ("estoque", "insumo", "posição")):
        intent_keyword = "estoque"

        # pergunta por um insumo especifico ("quantas unidades de X tem no estoque?")
        _stop_est = {"mia", "quantas", "quantos", "quanto", "quanta", "tem", "temos", "tenho",
                     "estoque", "insumo", "insumos", "posicao", "unidades", "unidade", "sobrou",
                     "sobra", "ainda", "atual", "hoje", "para", "qual", "quais", "que", "com",
                     "sem", "nosso", "nossa", "esta", "esta", "fica", "ficou"}
        tokens_est = [t for t in re.findall(r"[a-z]+", q_sem_acento)
                      if len(t) >= 3 and t not in _stop_est]

        def _variantes_est(t):
            v = {t}
            if t.endswith("s"):
                v.add(t[:-1])
            if t.endswith(("aes", "oes")):
                v.add(t[:-3] + "ao")
            return v

        todos_insumos = consultar("""
            SELECT ie.insumo, ie.estoque_atual,
                   coalesce((SELECT f.unidade FROM ficha_tecnica f WHERE f.insumo = ie.insumo LIMIT 1),
                            (SELECT u.unidade FROM insumo_unidade u WHERE u.insumo = ie.insumo)) AS unidade
            FROM insumo_estoque ie
        """, {})
        nomes_ok_est = {i["insumo"]: _sem_acento(i["insumo"]) for i in todos_insumos}

        def _bate(ns, modo_todos):
            checagem = all if modo_todos else any
            return checagem(any(vv in ns for vv in _variantes_est(t)) for t in tokens_est)

        achados_est = ({nome for nome, ns in nomes_ok_est.items() if _bate(ns, True)}
                       if tokens_est else set())
        if not achados_est and tokens_est:
            achados_est = {nome for nome, ns in nomes_ok_est.items() if _bate(ns, False)}

        if achados_est:
            por_insumo = {i["insumo"]: i for i in todos_insumos}
            linhas = []
            for nome in sorted(achados_est):
                i = por_insumo[nome]
                un = i["unidade"] if i["unidade"] in ("kg", "g") else "un"
                casas = 0 if un in ("g", "un") and float(i["estoque_atual"]).is_integer() else 1
                linhas.append(f"• {nome}: *{float(i['estoque_atual']):.{casas}f} {un}* em estoque")
            resposta = "📦 *Estoque atual*\n" + "\n".join(linhas)
        else:
            negativos, zerados, criticos, sem_registro = _posicao_estoque()
            if not negativos and not zerados and not criticos and not sem_registro:
                resposta = "📦 Estoque ok — nenhum insumo zerado, negativo ou com cobertura crítica (menos de 3 dias)."
            else:
                partes = ["📦 *Posição de estoque*"]
                if negativos:
                    linhas = "\n".join(f"• {nome}: {_fmt_qtd_estoque(qtd, un)}" for nome, qtd, un in negativos[:10])
                    partes.append(f"🔴 *Negativo — já deveria ter sido reposto:*\n{linhas}")
                if zerados:
                    partes.append("🟠 *Zerado:* " + ", ".join(zerados[:10]))
                if criticos:
                    linhas = "\n".join(f"• {nome}: {_fmt_qtd_estoque(qtd, un)} (~{dias:.1f} dia(s)) — {rota}"
                                       for nome, qtd, un, dias, rota in criticos[:10])
                    partes.append(f"🟡 *Abaixo do mínimo:*\n{linhas}")
                if sem_registro:
                    partes.append("❓ *Sem estoque cadastrado:* "
                                  + ", ".join(sem_registro[:10]))
                resposta = "\n\n".join(partes)
        resposta += aviso_filtro
    else:
        resposta = ("🤖 *Oi, aqui é a MIA!* Sei responder sobre: pedidos, faturamento, "
                    "ticket, cancelamentos, meta, clientes sumidos, clientes com/sem telefone, consumo médio de insumos por dia da semana, estoque e tempo de "
                    "entrega — com períodos hoje / ontem / segunda a domingo (com \"passada\" "
                    "ou \"retrasada\") / semana (atual, passada, retrasada) / mês (atual, "
                    "passado, retrasado) / ou qualquer mês pelo nome (ex: agosto, julho), e "
                    "você pode filtrar por unidade (Colorado, Sobradinho) ou marca (Chomp, "
                    "Maracayá). Também comparo dois dias.\n"
                    "Ex: _quanto a Chomp vendeu hoje?_ · _tempo de entrega na segunda?_ · "
                    "_compare domingo 23 com domingo 30_ · _clientes com e sem telefone_ · "
                    "_quantas carnes uso no domingo?_ · _quantas cocas zero foram consumidas na "
                    "semana retrasada?_ · _faturamento de agosto_")

    # ----- memoria curta: grava o que foi resolvido, avisa quando reaproveitou -----
    if intent_keyword:
        executar("""
            INSERT INTO mia_contexto (grupo, marca, unidade, periodo_frase, intent_keyword, atualizado_em)
            VALUES (%(g)s, %(marca)s, %(unidade)s, %(periodo)s, %(intent)s, now())
            ON CONFLICT (grupo) DO UPDATE SET
                marca = EXCLUDED.marca, unidade = EXCLUDED.unidade,
                periodo_frase = EXCLUDED.periodo_frase, intent_keyword = EXCLUDED.intent_keyword,
                atualizado_em = now()
        """, {"g": grupo, "marca": marca_d, "unidade": unidade_d,
              "periodo": periodo_frase, "intent": intent_keyword})
        if memoria_usada:
            resposta = f"🧠 _(continuando: {' · '.join(memoria_usada)})_\n\n{resposta}"

    return {"enviar": True, "texto": resposta}


def _analisar_encalhados(marca="todas", unidade="todas"):
    """Detecta produtos parados (sem vender ha X dias) e em queda
    (vendas recentes bem abaixo do historico do proprio produto)."""
    filtro_marca = ""
    params = {}
    if marca != "todas":
        filtro_marca = "AND p.marca = %(marca)s"
        params["marca"] = marca
    if unidade != "todas":
        filtro_marca += " AND p.unidade = %(unidade)s"
        params["unidade"] = unidade

    # so vale a pena vigiar quem ja teve volume relevante (>= 8 no historico de 56d)
    dados = consultar(f"""
        WITH base AS (
            SELECT coalesce(a.canonico, lower(trim(i.nome))) AS chave,
                   max(i.nome) AS nome,
                   sum(i.quantidade) AS total_56d,
                   sum(i.quantidade) FILTER (
                       WHERE p.criado_em >= now() - interval '14 days') AS recente_14d,
                   sum(i.quantidade) FILTER (
                       WHERE p.criado_em >= now() - interval '28 days'
                         AND p.criado_em < now() - interval '14 days') AS anterior_14d,
                   max(p.criado_em AT TIME ZONE '{TZ}') AS ultima_venda
            FROM pedido_itens i
            JOIN pedidos p ON p.id = i.pedido_id
            LEFT JOIN produto_alias a ON a.alias = lower(trim(i.nome))
            WHERE p.status <> 'canceled'
              AND p.criado_em >= now() - interval '56 days'
              AND NOT EXISTS (
                  SELECT 1 FROM produto_excluido e
                  WHERE e.nome = coalesce(a.canonico, lower(trim(i.nome)))
              )
              {filtro_marca}
            GROUP BY 1
            HAVING sum(i.quantidade) >= 8
        )
        SELECT nome, chave, total_56d,
               coalesce(recente_14d, 0) AS recente,
               coalesce(anterior_14d, 0) AS anterior,
               extract(day FROM (now() AT TIME ZONE '{TZ}') - ultima_venda)::int AS dias_sem_vender
        FROM base ORDER BY total_56d DESC
    """, params)

    parados, quedas = [], []
    for d in dados:
        dias = int(d["dias_sem_vender"])
        rec, ant = float(d["recente"]), float(d["anterior"])
        if dias >= 10:
            parados.append({"nome": d["nome"], "dias": dias, "total": int(d["total_56d"])})
        elif ant >= 5 and rec < 0.6 * ant:
            queda = round(100 * (1 - rec / ant))
            quedas.append({"nome": d["nome"], "queda": queda,
                           "recente": int(rec), "anterior": int(ant)})
    parados.sort(key=lambda x: -x["total"])
    quedas.sort(key=lambda x: -x["queda"])
    return parados, quedas


@app.get("/api/encalhados")
def encalhados(marca: str = Query("todas"), unidade: str = Query("todas")):
    parados, quedas = _analisar_encalhados(marca, unidade)
    return {"parados": parados, "quedas": quedas,
            "marcas": consultar(
                "SELECT DISTINCT marca FROM pedidos WHERE marca IS NOT NULL ORDER BY 1", {})}


@app.get("/api/zap/encalhado")
def zap_encalhado():
    parados, quedas = _analisar_encalhados("todas")
    if not parados and not quedas:
        return {"enviar": False, "texto": ""}
    partes = ["📉 *Radar de produtos — Grupo Maracayá*"]
    if parados:
        lista = "\n".join(f"  • {p['nome']} — {p['dias']} dias sem vender"
                           for p in parados[:6])
        partes.append(f"*Encalhados (pararam de sair):*\n{lista}")
    if quedas:
        lista = "\n".join(f"  • {q['nome']} — caiu {q['queda']}% "
                           f"({q['anterior']}→{q['recente']} un)"
                           for q in quedas[:6])
        partes.append(f"*Em queda:*\n{lista}")
    partes.append("💡 Vale um combo, destaque no cardápio ou uma promo pra reaquecer.")
    return {"enviar": True, "texto": "\n\n".join(partes)}


@app.get("/api/compras_plano")
def compras_plano(ancora: str = Query("seg")):
    """Simula: pedidos feitos no dia-ancora -> quando cada fornecedor entrega
    e quando o boleto vence, distribuido pelo mes."""
    from datetime import date, timedelta
    DIAS = {"seg":0,"ter":1,"qua":2,"qui":3,"sex":4,"sab":5,"dom":6}
    NOME_DOW = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"]

    forns = consultar(
        "SELECT nome, dias_entrega, prazo_dias, valor_mensal, categoria, antecedencia_dias "
        "FROM fornecedores ORDER BY valor_mensal DESC", {})

    hoje = consultar(f"SELECT (now() AT TIME ZONE '{TZ}')::date AS d", {})[0]["d"]
    alvo = DIAS.get(ancora, 0)
    anc = hoje
    for _ in range(7):
        if anc.weekday() == alvo:
            break
        anc += timedelta(days=1)

    def entrega_ok(dias_entrega, d):
        if dias_entrega == "todos":
            return True
        return d.weekday() in [DIAS[x] for x in dias_entrega.split(",")]

    def prox_entrega(dias_entrega, a_partir):
        d = a_partir
        for _ in range(14):
            if entrega_ok(dias_entrega, d):
                return d
            d += timedelta(days=1)
        return a_partir

    # gasto real do mes corrente por fornecedor (soma das notas)
    reais = {r["fornecedor"]: float(r["total"]) for r in consultar(f"""
        SELECT fornecedor, sum(valor) AS total
        FROM notas_fiscais
        WHERE data_emissao >= date_trunc('month', (now() AT TIME ZONE '{TZ}')::date)
          AND data_emissao < date_trunc('month', (now() AT TIME ZONE '{TZ}')::date) + interval '1 month'
        GROUP BY 1
    """, {})}

    itens, total_mes = [], 0.0
    for f in forns:
        ent = prox_entrega(f["dias_entrega"], anc)
        venc = ent + timedelta(days=int(f["prazo_dias"]))
        val = float(f["valor_mensal"])
        total_mes += val
        itens.append({
            "nome": f["nome"], "categoria": f["categoria"],
            "prazo": int(f["prazo_dias"]), "valor": val,
            "antecedencia": int(f["antecedencia_dias"]),
            "real_mes": round(reais.get(f["nome"], 0), 2),
            "dias_entrega": f["dias_entrega"],
            "entrega": ent.isoformat(), "entrega_dow": NOME_DOW[ent.weekday()],
            "vence": venc.isoformat(), "vence_dow": NOME_DOW[venc.weekday()],
            "vence_dia": venc.day,
        })

    # concentracao: soma por dia de vencimento
    from collections import defaultdict
    por_dia = defaultdict(lambda: {"valor": 0.0, "forns": []})
    for it in itens:
        por_dia[it["vence"]]["valor"] += it["valor"]
        por_dia[it["vence"]]["forns"].append(it["nome"])
    concentracao = [
        {"data": k, "dia": int(k[-2:]), "valor": round(v["valor"], 2),
         "forns": v["forns"], "qtd": len(v["forns"])}
        for k, v in sorted(por_dia.items())
    ]
    pico = max(concentracao, key=lambda x: x["valor"]) if concentracao else None

    return {"ancora": anc.isoformat(), "ancora_dow": NOME_DOW[anc.weekday()],
            "itens": itens, "concentracao": concentracao,
            "total_mes": round(total_mes, 2),
            "pico": pico}


_DIAS_VALIDOS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"]


def _normalizar_dias(txt):
    txt = str(txt or "").strip().lower()
    if txt == "todos":
        return "todos"
    dias = [d.strip() for d in txt.split(",") if d.strip()]
    if not dias or any(d not in _DIAS_VALIDOS for d in dias):
        return None
    return ",".join(d for d in _DIAS_VALIDOS if d in dias) if len(set(dias)) < 7 else "todos"


@app.post("/api/fornecedor_novo")
def criar_fornecedor(dados: dict = Body(...)):
    nome = str(dados.get("nome", "")).strip()
    if not nome or len(nome) > 60:
        return {"ok": False, "erro": "nome inválido"}
    categoria = str(dados.get("categoria", "seco")).strip().lower()
    if categoria not in ("seco", "perecivel"):
        return {"ok": False, "erro": "categoria inválida"}
    dias = _normalizar_dias(dados.get("dias_entrega", "todos"))
    if dias is None:
        return {"ok": False, "erro": "dias de entrega inválidos"}
    try:
        prazo = int(float(dados.get("prazo_dias", 0)))
        valor = float(dados.get("valor_mensal", 0) or 0)
        antec = int(float(dados.get("antecedencia_dias", 1)))
    except (TypeError, ValueError):
        return {"ok": False, "erro": "prazo ou valor inválido"}
    if not 0 <= prazo <= 120 or valor < 0 or not 0 <= antec <= 14:
        return {"ok": False, "erro": "prazo ou valor inválido"}
    if consultar("SELECT 1 FROM fornecedores WHERE lower(nome) = lower(%(n)s)", {"n": nome}):
        return {"ok": False, "erro": "já existe um fornecedor com esse nome"}
    executar("""INSERT INTO fornecedores (nome, dias_entrega, prazo_dias, valor_mensal, categoria, antecedencia_dias, atualizado_em)
                VALUES (%(n)s, %(d)s, %(p)s, %(v)s, %(c)s, %(a)s, now())""",
             {"n": nome, "d": dias, "p": prazo, "v": valor, "c": categoria, "a": antec})
    return {"ok": True}


@app.post("/api/fornecedor")
def salvar_fornecedor(dados: dict = Body(...)):
    nome = str(dados.get("nome", "")).strip()
    if not nome:
        return {"ok": False, "erro": "nome vazio"}
    campos, params = [], {"nome": nome}
    if "dias_entrega" in dados:
        dias = _normalizar_dias(dados["dias_entrega"])
        if dias is None:
            return {"ok": False, "erro": "dias de entrega inválidos"}
        campos.append("dias_entrega = %(dias_entrega)s")
        params["dias_entrega"] = dias
    if "categoria" in dados:
        if str(dados["categoria"]) not in ("seco", "perecivel"):
            return {"ok": False, "erro": "categoria inválida"}
        campos.append("categoria = %(categoria)s")
        params["categoria"] = str(dados["categoria"])
    for c in ("prazo_dias", "valor_mensal", "antecedencia_dias"):
        if c in dados:
            try:
                params[c] = float(dados[c])
                campos.append(f"{c} = %({c})s")
            except (TypeError, ValueError):
                pass
    if not campos:
        return {"ok": False, "erro": "nada pra atualizar"}
    executar(f"UPDATE fornecedores SET {', '.join(campos)}, atualizado_em = now() "
             f"WHERE nome = %(nome)s", params)
    return {"ok": True}


_DIAS_IDX = {"seg": 0, "ter": 1, "qua": 2, "qui": 3, "sex": 4, "sab": 5, "dom": 6}
_DOW_NOME = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]


def _fmt_data_rota(d):
    return f"{_DOW_NOME[d.weekday()]} {d.day:02d}/{d.month:02d}"


def _troca_idx():
    r = consultar("SELECT valor FROM config_estoque WHERE chave = 'troca_dias'", {})
    dias = r[0]["valor"] if r else "seg,qua,sex"
    return sorted({_DIAS_IDX[d] for d in dias.split(",") if d in _DIAS_IDX}) or [0, 2, 4]


def _ciclo_troca(inicio, idx):
    """Proxima troca a partir de `inicio` (inclusive) e quantos dias ate a troca seguinte."""
    from datetime import timedelta
    datas = [inicio + timedelta(days=k) for k in range(0, 15)
             if (inicio + timedelta(days=k)).weekday() in idx]
    return datas[0], (datas[1] - datas[0]).days


def _rota_estoque(dias_entrega, antecedencia, hoje, consumo_dia, estoque, minimo_manual, seg):
    """Mapeia o estoque na rota do fornecedor: minimo (manual ou automatico), ate quando
    pedir e quantos dias ficaria sem produto se perder a janela do pedido."""
    from datetime import timedelta
    dias_entrega = dias_entrega or "todos"
    idx = sorted(_DIAS_IDX.values()) if dias_entrega == "todos" else sorted(
        {_DIAS_IDX[d] for d in dias_entrega.split(",") if d in _DIAS_IDX}) or list(range(7))
    gaps = [((idx[(k + 1) % len(idx)] - idx[k]) % 7) or 7 for k in range(len(idx))]
    intervalo_max = max(gaps)
    antecedencia = max(int(antecedencia or 0), 0)
    minimo_auto = consumo_dia * (antecedencia + intervalo_max) * seg
    minimo = float(minimo_manual) if minimo_manual is not None else minimo_auto

    r = {"minimo": round(minimo, 2), "minimo_auto": round(minimo_auto, 2),
         "minimo_manual": minimo_manual is not None,
         "abaixo_minimo": False, "proxima_entrega": None, "pedir_ate": None,
         "dias_sem_produto": 0, "pedir_hoje": False}
    rotas = [hoje + timedelta(days=k) for k in range(0, 45)]
    rotas = [d for d in rotas if d.weekday() in idx]
    pegaveis = [d for d in rotas if d >= hoje + timedelta(days=antecedencia)]
    if pegaveis:
        r["proxima_entrega"] = pegaveis[0].isoformat()
    if estoque is None or consumo_dia <= 0:
        return r
    r["abaixo_minimo"] = minimo > 0 and estoque <= minimo
    cobertura = max(estoque, 0) / consumo_dia
    acaba_em = hoje + timedelta(days=int(cobertura))
    if pegaveis and pegaveis[0] > acaba_em:
        r["dias_sem_produto"] = (pegaveis[0] - acaba_em).days
        r["pedir_hoje"] = True
    elif pegaveis:
        ultima = max(d for d in pegaveis if d <= acaba_em)
        limite = ultima - timedelta(days=antecedencia)
        r["pedir_ate"] = limite.isoformat()
        r["pedir_hoje"] = limite <= hoje
    return r


@app.get("/api/estoque_plano")
def estoque_plano(cobertura_dias: int = Query(30, ge=7, le=60),
                  seguranca_pct: int = Query(20, ge=0, le=100)):
    """Necessidade de insumos pra cobrir X dias: consumo diario medio
    (vendas 28d x ficha tecnica) x dias de cobertura x (1 + seguranca)."""
    # fator de tendencia (ultimas 4 sem vs 4 anteriores)
    ft = consultar("""
        SELECT count(*) FILTER (WHERE criado_em >= now() - interval '28 days') AS rec,
               count(*) FILTER (WHERE criado_em < now() - interval '28 days') AS ant
        FROM pedidos WHERE status <> 'canceled'
          AND criado_em >= now() - interval '56 days'
    """, {})[0]
    rec, ant = float(ft["rec"]), float(ft["ant"])
    fator = max(0.6, min(1.5, rec / ant)) if ant >= 20 else 1.0

    insumos = consultar(f"""
        WITH base AS (
            SELECT i.id AS item_id, i.quantidade,
                   coalesce(a.canonico, lower(trim(i.nome))) AS produto
            FROM pedido_itens i
            JOIN pedidos p ON p.id = i.pedido_id
            LEFT JOIN produto_alias a ON a.alias = lower(trim(i.nome))
            WHERE p.status <> 'canceled'
              AND p.criado_em >= now() - interval '28 days'
        ),
        receita AS (
            SELECT f.insumo, f.unidade,
                   CASE WHEN {_BEBIDA_ESCOLHIDA} AND f.insumo IN ({_SODAS})
                        THEN greatest(b.quantidade * f.qtd - coalesce((
                                 SELECT sum(coalesce(co.quantidade, 1)) FROM pedido_complementos co
                                 WHERE co.pedido_item_id = b.item_id AND {_CASE_REFRI} IS NOT NULL), 0), 0)
                        ELSE b.quantidade * f.qtd END AS consumo
            FROM base b JOIN ficha_tecnica f ON f.produto = b.produto
        ),
        refri_real AS (
            SELECT {_CASE_REFRI} AS insumo, 'un' AS unidade, coalesce(co.quantidade, 1) AS consumo
            FROM base b JOIN pedido_complementos co ON co.pedido_item_id = b.item_id
            WHERE {_BEBIDA_ESCOLHIDA} AND {_CASE_REFRI} IS NOT NULL
        ),
        molho_extra AS (
            SELECT {_CASE_MOLHO} AS insumo, 'g' AS unidade,
                   coalesce(co.quantidade, 1) * {_GRAMAS_POTE_MOLHO} AS consumo
            FROM base b JOIN pedido_complementos co ON co.pedido_item_id = b.item_id
            WHERE {_CASE_MOLHO} IS NOT NULL
            UNION ALL
            SELECT 'Nuggets', 'un', b.quantidade * {_CASE_NUGGET}
            FROM base b JOIN pedido_complementos co ON co.pedido_item_id = b.item_id
            WHERE b.produto = 'nuggets' AND {_CASE_NUGGET} IS NOT NULL
            UNION ALL
            SELECT {_CASE_REFRI}, 'un', b.quantidade * coalesce(co.quantidade, 1)
            FROM base b JOIN pedido_complementos co ON co.pedido_item_id = b.item_id
            WHERE b.produto = '{_PRODUTO_AGUA_ESCOLHA}' AND {_CASE_REFRI} IS NOT NULL
        ),
        adicionais AS (
            SELECT a.insumo, a.unidade, coalesce(co.quantidade, 1) * a.qtd AS consumo
            FROM base b JOIN pedido_complementos co ON co.pedido_item_id = b.item_id
            JOIN adicional_insumo a ON a.complemento = lower(trim(co.nome))
            WHERE NOT (a.so_fora_combo AND b.produto ILIKE 'combo%%')
        ),
        vendas0 AS (
            SELECT insumo, unidade, sum(consumo) / 28.0 AS por_dia
            FROM (SELECT * FROM receita UNION ALL SELECT * FROM refri_real
                  UNION ALL SELECT * FROM molho_extra UNION ALL SELECT * FROM adicionais) t
            GROUP BY 1, 2
        ),
        vendas AS (
            SELECT insumo, unidade, por_dia FROM vendas0
            UNION ALL
            SELECT u.insumo, u.unidade, 0 FROM insumo_unidade u
            WHERE NOT EXISTS (SELECT 1 FROM vendas0 v WHERE v.insumo = u.insumo)
        )
        SELECT v.insumo, v.unidade, v.por_dia AS consumo_dia,
               coalesce(fi.fornecedor, '—') AS fornecedor,
               fe.estoque_atual,
               ic.custo_unitario,
               fo.dias_entrega, fo.antecedencia_dias, fo.categoria, im.minimo AS minimo_manual,
               em.nome AS emb_nome, em.qtd AS emb_qtd, (cc.insumo IS NOT NULL) AS ciclo
        FROM vendas v
        LEFT JOIN insumo_fornecedor fi ON fi.insumo = v.insumo
        LEFT JOIN fornecedores fo ON fo.nome = fi.fornecedor
        LEFT JOIN insumo_minimo im ON im.insumo = v.insumo
        LEFT JOIN insumo_embalagem em ON em.insumo = v.insumo
        LEFT JOIN insumo_ciclo cc ON cc.insumo = v.insumo
        LEFT JOIN insumo_estoque fe ON fe.insumo = v.insumo
        LEFT JOIN insumo_custo ic ON ic.insumo = v.insumo
        ORDER BY (v.unidade = 'kg') DESC, 3 DESC
    """, {})

    seg = 1 + seguranca_pct / 100.0
    hoje = consultar(f"SELECT (now() AT TIME ZONE '{TZ}')::date AS d", {})[0]["d"]
    idx_troca = _troca_idx()
    itens = []
    custo_dia_total = 0.0
    for i in insumos:
        consumo_dia = float(i["consumo_dia"]) * fator
        necessidade = consumo_dia * cobertura_dias * seg
        estoque = float(i["estoque_atual"]) if i["estoque_atual"] is not None else None
        comprar = max(necessidade - estoque, 0) if estoque is not None else necessidade
        custo_unitario = float(i["custo_unitario"]) if i["custo_unitario"] is not None else None
        custo_dia = consumo_dia * custo_unitario if custo_unitario is not None else None
        if custo_dia is not None:
            custo_dia_total += custo_dia
        rota = _rota_estoque(i["dias_entrega"], i["antecedencia_dias"], hoje, consumo_dia, estoque,
                             float(i["minimo_manual"]) if i["minimo_manual"] is not None else None, seg)
        ciclo = {"ciclo": bool(i["ciclo"])}
        if i["ciclo"]:
            troca, dias_ciclo = _ciclo_troca(hoje, idx_troca)
            necessidade = consumo_dia * dias_ciclo * seg
            comprar = necessidade
            rota.update({"minimo": 0, "minimo_auto": 0, "minimo_manual": False, "abaixo_minimo": False,
                         "pedir_ate": None, "dias_sem_produto": 0, "pedir_hoje": False})
            ciclo.update({"proxima_troca": troca.isoformat(), "dias_ciclo": dias_ciclo})
        emb_qtd = float(i["emb_qtd"]) if i["emb_qtd"] is not None else None
        itens.append({
            **rota, **ciclo,
            "embalagem_nome": i["emb_nome"], "embalagem_qtd": emb_qtd,
            "comprar_embalagens": (-(-comprar // emb_qtd) if emb_qtd else None),
            "dias_entrega": i["dias_entrega"] or "todos",
            "antecedencia": int(i["antecedencia_dias"]) if i["antecedencia_dias"] is not None else 1,
            "categoria": i["categoria"] or "seco",
            "insumo": i["insumo"], "unidade": i["unidade"],
            "fornecedor": i["fornecedor"],
            "consumo_dia": round(consumo_dia, 2),
            "necessidade": round(necessidade, 2),
            "estoque": estoque,
            "comprar": round(comprar, 2),
            "custo_unitario": custo_unitario,
            "custo_dia": round(custo_dia, 2) if custo_dia is not None else None,
        })

    sem_custo = sum(1 for i in itens if i["custo_unitario"] is None)
    return {"itens": itens, "fator_tendencia": round(fator, 3),
            "pedidos_dia_base": rec / 28.0,
            "troca_dias": ",".join(d for d, k in _DIAS_IDX.items() if k in idx_troca),
            "cobertura_dias": cobertura_dias, "seguranca_pct": seguranca_pct,
            "custo_dia_total": round(custo_dia_total, 2), "sem_custo": sem_custo}



def _previsao_pedidos(hoje, n=60):
    """Pedidos esperados por dia (mediana por dia da semana nas ultimas 8 semanas x tendencia).
    Hoje conta so o que ainda falta vender (o estoque ja descontou o que saiu)."""
    from datetime import timedelta
    import statistics
    hist = consultar(f"""
        SELECT (p.criado_em AT TIME ZONE '{TZ}')::date AS dia, count(*) AS n
        FROM pedidos p
        WHERE p.status <> 'canceled'
          AND (p.criado_em AT TIME ZONE '{TZ}')::date >= %(h)s::date - 56
        GROUP BY 1
    """, {"h": hoje})
    por_dow, rec, ant = {}, 0.0, 0.0
    hoje_n = 0
    for h in hist:
        if h["dia"] == hoje:
            hoje_n = int(h["n"])
            continue
        por_dow.setdefault(h["dia"].weekday(), []).append(float(h["n"]))
        if (hoje - h["dia"]).days <= 28:
            rec += float(h["n"])
        else:
            ant += float(h["n"])
    fator = max(0.6, min(1.5, rec / ant)) if ant >= 20 else 1.0
    base = {k: statistics.median(v) * fator for k, v in por_dow.items() if v}
    media = (sum(base.values()) / len(base)) if base else 0.0
    prev = []
    for d in range(n):
        dia = hoje + timedelta(days=d)
        v = base.get(dia.weekday(), media)
        prev.append(max(v - hoje_n, 0.0) if d == 0 else v)
    return prev, media


def sugestao_compra(cobertura_dias=30, seguranca_pct=20, janela_dias=7):
    """Cruza previsao de pedidos x consumo por pedido x estoque x rota do fornecedor e
    devolve o que pedir (e ate quando), agrupado por fornecedor/entrega."""
    from datetime import timedelta
    from collections import defaultdict
    ep = estoque_plano(cobertura_dias=cobertura_dias, seguranca_pct=seguranca_pct)
    hoje = consultar(f"SELECT (now() AT TIME ZONE '{TZ}')::date AS d", {})[0]["d"]
    prev, media_prev = _previsao_pedidos(hoje)
    seg = 1 + seguranca_pct / 100.0
    pedidos_base = ep["pedidos_dia_base"] or 0.0
    fator_ep = ep["fator_tendencia"] or 1.0

    grupos = defaultdict(lambda: {"itens": []})
    sem_estoque, hortifruti, em_dia = [], [], 0
    for i in ep["itens"]:
        if i["ciclo"]:
            if i["consumo_dia"] > 0:
                hortifruti.append({"insumo": i["insumo"], "unidade": i["unidade"],
                                   "qtd": round(i["necessidade"], 1),
                                   "proxima_troca": i["proxima_troca"], "dias_ciclo": i["dias_ciclo"]})
            continue
        if i["consumo_dia"] <= 0:
            continue
        if i["estoque"] is None:
            if i["insumo"] not in _SEM_SKU_ESTOQUE:
                sem_estoque.append(i["insumo"])
            continue
        # consumo por pedido (consumo_dia ja vem x tendencia, a previsao de pedidos tambem)
        cpp = (i["consumo_dia"] / fator_ep) / pedidos_base if pedidos_base > 0 else 0.0
        cons = [p * cpp * seg for p in prev]
        cum = [0.0]
        for c in cons:
            cum.append(cum[-1] + c)

        idx = sorted(_DIAS_IDX.values()) if i["dias_entrega"] == "todos" else sorted(
            {_DIAS_IDX[d] for d in i["dias_entrega"].split(",") if d in _DIAS_IDX}) or list(range(7))
        rotas = [hoje + timedelta(days=k) for k in range(0, 60) if (hoje + timedelta(days=k)).weekday() in idx]
        ant = i["antecedencia"]
        pegaveis = [r for r in rotas if r >= hoje + timedelta(days=ant)]
        if not pegaveis:
            continue

        estoque = max(i["estoque"], 0.0)
        out_day = next((d for d in range(len(cons)) if estoque - cum[d + 1] < 0), None)
        if out_day is None:
            em_dia += 1
            continue
        acaba_em = hoje + timedelta(days=out_day)
        faltam = 0
        if pegaveis[0] > acaba_em:
            alvo = pegaveis[0]
            faltam = (alvo - acaba_em).days
        else:
            alvo = max(r for r in pegaveis if r <= acaba_em)
        pedir_ate = max(alvo - timedelta(days=ant), hoje)
        if (pedir_ate - hoje).days > janela_dias:
            em_dia += 1
            continue

        k = rotas.index(alvo)
        if i["categoria"] == "perecivel":
            fim = rotas[k + 2] if k + 2 < len(rotas) else alvo + timedelta(days=7)
        else:
            fim = alvo + timedelta(days=cobertura_dias)
        d_alvo, d_fim = (alvo - hoje).days, min((fim - hoje).days, len(cons))
        necessario = cum[d_fim] - cum[min(d_alvo, len(cons))]
        projetado = max(estoque - cum[min(d_alvo, len(cons))], 0.0)
        qtd = max(necessario - projetado, 0.0)
        if qtd <= 0:
            em_dia += 1
            continue
        emb_qtd = i["embalagem_qtd"]
        embalagens = -(-qtd // emb_qtd) if emb_qtd else None
        if emb_qtd:
            qtd_final = embalagens * emb_qtd
        elif i["unidade"] == "kg":
            qtd_final = -(-qtd * 10 // 1) / 10
        else:
            qtd_final = float(-(-qtd // 1))
        custo = i["custo_unitario"]
        grupos[(i["fornecedor"], alvo)]["itens"].append({
            "insumo": i["insumo"], "unidade": i["unidade"],
            "estoque": i["estoque"], "acaba_em": acaba_em.isoformat(),
            "qtd": round(qtd_final, 1), "qtd_exata": round(qtd, 1),
            "embalagens": int(embalagens) if embalagens else None,
            "embalagem_nome": i["embalagem_nome"], "embalagem_qtd": emb_qtd,
            "dias_sem_produto": faltam,
            "custo_estimado": round(qtd_final * custo, 2) if custo is not None else None,
        })

    pedidos = []
    for (forn, entrega), g in grupos.items():
        info = next((x for x in ep["itens"] if x["fornecedor"] == forn), None)
        ant = info["antecedencia"] if info else 1
        pedir_ate = max(entrega - timedelta(days=ant), hoje)
        g["itens"].sort(key=lambda x: x["insumo"])
        pedidos.append({
            "fornecedor": forn, "entrega": entrega.isoformat(),
            "pedir_ate": pedir_ate.isoformat(), "pedir_hoje": pedir_ate <= hoje,
            "itens": g["itens"],
            "total_estimado": round(sum(x["custo_estimado"] or 0 for x in g["itens"]), 2),
            "itens_sem_custo": sum(1 for x in g["itens"] if x["custo_estimado"] is None),
            "dias_sem_produto": max((x["dias_sem_produto"] for x in g["itens"]), default=0),
        })
    pedidos.sort(key=lambda p: (p["pedir_ate"], p["fornecedor"]))
    return {"hoje": hoje.isoformat(), "pedidos": pedidos, "hortifruti": hortifruti,
            "sem_estoque": sem_estoque, "itens_em_dia": em_dia,
            "pedidos_previstos": [round(x) for x in prev[:7]], "janela_dias": janela_dias,
            "cobertura_dias": cobertura_dias, "seguranca_pct": seguranca_pct}


@app.get("/api/sugestao_compra")
def api_sugestao_compra(cobertura_dias: int = Query(30, ge=7, le=60),
                        seguranca_pct: int = Query(20, ge=0, le=100),
                        janela_dias: int = Query(7, ge=1, le=21)):
    return sugestao_compra(cobertura_dias, seguranca_pct, janela_dias)



def _fmt_milhar(x, casas=0):
    return f"{x:,.{casas}f}".replace(",", "@").replace(".", ",").replace("@", ".")


def _texto_sugestao(sug, completo=False):
    """Mensagem de zap da sugestao de compra. Por padrao so o que precisa ser pedido hoje
    (+ resumo dos proximos); completo=True tambem lista os proximos itens por fornecedor."""
    from datetime import date as _d
    hoje_pedidos = [p for p in sug["pedidos"] if p["pedir_hoje"]]
    proximos = [p for p in sug["pedidos"] if not p["pedir_hoje"]]

    def linha_item(i):
        qtd = f"{_fmt_milhar(i['qtd'], 1 if i['unidade'] == 'kg' else 0)} {i['unidade']}"
        if i["embalagens"]:
            qtd = f"{i['embalagens']} {i['embalagem_nome']}(s) ({qtd})"
        return f"• {i['insumo']}: *{qtd}*"

    def cab(p, hoje):
        entrega = _fmt_data_rota(_d.fromisoformat(p["entrega"]))
        extra = f" ⚠️ fica {p['dias_sem_produto']} dia(s) sem produto" if p["dias_sem_produto"] else ""
        if hoje:
            return f"*{p['fornecedor']}* — entrega {entrega}{extra}"
        return f"*{p['fornecedor']}* — pedir até {_fmt_data_rota(_d.fromisoformat(p['pedir_ate']))} (entrega {entrega})"

    partes = []
    if hoje_pedidos:
        blocos = []
        for p in hoje_pedidos:
            total = f"\nTotal estimado: R$ {_fmt_milhar(p['total_estimado'], 2)}" + (
                f" (+ {p['itens_sem_custo']} item(ns) sem custo)" if p["itens_sem_custo"] else "")
            blocos.append(cab(p, True) + "\n" + "\n".join(linha_item(i) for i in p["itens"]) + total)
        partes.append("🛒 *Sugestão de compra — pedir HOJE*\n\n" + "\n\n".join(blocos))
    elif completo:
        partes.append("🛒 *Sugestão de compra*\nNada pra pedir hoje. ✅")
    if proximos and (completo or hoje_pedidos):
        linhas = []
        for p in proximos[:6]:
            itens = ", ".join(i["insumo"] for i in p["itens"][:4]) + ("…" if len(p["itens"]) > 4 else "")
            linhas.append(f"• {cab(p, False)}: {itens}")
        partes.append("📅 *Próximos pedidos:*\n" + "\n".join(linhas))
    if sug["sem_estoque"] and (completo or hoje_pedidos):
        partes.append("❓ *Sem estoque cadastrado (não entram na sugestão):* "
                      + ", ".join(sug["sem_estoque"][:8]))
    if partes:
        partes.append("_baseado na previsão de pedidos, consumo por lanche e estoque atual; "
                      "confira o estoque antes de fechar o pedido_")
    return "\n\n".join(partes)


@app.get("/api/zap/sugestao")
def zap_sugestao():
    sug = sugestao_compra(30, 20, 7)
    if not any(p["pedir_hoje"] for p in sug["pedidos"]):
        return {"enviar": False, "texto": ""}
    return {"enviar": True, "texto": _texto_sugestao(sug)}


@app.post("/api/estoque")
def salvar_estoque(dados: dict = Body(...)):
    insumo = str(dados.get("insumo", "")).strip()
    if not insumo:
        return {"ok": False, "erro": "insumo vazio"}
    try:
        qtd = float(dados.get("estoque"))
    except (TypeError, ValueError):
        return {"ok": False, "erro": "quantidade inválida"}
    executar("""
        INSERT INTO insumo_estoque (insumo, estoque_atual, atualizado_em)
        VALUES (%(i)s, %(q)s, now())
        ON CONFLICT (insumo) DO UPDATE
            SET estoque_atual = EXCLUDED.estoque_atual, atualizado_em = now()
    """, {"i": insumo, "q": qtd})
    return {"ok": True}


@app.post("/api/insumo_novo")
def criar_insumo(dados: dict = Body(...)):
    insumo = str(dados.get("insumo", "")).strip()
    unidade = str(dados.get("unidade", "un")).strip().lower()
    if not insumo or len(insumo) > 80:
        return {"ok": False, "erro": "nome inválido"}
    if unidade not in ("un", "kg", "g"):
        return {"ok": False, "erro": "unidade inválida"}
    existe = consultar("""
        SELECT 1 FROM insumo_unidade WHERE lower(insumo) = lower(%(i)s)
        UNION SELECT 1 FROM ficha_tecnica WHERE lower(insumo) = lower(%(i)s)
        UNION SELECT 1 FROM insumo_estoque WHERE lower(insumo) = lower(%(i)s)
    """, {"i": insumo})
    if existe:
        return {"ok": False, "erro": "já existe um insumo com esse nome"}
    executar("INSERT INTO insumo_unidade (insumo, unidade) VALUES (%(i)s, %(u)s)",
             {"i": insumo, "u": unidade})
    forn = str(dados.get("fornecedor", "") or "").strip()
    if forn:
        executar("""INSERT INTO insumo_fornecedor (insumo, fornecedor) VALUES (%(i)s, %(f)s)
                    ON CONFLICT (insumo) DO UPDATE SET fornecedor = EXCLUDED.fornecedor""",
                 {"i": insumo, "f": forn})
    try:
        custo = float(dados.get("custo_unitario"))
        if custo >= 0:
            executar("""INSERT INTO insumo_custo (insumo, custo_unitario, atualizado_em)
                        VALUES (%(i)s, %(c)s, now())
                        ON CONFLICT (insumo) DO UPDATE SET custo_unitario = EXCLUDED.custo_unitario,
                        atualizado_em = now()""", {"i": insumo, "c": custo})
    except (TypeError, ValueError):
        pass
    try:
        est = float(dados.get("estoque"))
        if est >= 0:
            executar("""INSERT INTO insumo_estoque (insumo, estoque_atual, atualizado_em)
                        VALUES (%(i)s, %(q)s, now())
                        ON CONFLICT (insumo) DO UPDATE SET estoque_atual = EXCLUDED.estoque_atual,
                        atualizado_em = now()""", {"i": insumo, "q": est})
    except (TypeError, ValueError):
        pass
    return {"ok": True}


@app.post("/api/insumo_embalagem")
def salvar_insumo_embalagem(dados: dict = Body(...)):
    """nome/quantidade vazios removem a embalagem de compra do insumo."""
    insumo = str(dados.get("insumo", "")).strip()
    if not insumo:
        return {"ok": False, "erro": "insumo vazio"}
    nome = str(dados.get("nome", "") or "").strip()
    bruto = dados.get("qtd")
    if not nome and (bruto is None or str(bruto).strip() == ""):
        executar("DELETE FROM insumo_embalagem WHERE insumo = %(i)s", {"i": insumo})
        return {"ok": True}
    try:
        qtd = float(bruto)
    except (TypeError, ValueError):
        return {"ok": False, "erro": "quantidade inválida"}
    if not nome or len(nome) > 30 or qtd <= 0:
        return {"ok": False, "erro": "informe o nome e a quantidade da embalagem"}
    executar("""INSERT INTO insumo_embalagem (insumo, nome, qtd) VALUES (%(i)s, %(n)s, %(q)s)
                ON CONFLICT (insumo) DO UPDATE SET nome = EXCLUDED.nome, qtd = EXCLUDED.qtd""",
             {"i": insumo, "n": nome, "q": qtd})
    return {"ok": True}


@app.post("/api/insumo_ciclo")
def salvar_insumo_ciclo(dados: dict = Body(...)):
    insumo = str(dados.get("insumo", "")).strip()
    if not insumo:
        return {"ok": False, "erro": "insumo vazio"}
    if dados.get("ativo"):
        executar("INSERT INTO insumo_ciclo (insumo) VALUES (%(i)s) ON CONFLICT DO NOTHING", {"i": insumo})
    else:
        executar("DELETE FROM insumo_ciclo WHERE insumo = %(i)s", {"i": insumo})
    return {"ok": True}


@app.post("/api/config_troca")
def salvar_config_troca(dados: dict = Body(...)):
    dias = _normalizar_dias(dados.get("dias"))
    if dias is None:
        return {"ok": False, "erro": "dias inválidos"}
    if dias == "todos":
        dias = ",".join(_DIAS_VALIDOS)
    executar("""INSERT INTO config_estoque (chave, valor) VALUES ('troca_dias', %(v)s)
                ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor""", {"v": dias})
    return {"ok": True}


@app.post("/api/estoque_minimo")
def salvar_estoque_minimo(dados: dict = Body(...)):
    """minimo vazio/null remove o valor manual e volta pro minimo automatico."""
    insumo = str(dados.get("insumo", "")).strip()
    if not insumo:
        return {"ok": False, "erro": "insumo vazio"}
    bruto = dados.get("minimo")
    if bruto is None or str(bruto).strip() == "":
        executar("DELETE FROM insumo_minimo WHERE insumo = %(i)s", {"i": insumo})
        return {"ok": True}
    try:
        minimo = float(bruto)
    except (TypeError, ValueError):
        return {"ok": False, "erro": "mínimo inválido"}
    if minimo < 0:
        return {"ok": False, "erro": "mínimo inválido"}
    executar("""INSERT INTO insumo_minimo (insumo, minimo) VALUES (%(i)s, %(m)s)
                ON CONFLICT (insumo) DO UPDATE SET minimo = EXCLUDED.minimo""",
             {"i": insumo, "m": minimo})
    return {"ok": True}


@app.post("/api/insumo_custo")
def salvar_insumo_custo(dados: dict = Body(...)):
    insumo = str(dados.get("insumo", "")).strip()
    if not insumo:
        return {"ok": False, "erro": "insumo vazio"}
    try:
        custo = float(dados.get("custo_unitario"))
    except (TypeError, ValueError):
        return {"ok": False, "erro": "custo inválido"}
    if custo < 0:
        return {"ok": False, "erro": "custo inválido"}
    executar("""
        INSERT INTO insumo_custo (insumo, custo_unitario, atualizado_em)
        VALUES (%(i)s, %(c)s, now())
        ON CONFLICT (insumo) DO UPDATE
            SET custo_unitario = EXCLUDED.custo_unitario, atualizado_em = now()
    """, {"i": insumo, "c": custo})
    return {"ok": True}


@app.post("/api/insumo_fornecedor")
def salvar_insumo_fornecedor(dados: dict = Body(...)):
    insumo = str(dados.get("insumo", "")).strip()
    fornecedor = str(dados.get("fornecedor", "")).strip()
    if not insumo or not fornecedor:
        return {"ok": False, "erro": "dados incompletos"}
    executar("""
        INSERT INTO insumo_fornecedor (insumo, fornecedor)
        VALUES (%(i)s, %(f)s)
        ON CONFLICT (insumo) DO UPDATE SET fornecedor = EXCLUDED.fornecedor
    """, {"i": insumo, "f": fornecedor})
    return {"ok": True}


@app.post("/api/nota")
def registrar_nota(dados: dict = Body(...)):
    forn = str(dados.get("fornecedor", "")).strip()
    numero = str(dados.get("numero", "")).strip() or None
    try:
        valor = float(dados.get("valor"))
    except (TypeError, ValueError):
        return {"ok": False, "erro": "valor inválido"}
    if not forn or valor <= 0:
        return {"ok": False, "erro": "dados incompletos"}
    executar("""
        INSERT INTO notas_fiscais (fornecedor, numero, data_emissao, valor, vencimento)
        VALUES (%(f)s, %(n)s, %(d)s, %(v)s, %(venc)s)
        ON CONFLICT (fornecedor, numero) DO UPDATE
            SET valor = EXCLUDED.valor, data_emissao = EXCLUDED.data_emissao,
                vencimento = EXCLUDED.vencimento
    """, {"f": forn, "n": numero,
          "d": dados.get("data_emissao"), "v": valor,
          "venc": dados.get("vencimento")})
    return {"ok": True}


@app.get("/api/notas_mes")
def notas_mes():
    forns = consultar("SELECT nome, valor_mensal FROM fornecedores ORDER BY nome", {})
    lista = consultar(f"""
        SELECT id, fornecedor, numero,
               to_char(data_emissao, 'DD/MM/YYYY') AS data,
               data_emissao, valor,
               to_char(vencimento, 'DD/MM') AS venc
        FROM notas_fiscais
        WHERE data_emissao >= date_trunc('month', (now() AT TIME ZONE '{TZ}')::date)
          AND data_emissao < date_trunc('month', (now() AT TIME ZONE '{TZ}')::date) + interval '1 month'
        ORDER BY data_emissao DESC, id DESC
    """, {})
    por_forn = consultar(f"""
        SELECT fornecedor, count(*) AS notas, sum(valor) AS total
        FROM notas_fiscais
        WHERE data_emissao >= date_trunc('month', (now() AT TIME ZONE '{TZ}')::date)
          AND data_emissao < date_trunc('month', (now() AT TIME ZONE '{TZ}')::date) + interval '1 month'
        GROUP BY 1 ORDER BY 3 DESC
    """, {})
    total = sum(float(n["valor"]) for n in lista)
    return {"notas": lista, "por_fornecedor": por_forn,
            "total_mes": round(total, 2),
            "fornecedores": [f["nome"] for f in forns]}


@app.post("/api/nota_delete")
def deletar_nota(dados: dict = Body(...)):
    try:
        nid = int(dados.get("id"))
    except (TypeError, ValueError):
        return {"ok": False}
    executar("DELETE FROM notas_fiscais WHERE id = %(id)s", {"id": nid})
    return {"ok": True}

@app.get("/api/unidades")
def listar_unidades():
    # "Chomp" e uma marca, nao uma unidade fisica (futuramente vai operar
    # dentro da unidade Sobradinho) - por isso fica de fora do filtro de unidade.
    us = consultar(
        "SELECT DISTINCT unidade FROM pedidos WHERE unidade IS NOT NULL "
        "AND unidade <> 'Chomp' ORDER BY 1", {})
    return {"unidades": [u["unidade"] for u in us]}
