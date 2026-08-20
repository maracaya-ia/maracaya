-- Tabela de custos (CMV) por produto — engenharia de cardápio
-- Rodar uma vez:
--   docker exec -i dados_postgres psql -U alvaro -d operacao < painel/custos.sql

CREATE TABLE IF NOT EXISTS produto_custos (
    nome           TEXT PRIMARY KEY,        -- nome normalizado (minúsculo, sem espaços nas pontas)
    custo          NUMERIC(12,2) NOT NULL,  -- CMV unitário em R$
    atualizado_em  TIMESTAMPTZ DEFAULT now()
);

-- Os custos são cadastrados direto na página Cardápio do painel.
-- Nomes com variação de caixa (Fera / FERA) são unificados automaticamente.
