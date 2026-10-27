-- gasto mensal por fornecedor e categoria (hoje: discos de hambúrguer). origem diz se o valor é estimado ou documentado.
CREATE TABLE IF NOT EXISTS gastos_fornecedor (
    id          serial PRIMARY KEY,
    fornecedor  text NOT NULL,
    mes         date NOT NULL,                       -- sempre o dia 1 do mês
    categoria   text NOT NULL DEFAULT 'Discos de hambúrguer',
    valor       numeric(12,2) NOT NULL CHECK (valor >= 0),
    quantidade  numeric(12,2),                       -- ex.: discos comprados
    origem      text NOT NULL DEFAULT 'estimado' CHECK (origem IN ('estimado','nota','pago')),
    obs         text,
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    UNIQUE (fornecedor, mes, categoria)
);

INSERT INTO gastos_fornecedor (fornecedor, mes, valor, quantidade, origem, obs) VALUES
 ('Ki Karnes','2026-01-01',5000,920,'estimado','pedidos do grupo, preço R$ 5,20'),
 ('Ki Karnes','2026-02-01',6800,1290,'estimado','pedidos do grupo, preço R$ 5,20'),
 ('Ki Karnes','2026-03-01',6200,1200,'estimado','até 26/03, preço R$ 5,20'),
 ('Ki Karnes','2026-04-01',2470,450,'estimado','notas 448 e 449 (200 + 250 discos + 50 costela), R$ 4,80'),
 ('Ki Karnes','2026-05-01',7200,1500,'estimado','pedidos do grupo, R$ 4,80'),
 ('Ki Karnes','2026-06-01',5300,1100,'estimado','pedidos do grupo, R$ 4,80'),
 ('Ki Karnes','2026-07-01',6000,1250,'estimado','pedidos do grupo, R$ 4,80'),
 ('Ki Karnes','2026-08-01',8000,1670,'estimado','notas anexadas até 22/08 (R$ 5.950) + entregas de 25 e 28/08'),
 ('Ki Karnes','2026-09-01',10100,2100,'nota','5 notas anexadas (484 + 2.122 + 3.372 + 3.000 + 1.123)'),
 ('Ki Karnes','2026-10-01',8000,1500,'estimado','notas até 18/10 (R$ 5.540) + entregas até 27/10; disco a R$ 5,50 desde 09/10'),
 ('Guiguiba','2026-03-01',1000,200,'estimado','200 discos em 27/03, R$ 5,00, boleto 21 dias'),
 ('Guiguiba','2026-04-01',2500,500,'estimado','300 em 02/04 e 200 em 23/04, R$ 5,00'),
 ('Guiguiba','2026-05-01',1250,250,'estimado','250 discos, R$ 5,00')
ON CONFLICT (fornecedor, mes, categoria) DO NOTHING;

INSERT INTO gastos_fornecedor (fornecedor, mes, categoria, valor, origem, obs) VALUES
 ('Delly''s','2026-07-01','Insumos secos',2444.18,'nota','duplicatas 1152768 (R$ 1.744,38, venc 14/08) e 1156550 (R$ 699,80, venc 20/08)'),
 ('Delly''s','2026-08-01','Insumos secos',3324.03,'nota','NF 1158639 (R$ 1.838,67, venc 25/08) e duplicata 1167426 (R$ 1.485,36, venc 09/09); pedido de 17/08 teve R$ 3.174,16, o restante não está nos documentos'),
 ('Delly''s','2026-09-01','Insumos secos',2106.34,'nota','duplicatas 1177230 (R$ 946,96, venc 24/09) e 1179052 (R$ 1.159,38, venc 29/09); pagos em 30/09 com juros e multa de R$ 95,69'),
 ('Delly''s','2026-10-01','Insumos secos',2336.48,'nota','boleto do DDA (Oesa) com vencimento em 30/10')
ON CONFLICT (fornecedor, mes, categoria) DO NOTHING;

-- Brasal (bebidas): estimativa = pedidos das conversas x preços da tabela de 04/09 (Coca 15un R$ 42,73; Zero/Fanta/Sprite 6un ~R$ 17,1-17,3; suco R$ 21,86; Heineken R$ 34,92)
INSERT INTO gastos_fornecedor (fornecedor, mes, categoria, valor, origem, obs) VALUES
 ('Brasal','2026-01-01','Bebidas',335.01,'estimado','1 pedido (20/01): cocas, sucos e Heineken'),
 ('Brasal','2026-02-01','Bebidas',940.21,'estimado','3 pedidos (03, 10 e 20/02); Pix de R$ 573,41 em 03/02'),
 ('Brasal','2026-03-01','Bebidas',1795.61,'estimado','pedidos de 06/03 (18 Zero, 8 Coca, 5 sucos) e 31/03; Pix de R$ 470,22 em 03/03'),
 ('Brasal','2026-04-01','Bebidas',1061.77,'estimado','pedidos de 07 e 21/04; boleto duplicado pago por engano em 22/04 e abatido depois'),
 ('Brasal','2026-05-01','Bebidas',1978.61,'estimado','5 pedidos (05, 12, 15, 19 e 26/05); boleto de R$ 306,34 em atraso em 12/05'),
 ('Brasal','2026-06-01','Bebidas',1752.21,'estimado','pedido grande de 08/06 (R$ 1,6 mil) e 22/06'),
 ('Brasal','2026-07-01','Bebidas',2095.51,'estimado','pedidos de 13, 20 e 27/07; boletos conhecidos: R$ 780,79 (14/07) e R$ 1.341,36 (27/07)'),
 ('Brasal','2026-08-01','Bebidas',2702.69,'estimado','pedidos de 10, 24 e 31/08 (o de 03/08 foi repetido em 10/08); boleto de R$ 699,37 pago em 24/08 com juros e multa'),
 ('Brasal','2026-09-01','Bebidas',1920.66,'estimado','pedidos de 04/09 (R$ 1.307,61) e 14/09 (R$ 613,05); títulos conhecidos R$ 968,15 (21/09) e R$ 618,05 (28/09); o pedido de 28/09 para a outra unidade não entrou'),
 ('Brasal','2026-10-01','Bebidas',1201.55,'nota','boleto do DDA com vencimento em 27/10; pedido de 13/10 feito pelo app')
ON CONFLICT (fornecedor, mes, categoria) DO NOTHING;

-- Garra (insumos secos, descartáveis e molhos): mai a jul estimados pelos pedidos x preços das listas; ago a out dos espelhos/orçamentos aprovados
INSERT INTO gastos_fornecedor (fornecedor, mes, categoria, valor, origem, obs) VALUES
 ('Garra','2026-05-01','Insumos secos',382.50,'estimado','1º pedido em 26/05: 3 caixas de papel toalha + óleo de algodão Elogiata 15 L; boleto de 7 dias. O orçamento de 19/05 ficou parado por troca de endereço'),
 ('Garra','2026-06-01','Insumos secos',1091.02,'estimado','03/06 (8 sachê de ketchup, 8 de mostarda, 1 grill), 15/06 (7 baconnaise em combo, ~R$ 270 mais grill) e 30/06 (R$ 350,10), prazo de 14 dias liberado em 30/06'),
 ('Garra','2026-07-01','Insumos secos',717.00,'estimado','pedido de 21/07: 20 pacotes de papel toalha, saco de lixo, 5 caixas de ketchup e 5 de mostarda, 2 maioneses temperada e 2 molhos ranch Junior'),
 ('Garra','2026-08-01','Insumos secos',2319.50,'nota','orçamentos aprovados: 18/08 R$ 1.301,50 (ketchup, mostarda, ranch, maionese grill) e 26/08 R$ 1.018,00 (baconnaise, óleo, batata, barbecue)'),
 ('Garra','2026-09-01','Insumos secos',557.70,'nota','pedido de 09/09: R$ 375,70 de limpeza e papel toalha + R$ 182 de óleo; o pedido de 02/09 (R$ 543) não foi faturado por falta de limite'),
 ('Garra','2026-10-01','Insumos secos',817.60,'nota','orçamento de 15/10 (boleto de 14 dias, vence em 30/10 no DDA); o pedido de 22/10 (R$ 399,10) ficou sem confirmação e não entrou')
ON CONFLICT (fornecedor, mes, categoria) DO NOTHING;
