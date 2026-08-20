-- Fichas técnicas (ingredientes por produto) — extraídas da ficha do Álvaro
-- Rodar uma vez:
--   docker exec -i dados_postgres psql -U alvaro -d operacao < painel/fichas.sql

CREATE TABLE IF NOT EXISTS ficha_tecnica (
    produto  TEXT NOT NULL,      -- nome normalizado (minúsculo)
    insumo   TEXT NOT NULL,
    qtd      NUMERIC(10,3) NOT NULL,
    unidade  TEXT NOT NULL,      -- un | kg
    PRIMARY KEY (produto, insumo)
);

-- Aliases: variações de nome nas vendas -> nome canônico da ficha
CREATE TABLE IF NOT EXISTS produto_alias (
    alias     TEXT PRIMARY KEY,
    canonico  TEXT NOT NULL
);

INSERT INTO produto_alias (alias, canonico) VALUES
    ('combo fera c/refrigerante',        'combo fera c/refri'),
    ('combo selvagem c/refrigerante',    'combo selvagem c/refri'),
    ('combo selvagem c/ refri',          'combo selvagem c/refri'),
    ('combo ferinha c/refrigerante',     'combo ferinha c/refri'),
    ('combo maracayá c/refrigerante',    'combo maracayá c/refri'),
    ('combo pantera c/ refri',           'combo pantera c/refri'),
    ('combo rei da selva c/ refri',      'combo rei da selva c/refri'),
    ('combo rei da selva c/refrigerante','combo rei da selva c/refri'),
    ('combo rei da selva',               'combo rei da selva c/refri'),
    ('crispy feroz (frango)',            'crispy feroz'),
    ('maracaya',                         'maracayá'),
    ('rei da selva(burger de costela)',  'rei da selva (burger de costela)'),
    ('combo texas c/refrigerante',       'combo texas c/refri'),
    ('combo detroit c/refrigerante',     'combo detroit c/refri')
ON CONFLICT (alias) DO UPDATE SET canonico = EXCLUDED.canonico;

-- ============ RECEITAS MARACAYÁ (da ficha técnica) ============
INSERT INTO ficha_tecnica (produto, insumo, qtd, unidade) VALUES
-- burgers
('fera','Carne Angus',1,'un'),('fera','Pão Brioche',1,'un'),('fera','Queijo Cheddar',2,'un'),
('fera','Maionese Grill',1,'un'),('fera','Bacon',0.021,'kg'),('fera','Papel Acoplado',1,'un'),
('fera','Papel Kraft',1,'un'),('fera','Sachê de Mostarda',1,'un'),('fera','Sachê de Ketchup',1,'un'),
('fera','Guardanapo',1,'un'),

('ferinha','Carne Angus',1,'un'),('ferinha','Pão Brioche',1,'un'),('ferinha','Queijo Cheddar',2,'un'),
('ferinha','Maionese Grill',1,'un'),('ferinha','Papel Acoplado',1,'un'),('ferinha','Papel Kraft',1,'un'),
('ferinha','Sachê de Mostarda',1,'un'),('ferinha','Sachê de Ketchup',1,'un'),('ferinha','Guardanapo',1,'un'),

('selvagem','Carne Angus',1,'un'),('selvagem','Pão Brioche',1,'un'),('selvagem','Queijo Cheddar',2,'un'),
('selvagem','Maionese Grill',1,'un'),('selvagem','Bacon',0.021,'kg'),('selvagem','Alface',0.9,'un'),
('selvagem','Tomate',0.2,'un'),('selvagem','Papel Acoplado',1,'un'),('selvagem','Papel Kraft',1,'un'),
('selvagem','Sachê de Mostarda',1,'un'),('selvagem','Sachê de Ketchup',1,'un'),('selvagem','Guardanapo',1,'un'),

('maracayá','Carne Angus',1,'un'),('maracayá','Pão Brioche',1,'un'),('maracayá','Queijo Cheddar',2,'un'),
('maracayá','Maionese Grill',1,'un'),('maracayá','Bacon',0.021,'kg'),('maracayá','Rúcula',1,'un'),
('maracayá','Papel Acoplado',1,'un'),('maracayá','Papel Kraft',1,'un'),
('maracayá','Sachê de Mostarda',1,'un'),('maracayá','Sachê de Ketchup',1,'un'),('maracayá','Guardanapo',1,'un'),

('duplo fera','Carne Angus',2,'un'),('duplo fera','Pão Brioche',1,'un'),('duplo fera','Queijo Cheddar',2,'un'),
('duplo fera','Maionese Grill',1,'un'),('duplo fera','Bacon',0.021,'kg'),('duplo fera','Papel Acoplado',1,'un'),
('duplo fera','Papel Kraft',1,'un'),('duplo fera','Sachê de Mostarda',1,'un'),('duplo fera','Sachê de Ketchup',1,'un'),
('duplo fera','Guardanapo',1,'un'),

('duplo selvagem','Carne Angus',2,'un'),('duplo selvagem','Pão Brioche',1,'un'),('duplo selvagem','Queijo Cheddar',2,'un'),
('duplo selvagem','Maionese Grill',1,'un'),('duplo selvagem','Bacon',0.021,'kg'),('duplo selvagem','Alface',0.9,'un'),
('duplo selvagem','Tomate',0.2,'un'),('duplo selvagem','Papel Acoplado',1,'un'),('duplo selvagem','Papel Kraft',1,'un'),
('duplo selvagem','Sachê de Mostarda',1,'un'),('duplo selvagem','Sachê de Ketchup',1,'un'),('duplo selvagem','Guardanapo',1,'un'),

('crispy feroz','Hambúrguer de Frango',1,'un'),('crispy feroz','Pão Brioche com Gergelim',1,'un'),
('crispy feroz','Molho Ranch',1,'kg'),('crispy feroz','Bacon',0.021,'kg'),('crispy feroz','Alface',1,'un'),
('crispy feroz','Papel Acoplado',1,'un'),('crispy feroz','Papel Kraft',1,'un'),
('crispy feroz','Sachê de Mostarda',1,'un'),('crispy feroz','Sachê de Ketchup',1,'un'),('crispy feroz','Guardanapo',1,'un'),

('rei da selva (burger de costela)','Carne Costela',1,'un'),
('rei da selva (burger de costela)','Pão Brioche com Gergelim',1,'un'),
('rei da selva (burger de costela)','Queijo Mussarela',1,'un'),
('rei da selva (burger de costela)','Maionese de Bacon',1,'un'),
('rei da selva (burger de costela)','Bacon',0.021,'kg'),
('rei da selva (burger de costela)','Cebola Roxa',1,'un'),
('rei da selva (burger de costela)','Papel Acoplado',1,'un'),
('rei da selva (burger de costela)','Papel Kraft',1,'un'),
('rei da selva (burger de costela)','Sachê de Mostarda',1,'un'),
('rei da selva (burger de costela)','Sachê de Ketchup',1,'un'),
('rei da selva (burger de costela)','Guardanapo',1,'un'),

('pantera','Carne Angus',1,'un'),('pantera','Pão Australiano',1,'un'),('pantera','Queijo Mussarela',1,'un'),
('pantera','Bacon',0.021,'kg'),('pantera','Papel Acoplado',1,'un'),('pantera','Papel Kraft',1,'un'),
('pantera','Sachê de Mostarda',1,'un'),('pantera','Sachê de Ketchup',1,'un'),('pantera','Guardanapo',1,'un'),

-- acompanhamentos
('batata frita','Batata Frita',0.1,'kg'),('batata frita','Papel de Batata',1,'un'),
('batata chips','Batata Chips',1,'un'),('batata chips','Papel de Batata',1,'un'),

-- bebidas (1 un de si mesmas)
('refrigerante coca cola lata 350ml','Coca Normal',1,'un'),
('coca-cola 350ml zero açúcar','Coca Zero',1,'un'),
('fanta laranja','Fanta Laranja',1,'un'),
('sprite','Sprite',1,'un'),
('suco del valle maracujá 290ml','Suco Del Valle Maracujá',1,'un'),
('suco del valle uva 290ml','Suco Del Valle Uva',1,'un'),
('água com gás crystal 500ml','Água com Gás',1,'un'),
('água mineral indaiá 500ml','Água Normal',1,'un'),
('heineken 330ml','Heineken',1,'un'),
('stella artois','Stella Artois',1,'un'),
('guarana antarctica lata','Guaraná Normal',1,'un'),
('refrigerantes','Refrigerante (genérico)',1,'un'),
('cervejas','Cerveja (genérica)',1,'un'),
('sucos','Suco (genérico)',1,'un')
ON CONFLICT (produto, insumo) DO UPDATE SET qtd = EXCLUDED.qtd, unidade = EXCLUDED.unidade;

-- ============ COMBOS = burger + batata + refri + papelaria extra ============
-- gera cada combo a partir do burger base
CREATE OR REPLACE FUNCTION montar_combo(nome_combo TEXT, burger TEXT, refri TEXT) RETURNS VOID AS $$
BEGIN
    INSERT INTO ficha_tecnica (produto, insumo, qtd, unidade)
    SELECT nome_combo, insumo, qtd, unidade FROM ficha_tecnica WHERE produto = burger
    ON CONFLICT (produto, insumo) DO UPDATE SET qtd = EXCLUDED.qtd;
    INSERT INTO ficha_tecnica VALUES
        (nome_combo, 'Batata Frita', 0.1, 'kg'),
        (nome_combo, 'Papel de Batata', 1, 'un'),
        (nome_combo, refri, 1, 'un')
    ON CONFLICT (produto, insumo) DO UPDATE SET qtd = EXCLUDED.qtd;
END;
$$ LANGUAGE plpgsql;

SELECT montar_combo('combo fera c/refri', 'fera', 'Guaraná Normal');
SELECT montar_combo('combo ferinha c/refri', 'ferinha', 'Guaraná Normal');
SELECT montar_combo('combo selvagem c/refri', 'selvagem', 'Guaraná Normal');
SELECT montar_combo('combo maracayá c/refri', 'maracayá', 'Guaraná Normal');
SELECT montar_combo('combo duplo fera c/refri', 'duplo fera', 'Guaraná Normal');
SELECT montar_combo('combo duplo selvagem c/refri', 'duplo selvagem', 'Coca Zero');
SELECT montar_combo('combo crispy feroz c/refri', 'crispy feroz', 'Guaraná Normal');
SELECT montar_combo('combo pantera c/refri', 'pantera', 'Guaraná Normal');
SELECT montar_combo('combo rei da selva c/refri', 'rei da selva (burger de costela)', 'Guaraná Normal');

-- ============ CHOMP = espelho das receitas Maracayá ============
CREATE OR REPLACE FUNCTION espelhar(destino TEXT, origem TEXT) RETURNS VOID AS $$
BEGIN
    INSERT INTO ficha_tecnica (produto, insumo, qtd, unidade)
    SELECT destino, insumo, qtd, unidade FROM ficha_tecnica WHERE produto = origem
    ON CONFLICT (produto, insumo) DO UPDATE SET qtd = EXCLUDED.qtd;
END;
$$ LANGUAGE plpgsql;

SELECT espelhar('texas', 'fera');
SELECT espelhar('colorado', 'selvagem');
SELECT espelhar('portland', 'maracayá');
SELECT espelhar('detroit', 'ferinha');
SELECT espelhar('memphis', 'pantera');
SELECT espelhar('oklahoma', 'rei da selva (burger de costela)');
SELECT espelhar('duplo texas', 'duplo fera');
SELECT espelhar('duplo colorado', 'duplo selvagem');
SELECT espelhar('combo texas c/refri', 'combo fera c/refri');
SELECT espelhar('combo detroit c/refri', 'combo ferinha c/refri');
SELECT espelhar('combo colorado c/refri', 'combo selvagem c/refri');
SELECT espelhar('combo portland c/refri', 'combo maracayá c/refri');
SELECT espelhar('combo duplo texas c/refri', 'combo duplo fera c/refri');
SELECT espelhar('combo duplo colorado c/refri', 'combo duplo selvagem c/refri');
SELECT espelhar('combo memphis c/refri', 'combo pantera c/refri');
SELECT espelhar('combo oklahoma c/refri', 'combo rei da selva c/refri');

SELECT count(DISTINCT produto) AS produtos_com_ficha,
       count(*) AS linhas_de_ingrediente FROM ficha_tecnica;
