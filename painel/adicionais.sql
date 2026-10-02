-- Adicionais (complementos do pedido) que baixam estoque.
-- complemento = nome do complemento em minusculas/trim; qtd = consumo por unidade do adicional.
-- so_fora_combo: em combo a batata ja esta incluida, entao o adicional so conta em lanche avulso.
CREATE TABLE IF NOT EXISTS adicional_insumo (
    complemento   TEXT NOT NULL,
    insumo        TEXT NOT NULL,
    qtd           NUMERIC(12,3) NOT NULL,
    unidade       TEXT NOT NULL,
    so_fora_combo BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (complemento, insumo)
);

INSERT INTO adicional_insumo (complemento, insumo, qtd, unidade, so_fora_combo) VALUES
('batata frita',     'Batata Frita',    146,  'g',  true),   -- porcao pronta 100 g = 146 g crua
('batata chips',     'Batata Chips',    1,    'un', false),  -- pacote de 50 g
('batata chips',     'Papel de Batata', 1,    'un', false),
('cebola roxa',      'Cebola Roxa',     20,   'g',  false),
('carne angus 150g', 'Carne Angus',     1,    'un', false),
('bacon',            'Bacon',           14,   'g',  false),  -- 2 fatias de 7 g cru
('sal',              'Sachê de Sal',    1,    'un', false),
('tomate',           'Tomate',          0.2,  'un', false),  -- mesma porcao do lanche
('alface',           'Alface',          0.9,  'un', false),
('rúcula',           'Rúcula',          1,    'un', false)
ON CONFLICT (complemento, insumo) DO UPDATE SET qtd = EXCLUDED.qtd, unidade = EXCLUDED.unidade,
                                                so_fora_combo = EXCLUDED.so_fora_combo;
-- complemento "guardanapo" nao soma: o guardanapo ja vai na ficha de cada lanche (1 por item)

BEGIN;
-- cebola roxa passa a gramas (20 g por lanche que a usa) e entra no ciclo de troca do hortifruti
UPDATE ficha_tecnica SET qtd = 20, unidade = 'g' WHERE insumo = 'Cebola Roxa';
DELETE FROM insumo_estoque WHERE insumo = 'Cebola Roxa';
DELETE FROM pedido_baixa_estoque WHERE insumo = 'Cebola Roxa';
INSERT INTO insumo_ciclo (insumo) VALUES ('Cebola Roxa'), ('Cebola Branca') ON CONFLICT DO NOTHING;

-- sal: sache controlado em estoque
INSERT INTO insumo_unidade (insumo, unidade) VALUES ('Sachê de Sal', 'un') ON CONFLICT DO NOTHING;
INSERT INTO insumo_fornecedor (insumo, fornecedor) VALUES ('Sachê de Sal', 'Garra') ON CONFLICT DO NOTHING;
COMMIT;
