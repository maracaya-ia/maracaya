-- Hexa: ketchup e mostarda aplicados no lanche (nao sao o sacher entregue junto),
-- controlados em gramas: ~30 g de cada por lanche.
-- Ketchup Heinz bag 2 kg R$ 30,49 = 0,0152/g (mostarda: preco ainda nao informado).
-- "Molho Maracaya" escolhido no pedido e a propria Maionese Grill (ver _CASE_MOLHO).

INSERT INTO insumo_unidade (insumo, unidade) VALUES ('Ketchup', 'g'), ('Mostarda', 'g')
ON CONFLICT (insumo) DO NOTHING;
DELETE FROM insumo_unidade WHERE insumo = 'Molho Maracayá';

DELETE FROM ficha_tecnica
WHERE produto IN ('hexa', 'combo hexa c/refri + copo edição limitada')
  AND insumo IN ('Sachê de Ketchup', 'Sachê de Mostarda');
INSERT INTO ficha_tecnica (produto, insumo, qtd, unidade) VALUES
('hexa', 'Ketchup', 30, 'g'),
('hexa', 'Mostarda', 30, 'g'),
('combo hexa c/refri + copo edição limitada', 'Ketchup', 30, 'g'),
('combo hexa c/refri + copo edição limitada', 'Mostarda', 30, 'g')
ON CONFLICT (produto, insumo) DO UPDATE SET qtd = EXCLUDED.qtd, unidade = EXCLUDED.unidade;

INSERT INTO insumo_custo (insumo, custo_unitario, atualizado_em) VALUES ('Ketchup', 0.0152, now())
ON CONFLICT (insumo) DO UPDATE SET custo_unitario = EXCLUDED.custo_unitario, atualizado_em = EXCLUDED.atualizado_em;
INSERT INTO insumo_fornecedor (insumo, fornecedor) VALUES ('Ketchup', 'Delly''s'), ('Mostarda', 'Delly''s')
ON CONFLICT (insumo) DO NOTHING;

-- Mostarda Heinz bag 2 kg R$ 37,89 = 0,0189/g
INSERT INTO insumo_custo (insumo, custo_unitario, atualizado_em) VALUES ('Mostarda', 0.0189, now())
ON CONFLICT (insumo) DO UPDATE SET custo_unitario = EXCLUDED.custo_unitario, atualizado_em = EXCLUDED.atualizado_em;
