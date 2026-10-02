-- Guarana Zero passa a ser um insumo proprio (antes todo guarana caia em
-- "Guarana Normal"), pra aparecer separado em Compras e ter estoque/custo proprios.
-- Mesmo fornecedor e custo do Guarana Normal (nota BEES/Ambev de 02/10/2026).
-- A deteccao do sabor esta em _CASE_REFRI (app.py) e em calcular_consumo_pedido()
-- (baixa_estoque.sql, reaplicar apos este arquivo).

INSERT INTO insumo_custo (insumo, custo_unitario) VALUES ('Guaraná Zero', 2.37)
ON CONFLICT (insumo) DO NOTHING;

INSERT INTO insumo_fornecedor (insumo, fornecedor) VALUES ('Guaraná Zero', 'Ambev')
ON CONFLICT (insumo) DO NOTHING;

-- venda avulsa (nome digitado com erro no cardapio: "guarana antatica zero")
INSERT INTO ficha_tecnica (produto, insumo, qtd, unidade) VALUES
('guarana antática zero', 'Guaraná Zero', 1, 'un')
ON CONFLICT DO NOTHING;
