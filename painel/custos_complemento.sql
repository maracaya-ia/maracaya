-- Complemento de custos: variações de grafia + categorias genéricas
-- Rodar:
--   docker exec -i dados_postgres psql -U alvaro -d operacao < painel/custos_complemento.sql

INSERT INTO produto_custos (nome, custo) VALUES
    -- variações de grafia (mesmo produto, mesmo custo da ficha)
    ('combo rei da selva',                          13.63),
    ('combo pantera c/ refri',                      11.99),
    ('combo maracayá c/refrigerante',               12.93),
    ('combo selvagem c/ refri',                     13.40),
    ('combo ferinha c/refrigerante',                12.92),
    ('combo rei da selva c/refrigerante',           13.63),
    ('maracaya',                                     9.22),
    ('rei da selva(burger de costela)',              9.92),
    ('combo pai selvagem + brinde (cópia)',         25.97),
    ('água crystal com gás 500ml',                   1.62),

    -- botões genéricos do portal: custo = média da categoria na ficha
    -- (refris lata 2,65-2,70 | cervejas 5,55-6,03 | sucos 3,33 | águas 1,31-1,62)
    ('refrigerantes',                                2.66),
    ('cervejas',                                     5.79),
    ('sucos',                                        3.33),
    ('água mineral - com ou sem gás',                1.47)
ON CONFLICT (nome) DO UPDATE
    SET custo = EXCLUDED.custo, atualizado_em = now();

SELECT count(*) AS custos_cadastrados FROM produto_custos;
