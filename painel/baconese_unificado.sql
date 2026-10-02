-- "Molho Baconese" escolhido no pedido e a mesma Baconnaise da bolsa de Maionese de Bacon:
-- um unico insumo (Maionese de Bacon) pra nao ter o mesmo estoque contado em duas linhas.
DELETE FROM insumo_unidade WHERE insumo = 'Molho Baconese';
DELETE FROM insumo_custo WHERE insumo = 'Molho Baconese';
DELETE FROM insumo_fornecedor WHERE insumo = 'Molho Baconese';
DELETE FROM insumo_embalagem WHERE insumo = 'Molho Baconese';
DELETE FROM insumo_estoque WHERE insumo = 'Molho Baconese';
DELETE FROM pedido_baixa_estoque WHERE insumo = 'Molho Baconese';
