-- Configurações do DRE (imposto e custo de entrega)
-- Rodar uma vez:
--   docker exec -i dados_postgres psql -U alvaro -d operacao < painel/dre.sql

CREATE TABLE IF NOT EXISTS dre_config (
    chave          TEXT PRIMARY KEY,
    valor          NUMERIC(12,2) NOT NULL,
    atualizado_em  TIMESTAMPTZ DEFAULT now()
);

-- Valores iniciais (edite direto na aba DRE do painel):
--   imposto_pct    -> % sobre a receita (ex: Simples Nacional)
--   custo_entrega  -> R$ pago por entrega (motoboy)
INSERT INTO dre_config (chave, valor) VALUES
    ('imposto_pct', 0),
    ('custo_entrega', 0)
ON CONFLICT (chave) DO NOTHING;
