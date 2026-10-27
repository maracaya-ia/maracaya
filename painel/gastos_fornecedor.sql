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
