-- Delly's: pedidos de setembro e 02/10 vistos na conversa ("mandei") que ainda não tinham nota nos arquivos
ALTER TABLE gastos_itens ADD COLUMN IF NOT EXISTS detalhe text;
DELETE FROM gastos_itens WHERE fornecedor = 'Delly''s' AND doc IN ('duplicata 1177230 (03/09)','pedido 09/09','pedido 10/09','pedido 21/09','pedido 24/09','pedido 02/10');
INSERT INTO gastos_itens (fornecedor, mes, item, grupo, quantidade, unidade, preco_unit, valor, origem, doc, detalhe) VALUES
 ('Delly''s','2026-09-01','Batata palito 7 mm','Batata',25,'kg',15.00,375.00,'nota','duplicata 1177230 (03/09)','McCain'),
 ('Delly''s','2026-09-01','Ketchup Heinz sachê 7 g (cx 144)','Molhos e sachês',5,'cx',24.50,122.50,'nota','duplicata 1177230 (03/09)',NULL),
 ('Delly''s','2026-09-01','Mostarda Heinz sachê 5 g (cx 144)','Molhos e sachês',5,'cx',25.69,128.45,'nota','duplicata 1177230 (03/09)',NULL),
 ('Delly''s','2026-09-01','Queijo mussarela fatiado 2,27 kg','Queijos',1,'pct',75.34,75.34,'nota','duplicata 1177230 (03/09)',NULL),
 ('Delly''s','2026-09-01','Cheddar fatiado','Queijos',18.16,'kg',38.86,705.70,'estimado','pedido 09/09','Opera 2,27 kg (8 barras)'),
 ('Delly''s','2026-09-01','Maionese grill Junior 1,1 kg','Molhos e sachês',10,'un',37.80,378.00,'estimado','pedido 10/09',NULL),
 ('Delly''s','2026-09-01','Sal Parrilla c/ ervas finas 330 g','Temperos',12,'un',9.85,118.20,'estimado','pedido 10/09','Fritz'),
 ('Delly''s','2026-09-01','Batata palito 7 mm','Batata',37.5,'kg',15.00,562.50,'estimado','pedido 21/09','McCain'),
 ('Delly''s','2026-09-01','Ketchup Heinz sachê 7 g (cx 144)','Molhos e sachês',5,'cx',24.50,122.50,'estimado','pedido 21/09',NULL),
 ('Delly''s','2026-09-01','Mostarda Heinz sachê 5 g (cx 144)','Molhos e sachês',5,'cx',25.69,128.45,'estimado','pedido 21/09',NULL),
 ('Delly''s','2026-09-01','Maionese grill Junior 1,1 kg','Molhos e sachês',25,'un',37.80,945.00,'estimado','pedido 21/09',NULL),
 ('Delly''s','2026-09-01','Ketchup Heinz 2 kg','Molhos e sachês',1,'un',31.34,31.34,'estimado','pedido 21/09',NULL),
 ('Delly''s','2026-09-01','Frango empanado Supreme 2,5 kg','Proteínas',5,'kg',29.90,149.50,'estimado','pedido 21/09','Seara'),
 ('Delly''s','2026-09-01','Maionese temperada Junior 1,1 kg','Molhos e sachês',2,'un',38.70,77.40,'estimado','pedido 21/09',NULL),
 ('Delly''s','2026-09-01','Cheddar fatiado','Queijos',9.08,'kg',38.86,352.85,'estimado','pedido 21/09','Opera 2,27 kg'),
 ('Delly''s','2026-09-01','Papel toalha Nobre (pacote 1000 folhas)','Descartáveis e limpeza',15,'pct',19.52,292.80,'estimado','pedido 24/09','interfolhas 20×20 cm'),
 ('Delly''s','2026-09-01','Batata palito 7 mm','Batata',37.5,'kg',15.00,562.50,'estimado','pedido 24/09','McCain'),
 ('Delly''s','2026-09-01','Óleo de algodão (balde)','Óleo',1,'un',197.98,197.98,'estimado','pedido 24/09','Elogiata 14,5 kg'),
 ('Delly''s','2026-10-01','Batata palito 7 mm','Batata',37.5,'kg',15.00,562.50,'estimado','pedido 02/10','McCain'),
 ('Delly''s','2026-10-01','Ketchup Heinz sachê 7 g (cx 144)','Molhos e sachês',5,'cx',24.50,122.50,'estimado','pedido 02/10',NULL),
 ('Delly''s','2026-10-01','Mostarda Heinz sachê 5 g (cx 144)','Molhos e sachês',5,'cx',25.69,128.45,'estimado','pedido 02/10',NULL);
UPDATE gastos_fornecedor SET valor = 6731.06, origem = 'estimado',
  obs = 'duplicatas 1177230 (R$ 946,96) e 1179052 (R$ 1.159,38) + pedidos "mandados" de 09/09 (cheddar), 10/09, 21/09 (R$ 2.369,54) e 24/09 (R$ 1.053,28), sem nota nos arquivos; pagos em 30/09 os dois boletos com juros e multa de R$ 95,69'
 WHERE fornecedor = 'Delly''s' AND mes = '2026-09-01';
UPDATE gastos_fornecedor SET valor = 3149.93, origem = 'estimado',
  obs = 'boleto do DDA de R$ 2.336,48 (pedido de 07/10, vence 30/10) + pedido de 02/10 (R$ 813,45) sem nota nos arquivos'
 WHERE fornecedor = 'Delly''s' AND mes = '2026-10-01';
