-- Notas de julho/2026 - lote 2 (Garra, Ambev, Pão e Roça)
-- Rodar:
--   docker exec -i dados_postgres psql -U alvaro -d operacao < painel/notas_lote2.sql

INSERT INTO notas_fiscais (fornecedor, numero, data_emissao, valor, vencimento) VALUES
    ('Garra',      'ORC-167706728',           '2026-07-21', 729.87,  '2026-08-04'),
    ('Ambev',      '051-001-0710-000424610',  '2026-07-16', 675.12,  '2026-07-20'),
    ('Pão e Roça', 'PR-JUL-01',               '2026-07-21', 1706.10, NULL)
ON CONFLICT (fornecedor, numero) DO UPDATE
    SET valor = EXCLUDED.valor, data_emissao = EXCLUDED.data_emissao,
        vencimento = EXCLUDED.vencimento;

-- Gasto real de julho por fornecedor (acumulado até agora)
SELECT fornecedor, count(*) AS notas, sum(valor) AS total_mes
FROM notas_fiscais
WHERE data_emissao >= DATE '2026-07-01' AND data_emissao < DATE '2026-08-01'
GROUP BY 1 ORDER BY 3 DESC;
