-- Hortifruti (alface, tomate, rucula, cebolas) e comprado no mercado, nao na Delly's.
-- Fornecedor "Mercado": compra local, sem boleto (prazo 0), valor mensal 0 (nao entra no calendario de boletos).
INSERT INTO fornecedores (nome, dias_entrega, prazo_dias, valor_mensal, categoria, antecedencia_dias, cobertura_dias, atualizado_em)
VALUES ('Mercado', 'todos', 0, 0, 'perecivel', 0, 3, now())
ON CONFLICT (nome) DO NOTHING;

INSERT INTO insumo_fornecedor (insumo, fornecedor) VALUES
('Alface', 'Mercado'), ('Tomate', 'Mercado'), ('Rúcula', 'Mercado'),
('Cebola Roxa', 'Mercado'), ('Cebola Branca', 'Mercado')
ON CONFLICT (insumo) DO UPDATE SET fornecedor = EXCLUDED.fornecedor;
