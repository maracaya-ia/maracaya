-- Comissões por canal de venda (iFood, 99Food, site...)
-- Rodar uma vez:
--   docker exec -i dados_postgres psql -U alvaro -d operacao < painel/taxas.sql

CREATE TABLE IF NOT EXISTS canal_taxas (
    origem         TEXT PRIMARY KEY,          -- valor do campo origem dos pedidos
    comissao_pct   NUMERIC(5,2) NOT NULL,     -- % que o canal cobra sobre o pedido
    atualizado_em  TIMESTAMPTZ DEFAULT now()
);

-- As comissões são cadastradas direto na Visão geral do painel.
-- Canal sem comissão cadastrada aparece marcado como "configurar".
