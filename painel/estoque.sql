-- Controle de estoque: quantidade atual + insumo -> fornecedor
-- Rodar uma vez:
--   docker exec -i dados_postgres psql -U alvaro -d operacao < painel/estoque.sql

CREATE TABLE IF NOT EXISTS insumo_estoque (
    insumo         TEXT PRIMARY KEY,
    estoque_atual  NUMERIC(12,3) NOT NULL,
    atualizado_em  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS insumo_fornecedor (
    insumo      TEXT PRIMARY KEY,
    fornecedor  TEXT NOT NULL
);

-- Mapeamento inicial dos insumos aos fornecedores (ajuste no painel depois)
INSERT INTO insumo_fornecedor (insumo, fornecedor) VALUES
    ('Carne Angus',                'Ki Karnes'),
    ('Carne Costela',              'Ki Karnes'),
    ('Hambúrguer de Frango',       'Ki Karnes'),
    ('Bacon',                      'Ki Karnes'),
    ('Pão Brioche',                'Pão e Roça'),
    ('Pão Brioche com Gergelim',   'Pão e Roça'),
    ('Pão Australiano',            'Pão e Roça'),
    ('Batata Frita',               'Juju Batata'),
    ('Batata Chips',               'Juju Batata'),
    ('Queijo Cheddar',             'Delly''s'),
    ('Queijo Mussarela',           'Delly''s'),
    ('Maionese Grill',             'Delly''s'),
    ('Maionese de Bacon',          'Delly''s'),
    ('Molho Ranch',                'Delly''s'),
    ('Alface',                     'Delly''s'),
    ('Tomate',                     'Delly''s'),
    ('Rúcula',                     'Delly''s'),
    ('Cebola Roxa',                'Delly''s'),
    ('Guaraná Normal',             'Brasal'),
    ('Coca Normal',                'Brasal'),
    ('Coca Zero',                  'Brasal'),
    ('Fanta Laranja',              'Brasal'),
    ('Sprite',                     'Brasal'),
    ('Heineken',                   'Ambev'),
    ('Stella Artois',              'Ambev'),
    ('Papel Acoplado',             'Garra'),
    ('Papel Kraft',                'Garra'),
    ('Papel de Batata',            'Garra'),
    ('Guardanapo',                 'Garra'),
    ('Sachê de Mostarda',          'Garra'),
    ('Sachê de Ketchup',           'Garra')
ON CONFLICT (insumo) DO UPDATE SET fornecedor = EXCLUDED.fornecedor;

SELECT count(*) AS insumos_mapeados FROM insumo_fornecedor;
