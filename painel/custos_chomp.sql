-- Custos da linha Chomp = mesmas receitas dos equivalentes Maracayá
-- Mapeamento do Álvaro:
--   Texas = Fera | Colorado = Selvagem | Portland = Maracayá | Detroit = Ferinha
--   Duplo Texas = Duplo Fera | Duplo Colorado = Duplo Selvagem
--   Memphis = Pantera | Oklahoma = Rei da Selva
-- Rodar:
--   docker exec -i dados_postgres psql -U alvaro -d operacao < painel/custos_chomp.sql

INSERT INTO produto_custos (nome, custo) VALUES
    -- burgers
    ('texas',                            9.22),  -- = Fera
    ('colorado',                         9.22),  -- = Selvagem
    ('portland',                         9.22),  -- = Maracayá
    ('detroit',                          9.21),  -- = Ferinha
    ('duplo texas',                     14.02),  -- = Duplo Fera
    ('duplo colorado',                  14.02),  -- = Duplo Selvagem
    ('oklahoma',                         9.92),  -- = Rei da Selva

    -- combos (equivalentes aos combos Maracayá)
    ('combo texas c/refri',             12.93),  -- = Combo Fera C/Refri
    ('combo texas c/refrigerante',      12.93),
    ('combo colorado c/refri',          13.40),  -- = Combo Selvagem C/Refri
    ('combo colorado c/refrigerante',   13.40),
    ('combo portland c/refri',          12.93),  -- = Combo Maracayá C/Refri
    ('combo detroit c/refri',           12.92),  -- = Combo Ferinha C/Refri
    ('combo detroit c/refrigerante',    12.92),
    ('combo duplo texas c/refri',       17.73),  -- = Combo Duplo Fera C/Refri
    ('combo duplo colorado c/refri',    18.20),  -- = Combo Duplo Selvagem C/Refri
    ('combo memphis c/refri',           11.99),  -- = Combo Pantera C/Refri
    ('combo oklahoma c/refri',          13.63)   -- = Combo Rei da Selva C/Refri
ON CONFLICT (nome) DO UPDATE
    SET custo = EXCLUDED.custo, atualizado_em = now();

-- OBS: Memphis (solo) ficou de fora porque o equivalente Pantera está com
-- custo R$ 0,00 na ficha técnica. Complete a ficha do Pantera e cadastre
-- os dois pelo painel.

SELECT count(*) AS custos_cadastrados FROM produto_custos;
