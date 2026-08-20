-- Notas fiscais registradas (gasto real por fornecedor/mês)
-- Rodar:
--   docker exec -i dados_postgres psql -U alvaro -d operacao < painel/notas.sql

CREATE TABLE IF NOT EXISTS notas_fiscais (
    id             SERIAL PRIMARY KEY,
    fornecedor     TEXT NOT NULL,
    numero         TEXT,
    data_emissao   DATE,
    valor          NUMERIC(12,2) NOT NULL,
    vencimento     DATE,
    registrado_em  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (fornecedor, numero)
);

-- Notas de julho/2026 já lidas pelo Claude
INSERT INTO notas_fiscais (fornecedor, numero, data_emissao, valor, vencimento) VALUES
    ('Ki Karnes', 'NF-508',      '2026-07-12', 2860.80, '2026-08-13'),
    ('Ki Karnes', 'NF-503',      '2026-07-06', 2246.40, '2026-08-06'),
    ('Brasal',    'NF-17710992', '2026-07-14', 1341.36, '2026-07-27'),
    ('Delly''s',  'IMG-01',      '2026-07-01', 1730.83, NULL),
    ('Delly''s',  'IMG-02',      '2026-07-01', 2765.04, NULL)
ON CONFLICT (fornecedor, numero) DO UPDATE
    SET valor = EXCLUDED.valor, data_emissao = EXCLUDED.data_emissao,
        vencimento = EXCLUDED.vencimento;

-- Confere o gasto real de julho por fornecedor
SELECT fornecedor,
       count(*) AS notas,
       sum(valor) AS total_mes
FROM notas_fiscais
WHERE data_emissao >= date_trunc('month', DATE '2026-07-01')
  AND data_emissao < date_trunc('month', DATE '2026-08-01')
GROUP BY 1 ORDER BY 3 DESC;
