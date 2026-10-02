-- Estoque minimo + rota do fornecedor.
-- antecedencia_dias: com quantos dias de antecedencia o pedido precisa ser feito
-- pra entrar na rota (1 = pedir ate o dia anterior a entrega). Ajustar por fornecedor.
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS antecedencia_dias INTEGER NOT NULL DEFAULT 1;

-- minimo manual por insumo; sem linha = minimo automatico
-- (consumo/dia x (antecedencia + maior intervalo entre entregas) x (1 + seguranca))
CREATE TABLE IF NOT EXISTS insumo_minimo (
    insumo TEXT PRIMARY KEY,
    minimo NUMERIC(12,3) NOT NULL CHECK (minimo >= 0)
);
