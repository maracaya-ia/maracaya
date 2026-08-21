-- Custo unitário por insumo (matéria-prima) — usado pra calcular o gasto
-- médio diário em R$ no Plano de estoque, separado do custo por produto
-- final (produto_custos).
-- Rodar uma vez:
--   docker exec -i dados_postgres psql -U alvaro -d operacao < painel/insumo_custo.sql

CREATE TABLE IF NOT EXISTS insumo_custo (
    insumo         TEXT PRIMARY KEY,        -- mesmo nome usado em ficha_tecnica.insumo
    custo_unitario NUMERIC(12,2) NOT NULL,  -- custo por unidade (kg ou un, conforme ficha_tecnica)
    atualizado_em  TIMESTAMPTZ DEFAULT now()
);

-- Os custos são cadastrados direto na página Compras do painel.
