-- Variacoes de nome que vendiam sem baixa de estoque (sem ficha tecnica) - apontadas
-- pro produto canonico que ja tem ficha.
INSERT INTO produto_alias (alias, canonico) VALUES
('guaraná antártica lata 269ml', 'guarana antarctica lata'),
('coca-cola zero 310ml', 'coca-cola 350ml zero açúcar'),
('água crystal com gás 500ml', 'água com gás crystal 500ml'),
('água mineral com gás 500ml', 'água com gás crystal 500ml'),
('combo maracayá c/ refri', 'combo maracayá c/refri'),
('oklahoma (burger de costela)', 'oklahoma'),
('coca-cola 310ml', 'coca-cola 310ml')
ON CONFLICT (alias) DO NOTHING;

-- Coca-Cola normal avulsa nao tinha ficha
INSERT INTO ficha_tecnica (produto, insumo, qtd, unidade)
SELECT 'coca-cola 310ml', 'Coca Normal', 1, 'un'
WHERE NOT EXISTS (SELECT 1 FROM ficha_tecnica WHERE produto = 'coca-cola 310ml');
