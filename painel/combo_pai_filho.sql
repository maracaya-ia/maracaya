-- Ficha tecnica do "Combo Pai e Filho + Brinde" estava faltando - o produto
-- nao tinha nenhuma receita cadastrada, entao o consumo dele ficava invisivel
-- em Compras, na MIA e na baixa automatica de estoque (nenhum insumo descontado).
-- Composicao confirmada com o Alvaro: 4 ferinhas + 2 bebidas.
--
-- Mesma base de insumos da "ferinha" avulsa (x4), com o refrigerante seguindo
-- o padrao dos outros combos "c/refri": linha fixa de Guarana Normal que o
-- calcular_consumo_pedido()/estoque_plano()/MIA substituem pelo sabor real
-- escolhido pelo cliente (via pedido_complementos), quando houver.

INSERT INTO ficha_tecnica (produto, insumo, qtd, unidade) VALUES
('combo pai e filho + brinde', 'Carne Angus', 4, 'un'),
('combo pai e filho + brinde', 'Guardanapo', 4, 'un'),
('combo pai e filho + brinde', 'Maionese Grill', 4, 'un'),
('combo pai e filho + brinde', 'Pão Brioche', 4, 'un'),
('combo pai e filho + brinde', 'Papel Acoplado', 4, 'un'),
('combo pai e filho + brinde', 'Papel Kraft', 4, 'un'),
('combo pai e filho + brinde', 'Queijo Cheddar', 8, 'un'),
('combo pai e filho + brinde', 'Sachê de Ketchup', 4, 'un'),
('combo pai e filho + brinde', 'Sachê de Mostarda', 4, 'un'),
('combo pai e filho + brinde', 'Guaraná Normal', 2, 'un');
