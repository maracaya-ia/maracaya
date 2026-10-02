-- Custo por grama dos molhos (pouch Junior 1,1 kg; barbecue Heinz 2 kg), precos da foto do marketplace.
-- Maionese de Bacon  R$ 46,49 / 1.100 g = 0,0423
-- Molho Parmesao     R$ 33,09 / 1.100 g = 0,0301
-- Maionese Temperada R$ 39,89 / 1.100 g = 0,0363  (assumido = "Molho Ervas Finas")
-- Molho Ranch        R$ 33,89 / 1.100 g = 0,0308
-- Molho Barbecue     R$ 43,49 / 2.000 g = 0,0217
-- "Molho Baconese" (escolhido no pedido) assumido = mesma Baconnaise da bolsa de Maionese Bacon.
INSERT INTO insumo_custo (insumo, custo_unitario, atualizado_em) VALUES
('Maionese de Bacon', 0.0423, now()),
('Molho Baconese', 0.0423, now()),
('Molho Parmesão', 0.0301, now()),
('Molho Ervas Finas', 0.0363, now()),
('Molho Ranch', 0.0308, now()),
('Molho Barbecue', 0.0217, now())
ON CONFLICT (insumo) DO UPDATE SET custo_unitario = EXCLUDED.custo_unitario, atualizado_em = EXCLUDED.atualizado_em;

-- mesmos fornecedor do Maionese Grill / Bacon / Ranch (marketplace Junior/Heinz) - ajustar se for outro
INSERT INTO insumo_fornecedor (insumo, fornecedor) VALUES
('Molho Parmesão', 'Delly''s'),
('Molho Ervas Finas', 'Delly''s'),
('Molho Barbecue', 'Delly''s'),
('Molho Baconese', 'Delly''s')
ON CONFLICT (insumo) DO NOTHING;

-- Batata McCain 7mm Fast Food 2,5 kg (Delly's, cod. 158269): R$ 15,29/kg = 0,01529/g (antes 0,0146)
UPDATE insumo_custo SET custo_unitario = 0.015290, atualizado_em = now() WHERE insumo = 'Batata Frita';

-- Queijos Ópera 2,27 kg com 184 fatias (Delly's): cheddar R$ 38,89/kg, mussarela R$ 33,89/kg
-- cheddar: 38,89 x 2,27 / 184 = 0,4798 por fatia (antes 2,27, que era o peso do pacote); mussarela: 0,4181
INSERT INTO insumo_custo (insumo, custo_unitario, atualizado_em) VALUES
('Queijo Cheddar', 0.479784, now()), ('Queijo Mussarela', 0.418099, now())
ON CONFLICT (insumo) DO UPDATE SET custo_unitario = EXCLUDED.custo_unitario, atualizado_em = EXCLUDED.atualizado_em;
INSERT INTO insumo_embalagem (insumo, nome, qtd) VALUES ('Queijo Cheddar', 'pacote', 184), ('Queijo Mussarela', 'pacote', 184)
ON CONFLICT (insumo) DO UPDATE SET nome = EXCLUDED.nome, qtd = EXCLUDED.qtd;
