-- Fornecedores: entrega, prazo de pagamento e valor médio mensal
-- Rodar uma vez:
--   docker exec -i dados_postgres psql -U alvaro -d operacao < painel/fornecedores.sql

CREATE TABLE IF NOT EXISTS fornecedores (
    nome           TEXT PRIMARY KEY,
    dias_entrega   TEXT NOT NULL,          -- 'todos' ou lista tipo 'seg,qua,sex' (0=seg..6=dom por nome)
    prazo_dias     INT NOT NULL,           -- prazo de pagamento
    valor_mensal   NUMERIC(12,2) NOT NULL, -- média mensal de compra
    categoria      TEXT DEFAULT 'seco',    -- perecivel | seco
    atualizado_em  TIMESTAMPTZ DEFAULT now()
);

INSERT INTO fornecedores (nome, dias_entrega, prazo_dias, valor_mensal, categoria) VALUES
    ('Ki Karnes',   'todos',       30, 6300.00, 'perecivel'),
    ('Delly''s',    'qua,sex',     21, 4509.13, 'seco'),
    ('Pão e Roça',  'seg,qua,sex',  7, 1839.50, 'perecivel'),
    ('Brasal',      'qua,sab',     10, 1112.04, 'seco'),
    ('Garra',       'seg,ter,qua', 14, 1000.00, 'seco'),
    ('Ambev',       'todos',        3,  527.08, 'seco'),
    ('Juju Batata', 'todos',       21,  450.00, 'perecivel')
ON CONFLICT (nome) DO UPDATE SET
    dias_entrega = EXCLUDED.dias_entrega,
    prazo_dias = EXCLUDED.prazo_dias,
    valor_mensal = EXCLUDED.valor_mensal,
    categoria = EXCLUDED.categoria,
    atualizado_em = now();

SELECT nome, dias_entrega, prazo_dias, valor_mensal FROM fornecedores ORDER BY valor_mensal DESC;
