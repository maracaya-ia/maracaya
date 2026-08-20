-- Importação de CMVs da ficha técnica (Sistema de Controle de Estoque)
-- Rodar:
--   docker exec -i dados_postgres psql -U alvaro -d operacao < painel/custos_import.sql
--
-- Nomes em minúsculo de propósito: o painel casa por lower(trim(nome)).
-- Produtos com custo R$ 0,00 na ficha (Pantera, Guaranás, Molho Barbecue)
-- foram DEIXADOS DE FORA de propósito — custo zero viraria "margem 100%"
-- falsa no quadrante. Complete a ficha deles e cadastre depois.

INSERT INTO produto_custos (nome, custo) VALUES
    -- burgers
    ('fera',                                9.22),
    ('ferinha',                             9.21),
    ('selvagem',                            9.22),
    ('maracayá',                            9.22),
    ('duplo fera',                         14.02),
    ('duplo selvagem',                     14.02),
    ('crispy feroz',                        6.19),
    ('crispy feroz (frango)',               6.19),
    ('rei da selva (burger de costela)',    9.92),
    -- combos
    ('combo fera c/refri',                 12.93),
    ('combo fera c/refrigerante',          12.93),
    ('combo ferinha c/refri',              12.92),
    ('combo selvagem c/refri',             13.40),
    ('combo selvagem c/refrigerante',      13.40),
    ('combo maracayá c/refri',             12.93),
    ('combo duplo fera c/refri',           17.73),
    ('combo duplo selvagem c/refri',       18.20),
    ('combo crispy feroz c/refri',          9.90),
    ('combo rei da selva c/ refri',        13.63),
    ('combo rei da selva c/refri',         13.63),
    ('combo pantera c/refri',              11.99),
    ('combo amor feroz',                   31.40),
    ('combo pai e filho + brinde',         38.70),
    ('combo pai selvagem + brinde',        25.97),
    ('compre 1 e leve 2',                  27.10),
    -- acompanhamentos e molhos
    ('batata frita',                        1.52),
    ('batata chips',                        3.08),
    ('molho baconese',                      0.49),
    ('molho maracayá',                      0.49),
    -- bebidas
    ('refrigerante coca cola lata 350ml',   2.65),
    ('coca-cola 350ml zero açúcar',         2.66),
    ('fanta laranja',                       2.70),
    ('sprite',                              2.70),
    ('suco del valle maracujá 290ml',       3.33),
    ('suco del valle uva 290ml',            3.33),
    ('água com gás crystal 500ml',          1.62),
    ('água mineral indaiá 500ml',           1.31),
    ('heineken 330ml',                      6.03),
    ('stella artois',                       5.55)
ON CONFLICT (nome) DO UPDATE
    SET custo = EXCLUDED.custo, atualizado_em = now();

-- Confere o resultado
SELECT count(*) AS custos_cadastrados FROM produto_custos;
