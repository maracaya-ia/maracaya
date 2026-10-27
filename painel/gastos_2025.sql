-- 2025: fornecedores com histórico nas conversas/portais (Delly's está em gastos_delly_nfs.sql)
INSERT INTO gastos_fornecedor (fornecedor, mes, categoria, valor, quantidade, origem, obs) VALUES
 ('Ki Karnes','2025-08-01','Discos de hambúrguer',1223.05,263,'nota','extrato do Aragão: compras de 26/08 (R$ 697,60) e 30/08 (R$ 525,45), disco a R$ 4,65; as compras de antes do grupo não estão na conversa'),
 ('Ki Karnes','2025-09-01','Discos de hambúrguer',4048.90,870,'nota','extrato do Aragão: R$ 465,00 (04/09), 697,50 (07/09), 697,50 (14/09), 697,50 (23/09), 279,00 (25/09), 747,40 (27/09), 465,00 (30/09)'),
 ('Ki Karnes','2025-10-01','Discos de hambúrguer',4441.50,950,'estimado','pedidos de 100 a 150 discos (9 pedidos) a R$ 4,65 + 4 de costela a R$ 6,00'),
 ('Ki Karnes','2025-11-01','Discos de hambúrguer',5376.00,1050,'estimado','pedidos de 100 a 150 discos: R$ 4,65 até 07/11 e R$ 5,20 depois do reajuste; costela a R$ 6,20'),
 ('Ki Karnes','2025-12-01','Discos de hambúrguer',3285.00,600,'estimado','4 pedidos de 150 discos a R$ 5,20 + R$ 165 de costela; saldo de crédito de R$ 398,33 em 26/12'),
 ('Brasal','2025-10-01','Bebidas',358.90,NULL,'estimado','1º pedido em 28/10: 6 fardos de Coca-Cola e 6 de Coca Zero'),
 ('Brasal','2025-11-01','Bebidas',492.84,NULL,'estimado','pedidos de 18/11 (6 Coca e 6 Zero) e 25/11 (3 sucos e 4 Zero)'),
 ('Brasal','2025-12-01','Bebidas',476.26,NULL,'estimado','pedidos de 02/12 (cocas e águas) e 23/12 (cocas e 2 fardos de Heineken); pedido mínimo de R$ 325 não foi atingido em alguns'),
 ('Ambev','2025-09-01','Bebidas',602.16,NULL,'pago','fatura de R$ 602,16 (venc. 12/09)'),
 ('Ambev','2025-11-01','Bebidas',197.72,NULL,'pago','fatura de R$ 197,72 (venc. 25/11)'),
 ('Ambev','2025-12-01','Bebidas',193.87,NULL,'pago','fatura de R$ 193,87 (venc. 10/12)'),
 ('Juju Batata','2025-08-01','Batata palha',1200,8,'estimado','8 caixas pedidas entre 03 e 27/08 (R$ 150 cada)'),
 ('Juju Batata','2025-09-01','Batata palha',900,6,'estimado','6 caixas (02, 09 e 15/09); entrega de 24/09 sem quantidade na conversa'),
 ('Juju Batata','2025-10-01','Batata palha',1200,8,'estimado','8 caixas (08, 20 e 28/10); saldo em aberto de R$ 900 em 23/10'),
 ('Juju Batata','2025-12-01','Batata palha',300,2,'estimado','2 caixas entregues em 23/12; saldo em aberto de R$ 1.200 em 24/12; novembro sem registro de caixas')
ON CONFLICT (fornecedor, mes, categoria) DO NOTHING;

-- Pão e Roça 2025 (cenário A): pedidos confirmados por você ("temos sim, N") x preços dos acertos do Murilo (brioche R$ 2,70, australiano R$ 1,90, gergelim R$ 2,70 assumido)
INSERT INTO gastos_fornecedor (fornecedor, mes, categoria, valor, quantidade, origem, obs) VALUES
 ('Pão e Roça','2025-07-01','Pães',162.00,60,'estimado','1 pedido de 60 brioches em 30/07'),
 ('Pão e Roça','2025-08-01','Pães',2242.80,852,'estimado','780 brioches e 72 australianos em 12 pedidos; brioche R$ 2,70 e australiano R$ 1,90'),
 ('Pão e Roça','2025-09-01','Pães',3358.20,1258,'estimado','1.210 brioches e 48 australianos; pedidos de 150 desde 07/09'),
 ('Pão e Roça','2025-10-01','Pães',2198.00,820,'estimado','800 brioches e 20 australianos; acertos semanais do Murilo de R$ 218,70 e R$ 265,20 sugerem valor menor'),
 ('Pão e Roça','2025-11-01','Pães',3402.00,1260,'estimado','1.200 brioches e 60 de gergelim (gergelim a R$ 2,70, assumido)'),
 ('Pão e Roça','2025-12-01','Pães',2748.20,1038,'estimado','970 brioches e 68 australianos; acertos semanais de R$ 324 a R$ 370 sugerem valor menor')
ON CONFLICT (fornecedor, mes, categoria) DO NOTHING;
