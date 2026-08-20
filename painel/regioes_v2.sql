-- Regiões — leva 2: condomínios identificados no garimpo de endereços
-- Rodar:
--   docker exec -i dados_postgres psql -U alvaro -d operacao < painel/regioes_v2.sql

INSERT INTO regras_regiao (padrao, regiao) VALUES
    -- Grande Colorado
    ('%solar de atenas%',            'Solar de Atenas'),
    ('%solar de athenas%',           'Solar de Atenas'),
    ('%vivendas colorado ii%',       'Vivendas Colorado II'),
    ('%vivendas colorado%',          'Vivendas Colorado'),
    ('%mansões colorado%',           'Mansões Colorado'),
    ('%mansoes colorado%',           'Mansões Colorado'),
    ('%lago azul%',                  'Vivendas Lago Azul'),
    -- Mansões Sobradinho
    ('%mini-chác%',                  'Mini-Chácaras'),
    ('%mini chác%',                  'Mini-Chácaras'),
    ('%mini-chac%',                  'Mini-Chácaras'),
    ('%mini chac%',                  'Mini-Chácaras'),
    ('%vale das acácias%',           'Vale das Acácias'),
    ('%vale das acacias%',           'Vale das Acácias'),
    ('%res. sobradinho%',            'Residencial Sobradinho'),
    -- Boa Vista
    ('%parque colorado%',            'Parque Colorado'),
    ('%boa vista%',                  'Setor Boa Vista'),
    -- Outros
    ('%império dos nobres%',         'Império dos Nobres'),
    ('%imperio dos nobres%',         'Império dos Nobres'),
    ('%der-df%',                     'Residencial DER-DF'),
    ('%der df%',                     'Residencial DER-DF'),
    ('%lago norte%',                 'Lago Norte')
ON CONFLICT (padrao) DO UPDATE SET regiao = EXCLUDED.regiao;

-- Reclassifica o histórico com as regras novas
UPDATE pedidos SET regiao = regiao_do_endereco(endereco_texto)
WHERE endereco_texto IS NOT NULL;

-- Confere
SELECT coalesce(regiao, '(sem região mapeada)') AS regiao, count(*) AS pedidos
FROM pedidos WHERE tipo = 'delivery'
GROUP BY 1 ORDER BY 2 DESC LIMIT 20;

-- Garimpo rodada 2: o que ainda sobrou
SELECT left(endereco_texto, 70) AS endereco, count(*) AS pedidos
FROM pedidos
WHERE tipo = 'delivery' AND regiao IS NULL AND endereco_texto IS NOT NULL
GROUP BY 1 ORDER BY 2 DESC LIMIT 20;
