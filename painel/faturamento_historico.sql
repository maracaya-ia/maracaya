-- Faturamento mensal do grupo (arquivo "faturamento-grupo-maracaya.pdf", todas as marcas e unidades
-- unificadas). Ate junho so existia a Maracaya (GC + Sobradinho): o total do arquivo e dividido no grafico
-- usando o Sobradinho do banco de pedidos; o GC e o que sobra. De julho em diante vale o banco
-- (usar = false); trocar pra true usa o arquivo no mes.
CREATE TABLE IF NOT EXISTS faturamento_historico (
    mes          TEXT PRIMARY KEY,           -- 'YYYY-MM'
    faturamento  NUMERIC(12,2) NOT NULL,
    usar         BOOLEAN NOT NULL DEFAULT false,
    fonte        TEXT NOT NULL DEFAULT 'arquivo faturamento-grupo-maracaya.pdf'
);
INSERT INTO faturamento_historico (mes, faturamento, usar) VALUES
('2026-01', 25855.97, true), ('2026-02', 34507.41, true), ('2026-03', 38415.65, true),
('2026-04', 43755.48, true), ('2026-05', 40257.11, true), ('2026-06', 44767.13, true),
('2026-07', 46291.16, false), ('2026-08', 38788.12, false), ('2026-09', 49227.73, false)
ON CONFLICT (mes) DO UPDATE SET faturamento = EXCLUDED.faturamento;
