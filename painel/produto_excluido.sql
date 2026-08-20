-- Tabela de produtos excluídos da análise de cardápio (quadrante mágico,
-- lista de custos, radar de encalhados) — não excluídos das vendas/DRE.
-- Rodar uma vez:
--   docker exec -i dados_postgres psql -U alvaro -d operacao < painel/produto_excluido.sql

CREATE TABLE IF NOT EXISTS produto_excluido (
    nome         TEXT PRIMARY KEY,   -- nome canônico (o mesmo usado em produto_custos)
    excluido_em  TIMESTAMPTZ DEFAULT now()
);

-- Exclusão/restauração ficam direto na página Cardápio do painel.
