-- Metas mensais de faturamento (por marca ou do grupo todo)
-- Rodar uma vez:
--   docker exec -i dados_postgres psql -U alvaro -d operacao < painel/metas.sql

CREATE TABLE IF NOT EXISTS metas (
    mes            DATE NOT NULL,             -- primeiro dia do mês
    marca          TEXT NOT NULL DEFAULT 'todas',
    valor          NUMERIC(12,2) NOT NULL,
    atualizado_em  TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (mes, marca)
);

-- As metas são definidas direto na Visão geral do painel.
