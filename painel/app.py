#!/usr/bin/env python3
"""Painel Operacional — backend.
Serve a pagina e um endpoint /api/dados com os agregados da operacao.
"""

import os
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
               t.comissao_pct,
               round(sum(p.total) * coalesce(t.comissao_pct, 0) / 100, 2) AS pedagio,
               round(sum(p.total) * (1 - coalesce(t.comissao_pct, 0) / 100), 2) AS liquido
        {fechados}
        GROUP BY 1, t.comissao_pct
        ORDER BY 3 DESC
    """.replace("FROM pedidos p",
                "FROM pedidos p LEFT JOIN canal_taxas t ON t.origem = p.origem"), params)

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
        SELECT coalesce(sum(p.total * coalesce(t.comissao_pct, 0) / 100), 0) AS pedagio
        FROM pedidos p LEFT JOIN canal_taxas t ON t.origem = p.origem
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
                   max(p.criado_em) FILTER (WHERE p.status <> 'canceled') AS ultimo
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
                 ELSE 'Mais de 90 dias'
               END AS faixa,
               min(now() - ultimo) AS ordem,
               count(*) AS clientes
        FROM agg GROUP BY 1 ORDER BY ordem
    """, params)

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

    sumidos_resumo = consultar(agg + """
        SELECT count(*) AS clientes,
               coalesce(round(sum(a.gasto), 2), 0) AS gasto_total
        FROM agg a
        WHERE a.pedidos >= 2
          AND a.ultimo < now() - (%(sumido)s || ' days')::interval
    """, params)[0]

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
            "novos_semana": novos_semana, "ciclos": ciclos,
            "media_entre_pedidos": media_geral["media"],
            "top": top, "sumidos": sumidos, "resgate": resgate, "sumidos_resumo": sumidos_resumo, "canais": canais, "marcas": marcas}


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


@app.get("/api/dre")
def dre(marca: str = Query("todas"), unidade: str = Query("todas"), periodo: str = Query("mes_atual")):
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

    base = f"""
        FROM pedidos p
        WHERE p.status <> 'canceled' AND {cond} {filtro_marca}
    """

    vendas = consultar(f"""
        SELECT count(*) AS pedidos,
               count(*) FILTER (WHERE p.tipo = 'delivery') AS entregas,
               coalesce(sum(p.total), 0) AS receita,
               coalesce(sum(p.desconto), 0) AS descontos
        {base}
    """, params)[0]

    pedagio = consultar(f"""
        SELECT coalesce(sum(p.total * coalesce(t.comissao_pct, 0) / 100), 0) AS pedagio,
               coalesce(sum(p.total) FILTER (WHERE t.comissao_pct IS NULL
                   AND p.origem IS NOT NULL), 0) AS bruto_sem_taxa
        FROM pedidos p LEFT JOIN canal_taxas t ON t.origem = p.origem
        WHERE p.status <> 'canceled' AND {cond} {filtro_marca}
    """, params)[0]

    cmv = consultar(f"""
        SELECT coalesce(sum(i.total) FILTER (WHERE c.custo IS NOT NULL), 0) AS receita_mapeada,
               coalesce(sum(i.quantidade * c.custo), 0) AS cmv_mapeado,
               coalesce(sum(i.total), 0) AS receita_itens
        FROM pedido_itens i
        JOIN pedidos p ON p.id = i.pedido_id
        LEFT JOIN produto_custos c ON c.nome = lower(trim(i.nome))
        WHERE p.status <> 'canceled' AND {cond} {filtro_marca}
    """, params)[0]

    cfg_rows = consultar("SELECT chave, valor FROM dre_config", {})
    cfg = {r["chave"]: float(r["valor"]) for r in cfg_rows}

    receita = float(vendas["receita"])
    descontos = float(vendas["descontos"])
    ped = float(pedagio["pedagio"])
    imposto = receita * cfg.get("imposto_pct", 0) / 100
    entrega = float(vendas["entregas"]) * cfg.get("custo_entrega", 0)

    rec_map = float(cmv["receita_mapeada"])
    cmv_map = float(cmv["cmv_mapeado"])
    rec_itens = float(cmv["receita_itens"])
    cobertura = (100 * rec_map / rec_itens) if rec_itens > 0 else 0
    # extrapola o CMV da fatia sem custo usando o % medio da fatia mapeada
    cmv_estimado_resto = ((rec_itens - rec_map) * (cmv_map / rec_map)) if rec_map > 0 else 0
    cmv_total = cmv_map + cmv_estimado_resto

    lucro = receita - ped - imposto - cmv_total - entrega
    margem = (100 * lucro / receita) if receita > 0 else 0

    return {
        "linhas": [
            {"t": "+", "rotulo": "Vendas cheias (antes de descontos)", "valor": receita + descontos},
            {"t": "-", "rotulo": "Descontos e cupons", "valor": descontos},
            {"t": "=", "rotulo": "Receita realizada", "valor": receita},
            {"t": "-", "rotulo": "Comissões de canais (pedágio)", "valor": ped},
            {"t": "-", "rotulo": f"Impostos ({cfg.get('imposto_pct', 0):.1f}%)", "valor": imposto},
            {"t": "-", "rotulo": "CMV — custo dos produtos", "valor": cmv_total,
             "nota": f"{cobertura:.0f}% da receita com custo cadastrado"
                     + ("; restante estimado pela média" if cobertura < 99 else "")},
            {"t": "-", "rotulo": "Custo de entrega (motoboy)", "valor": entrega,
             "nota": f"{int(vendas['entregas'])} entregas × R$ {cfg.get('custo_entrega', 0):.2f}"},
            {"t": "=", "rotulo": "Lucro bruto (antes das despesas fixas)", "valor": lucro},
        ],
        "resumo": {"receita": receita, "lucro": lucro, "margem": margem,
                   "pedidos": int(vendas["pedidos"]), "cobertura_cmv": cobertura,
                   "bruto_sem_taxa": float(pedagio["bruto_sem_taxa"])},
        "config": cfg,
        "marcas": consultar(
            "SELECT DISTINCT marca FROM pedidos WHERE marca IS NOT NULL ORDER BY 1", {}),
    }


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
    d = consultar(f"""
        WITH base AS (
            SELECT p.cliente_id,
                   count(*) FILTER (WHERE p.status <> 'canceled') AS pedidos,
                   coalesce(sum(p.total) FILTER (WHERE p.status <> 'canceled'), 0) AS gasto,
                   max(p.criado_em) FILTER (WHERE p.status <> 'canceled') AS ultimo
            FROM pedidos p WHERE p.cliente_id IS NOT NULL
            GROUP BY 1 HAVING count(*) FILTER (WHERE p.status <> 'canceled') >= 2
        ),
        sumidos AS (
            SELECT b.*, c.nome, row_number() OVER (ORDER BY b.gasto DESC) AS rn
            FROM base b JOIN clientes c ON c.id = b.cliente_id
            WHERE b.ultimo < now() - interval '30 days'
        )
        SELECT (SELECT count(*) FROM sumidos) AS clientes,
               (SELECT coalesce(sum(gasto), 0) FROM sumidos) AS gasto,
               coalesce(string_agg('• ' || nome || ' — ' ||
                   extract(day FROM now() - ultimo)::int || ' dias, R$ ' || round(gasto),
                   E'\n' ORDER BY rn) FILTER (WHERE rn <= 5), '') AS top5
        FROM sumidos
    """, {})[0]
    n = int(d["clientes"])
    if n == 0:
        return {"enviar": False, "texto": ""}
    texto = (f"🚨 *Radar de clientes — Grupo Maracayá*\n\n"
             f"{n} clientes recorrentes estão há 30+ dias sem pedir.\n"
             f"💰 Eles já deixaram *R$ {float(d['gasto']):,.2f}* na chapa.\n\n"
             f"*Top 5 pra resgatar:*\n{d['top5']}\n\n"
             f"👉 Lista completa com telefones: painel → Clientes"
             ).replace(",", "@").replace(".", ",").replace("@", ".")
    return {"enviar": True, "texto": texto}


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

    # ----- periodo -----
    agora = f"(now() AT TIME ZONE '{TZ}')"
    dia = f"(p.criado_em AT TIME ZONE '{TZ}')::date"
    if "hoje" in q:
        cond, rotulo = f"{dia} = {agora}::date", "hoje"
    elif "ontem" in q:
        cond, rotulo = f"{dia} = {agora}::date - 1", "ontem"
    elif "semana passada" in q:
        cond = (f"{dia} >= date_trunc('week', {agora})::date - 7 "
                f"AND {dia} < date_trunc('week', {agora})::date")
        rotulo = "na semana passada"
    elif "semana" in q:
        cond, rotulo = f"{dia} >= date_trunc('week', {agora})::date", "nesta semana"
    elif "mês passado" in q or "mes passado" in q:
        cond = (f"{dia} >= (date_trunc('month', {agora}) - interval '1 month')::date "
                f"AND {dia} < date_trunc('month', {agora})::date")
        rotulo = "no mês passado"
    else:
        cond, rotulo = f"{dia} >= date_trunc('month', {agora})::date", "no mês (até agora)"

    def brl(v):
        return f"R$ {v:,.2f}".replace(",", "@").replace(".", ",").replace("@", ".")

    r = consultar(f"""
        SELECT count(*) FILTER (WHERE p.status <> 'canceled') AS pedidos,
               coalesce(sum(p.total) FILTER (WHERE p.status <> 'canceled'), 0) AS fat,
               coalesce(avg(p.total) FILTER (WHERE p.status <> 'canceled'), 0) AS ticket,
               count(*) FILTER (WHERE p.status = 'canceled') AS canc
        FROM pedidos p WHERE {cond}
    """, {})[0]

    # ----- intencao -----
    if "sumido" in q or "resgate" in q:
        s = zap_radar()
        resposta = s["texto"] if s["enviar"] else "✅ Nenhum cliente recorrente sumido há 30+ dias. Base quente!"
    elif "meta" in q:
        m = meta_do_mes("todas")
        if m.get("meta"):
            resposta = (f"🎯 *Meta do mês:* {brl(m['realizado'])} de {brl(m['meta'])} "
                        f"({m['pct']:.0f}%)\nFaltam {brl(m['falta'])} · precisa de "
                        f"{brl(m['necessario_por_dia'])}/dia · ritmo atual "
                        f"{brl(m['ritmo_atual'])}/dia {'✅' if m['no_ritmo'] else '⚠️'}")
        else:
            resposta = "🎯 Nenhuma meta definida pro mês — define lá no painel!"
    elif "ticket" in q:
        resposta = f"🎯 Ticket médio {rotulo}: *{brl(float(r['ticket']))}* ({int(r['pedidos'])} pedidos)"
    elif "cancel" in q:
        resposta = f"🚫 Cancelamentos {rotulo}: *{int(r['canc'])}*"
    elif any(p in q for p in ("fatur", "vendeu", "venda", "quanto fez", "receita")):
        resposta = (f"💰 Faturamento {rotulo}: *{brl(float(r['fat']))}*\n"
                    f"🧾 {int(r['pedidos'])} pedidos · ticket {brl(float(r['ticket']))}")
    elif "pedido" in q:
        resposta = (f"🧾 Pedidos {rotulo}: *{int(r['pedidos'])}*\n"
                    f"💰 Faturamento: {brl(float(r['fat']))}")
    elif any(p in q for p in ("estoque", "insumo", "posição")):
        ep = estoque_plano(cobertura_dias=30, seguranca_pct=20)
        criticos, sem_registro = [], []
        for i in ep["itens"]:
            if i["estoque"] is None:
                sem_registro.append(i["insumo"])
                continue
            dias = i["estoque"] / i["consumo_dia"] if i["consumo_dia"] > 0 else 999
            if dias < 3:
                criticos.append((i["insumo"], dias))
        criticos.sort(key=lambda x: x[1])
        if not criticos and not sem_registro:
            resposta = "📦 Estoque ok — nenhum insumo com cobertura crítica (menos de 3 dias)."
        else:
            partes = ["📦 *Posição de estoque*"]
            if criticos:
                linhas = "\n".join(f"• {nome}: {dias:.1f} dia(s) de cobertura"
                                   for nome, dias in criticos[:10])
                partes.append(f"⚠️ *Crítico (menos de 3 dias):*\n{linhas}")
            if sem_registro:
                partes.append("❓ *Sem estoque cadastrado:* "
                              + ", ".join(sem_registro[:10]))
            resposta = "\n\n".join(partes)
    else:
        resposta = ("🤖 *Oi, aqui é a MIA!* Sei responder sobre: pedidos, faturamento, "
                    "ticket, cancelamentos, meta, clientes sumidos e estoque — com "
                    "períodos hoje / ontem / semana / mês / mês passado.\n"
                    "Ex: _quantos pedidos teve hoje?_")

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
        "SELECT nome, dias_entrega, prazo_dias, valor_mensal, categoria "
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


@app.post("/api/fornecedor")
def salvar_fornecedor(dados: dict = Body(...)):
    nome = str(dados.get("nome", "")).strip()
    if not nome:
        return {"ok": False, "erro": "nome vazio"}
    campos, params = [], {"nome": nome}
    for c in ("dias_entrega", "categoria"):
        if c in dados:
            campos.append(f"{c} = %({c})s")
            params[c] = str(dados[c])
    for c in ("prazo_dias", "valor_mensal"):
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

    insumos = consultar("""
        WITH vendas AS (
            SELECT coalesce(a.canonico, lower(trim(i.nome))) AS produto,
                   sum(i.quantidade) / 28.0 AS por_dia
            FROM pedido_itens i
            JOIN pedidos p ON p.id = i.pedido_id
            LEFT JOIN produto_alias a ON a.alias = lower(trim(i.nome))
            WHERE p.status <> 'canceled'
              AND p.criado_em >= now() - interval '28 days'
            GROUP BY 1
        )
        SELECT f.insumo, f.unidade,
               sum(v.por_dia * f.qtd) AS consumo_dia,
               coalesce(fi.fornecedor, '—') AS fornecedor,
               fe.estoque_atual
        FROM vendas v
        JOIN ficha_tecnica f ON f.produto = v.produto
        LEFT JOIN insumo_fornecedor fi ON fi.insumo = f.insumo
        LEFT JOIN insumo_estoque fe ON fe.insumo = f.insumo
        GROUP BY f.insumo, f.unidade, fi.fornecedor, fe.estoque_atual
        ORDER BY (f.unidade = 'kg') DESC, 3 DESC
    """, {})

    seg = 1 + seguranca_pct / 100.0
    itens = []
    for i in insumos:
        consumo_dia = float(i["consumo_dia"]) * fator
        necessidade = consumo_dia * cobertura_dias * seg
        estoque = float(i["estoque_atual"]) if i["estoque_atual"] is not None else None
        comprar = max(necessidade - estoque, 0) if estoque is not None else necessidade
        itens.append({
            "insumo": i["insumo"], "unidade": i["unidade"],
            "fornecedor": i["fornecedor"],
            "consumo_dia": round(consumo_dia, 2),
            "necessidade": round(necessidade, 2),
            "estoque": estoque,
            "comprar": round(comprar, 2),
        })

    return {"itens": itens, "fator_tendencia": round(fator, 3),
            "cobertura_dias": cobertura_dias, "seguranca_pct": seguranca_pct}


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
