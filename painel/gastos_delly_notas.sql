-- Delly's: notas fiscais do site dellys.com.br/notasFiscais (conta Maracayá), por mês de emissão
DELETE FROM gastos_fornecedor WHERE fornecedor = 'Delly''s';
INSERT INTO gastos_fornecedor (fornecedor, mes, categoria, valor, origem, obs) VALUES
 ('Delly''s','2026-01-01','Insumos secos',3067.35,'nota','4 NFs: 1036719 (06/01) R$ 849,20, 1042900 (15/01) R$ 464,04, 1045777 (20/01) R$ 718,31, 1051689 (29/01) R$ 1.035,80'),
 ('Delly''s','2026-02-01','Insumos secos',3729.34,'nota','4 NFs: 1055963 (05/02), 1058544 (10/02), 1063156 (18/02) R$ 1.498,11, 1065975 (24/02)'),
 ('Delly''s','2026-03-01','Insumos secos',4312.22,'nota','5 NFs: 1071660 (05/03) R$ 2.589,67, 1075699, 1079883, 1084058, 1087000 (31/03)'),
 ('Delly''s','2026-04-01','Insumos secos',8865.93,'nota','4 NFs: 1088211 (01/04) R$ 3.766,66, 1095835, 1099709, 1103975 (29/04) R$ 3.753,56; maior mês do ano'),
 ('Delly''s','2026-05-01','Insumos secos',4155.21,'nota','5 NFs: 1112087 (14/05), 1114879, 1118857, 1120512 e 1121008 (28/05)'),
 ('Delly''s','2026-06-01','Insumos secos',3901.54,'nota','4 NFs: 1124031 (04/06) R$ 1.902,42, 1126816 e 1126818 (09/06), 1131196 (16/06)'),
 ('Delly''s','2026-07-01','Insumos secos',5217.22,'nota','3 NFs: 1140735 (02/07) R$ 2.773,04, 1152768 (23/07) R$ 1.744,38, 1156550 (29/07) R$ 699,80'),
 ('Delly''s','2026-08-01','Insumos secos',3324.03,'nota','2 NFs: 1158639 (03/08) R$ 1.838,67 e 1167426 (18/08) R$ 1.485,36'),
 ('Delly''s','2026-09-01','Insumos secos',4398.70,'nota','4 NFs: 1177230 (02/09) R$ 946,96, 1179052 (07/09) R$ 1.159,38, 1181290 (10/09) R$ 1.220,49, 1197403 (24/09) R$ 1.071,87; o pedido de 21/09 (R$ 2.369,54) foi para outro CNPJ'),
 ('Delly''s','2026-10-01','Insumos secos',3168.52,'nota','2 NFs: 1202767 (01/10) R$ 832,04 e 1207376 (08/10) R$ 2.336,48 (vence 30/10)');
-- itens: some o pedido de 21/09 (outro CNPJ) e liga os pedidos às notas
DELETE FROM gastos_itens WHERE fornecedor = 'Delly''s' AND doc = 'pedido 21/09';
UPDATE gastos_itens SET doc = 'NF 1181290 (10/09)', origem = 'nota' WHERE fornecedor = 'Delly''s' AND doc IN ('pedido 09/09','pedido 10/09');
UPDATE gastos_itens SET doc = 'NF 1197403 (24/09)', origem = 'nota' WHERE fornecedor = 'Delly''s' AND doc = 'pedido 24/09';
UPDATE gastos_itens SET doc = 'NF 1202767 (01/10)', origem = 'nota' WHERE fornecedor = 'Delly''s' AND doc = 'pedido 02/10';
UPDATE gastos_itens SET doc = 'NF 1177230 (02/09)' WHERE fornecedor = 'Delly''s' AND doc = 'duplicata 1177230 (03/09)';
INSERT INTO gastos_itens (fornecedor, mes, item, grupo, quantidade, unidade, preco_unit, valor, origem, doc, detalhe) VALUES
 ('Delly''s','2026-09-01','Frete e ajustes','Frete e ajustes',1,'un',18.59,18.59,'nota','NF 1181290 (10/09)',NULL),
 ('Delly''s','2026-09-01','Frete e ajustes','Frete e ajustes',1,'un',18.59,18.59,'nota','NF 1197403 (24/09)',NULL),
 ('Delly''s','2026-10-01','Frete e ajustes','Frete e ajustes',1,'un',18.59,18.59,'nota','NF 1202767 (01/10)',NULL);
UPDATE fornecedores SET valor_mensal = 4030, atualizado_em = now() WHERE nome = 'Delly''s';
