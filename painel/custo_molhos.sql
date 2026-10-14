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

-- Sal Lebre sache Bom Sabor 2000 x 0,8 g (Delly's, cod. 10211): R$ 27,49 / 2000 = 0,013745 por sache
INSERT INTO insumo_custo (insumo, custo_unitario, atualizado_em) VALUES ('Sachê de Sal', 0.013745, now())
ON CONFLICT (insumo) DO UPDATE SET custo_unitario = EXCLUDED.custo_unitario, atualizado_em = EXCLUDED.atualizado_em;

-- Hamburguer de frango Seara 2 kg com 20 un a R$ 55,99 = 2,7995 cada
-- Nuggets Chicken Supreme Seara 2,5 kg (R$ 29,49/kg = R$ 73,73 o pacote) com ~115 un = 0,6411 cada
INSERT INTO insumo_custo (insumo, custo_unitario, atualizado_em) VALUES
('Hambúrguer de Frango', 2.799500, now()), ('Nuggets', 0.641087, now())
ON CONFLICT (insumo) DO UPDATE SET custo_unitario = EXCLUDED.custo_unitario, atualizado_em = EXCLUDED.atualizado_em;
INSERT INTO insumo_embalagem (insumo, nome, qtd) VALUES ('Hambúrguer de Frango', 'pacote', 20), ('Nuggets', 'pacote', 115)
ON CONFLICT (insumo) DO UPDATE SET nome = EXCLUDED.nome, qtd = EXCLUDED.qtd;

-- Papel kraft: R$ 0,07 por unidade (informado pelo Alvaro em 14/10/2026)
INSERT INTO insumo_custo (insumo, custo_unitario, atualizado_em) VALUES ('Papel Kraft', 0.07, now())
ON CONFLICT (insumo) DO UPDATE SET custo_unitario = EXCLUDED.custo_unitario, atualizado_em = EXCLUDED.atualizado_em;
