-- Regiões/condomínios: classificação por regras de texto no endereço
-- Rodar uma vez:
--   docker exec -i dados_postgres psql -U alvaro -d operacao < painel/regioes.sql

-- 1. Colunas novas
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS endereco_texto TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS regiao TEXT;

-- 2. Tabela de regras (edite à vontade: 1 INSERT por condomínio novo)
CREATE TABLE IF NOT EXISTS regras_regiao (
    padrao TEXT PRIMARY KEY,   -- trecho procurado no endereço (ILIKE)
    regiao TEXT NOT NULL       -- nome bonito exibido no painel
);

INSERT INTO regras_regiao (padrao, regiao) VALUES
    ('%jardim europa ii%',   'Jardim Europa II'),
    ('%jardim europa 2%',    'Jardim Europa II'),
    ('%jardim europa%',      'Jardim Europa'),
    ('%bela vista%',         'Vivendas Bela Vista'),
    ('%friburgo%',           'Vivendas Friburgo'),
    ('%residencial ipês%',   'Residencial Ipês'),
    ('%residencial ipes%',   'Residencial Ipês'),
    ('%meus sonhos%',        'Meus Sonhos'),
    ('%contagem%',           'Setor de Contagem'),
    ('%sobradinho ii%',      'Sobradinho II'),
    ('%sobradinho 2%',       'Sobradinho II')
ON CONFLICT (padrao) DO UPDATE SET regiao = EXCLUDED.regiao;

-- 3. Função que escolhe a região (regra mais específica/longa vence)
CREATE OR REPLACE FUNCTION regiao_do_endereco(txt TEXT) RETURNS TEXT AS $$
    SELECT regiao FROM regras_regiao
    WHERE txt ILIKE padrao
    ORDER BY length(padrao) DESC
    LIMIT 1;
$$ LANGUAGE sql STABLE;

-- 4. Gatilho de endereço agora também guarda o texto completo e a região
CREATE OR REPLACE FUNCTION extrai_endereco() RETURNS TRIGGER AS $$
DECLARE addr JSONB;
BEGIN
    SELECT payload->'delivery_address' INTO addr
    FROM webhook_eventos
    WHERE loja_id = NEW.loja_id
      AND payload->>'id' = NEW.order_id_cw
      AND payload->'delivery_address' IS NOT NULL
      AND payload->'delivery_address' <> 'null'::jsonb
    ORDER BY recebido_em DESC LIMIT 1;

    IF addr IS NOT NULL THEN
        NEW.bairro := nullif(trim(addr->>'neighborhood'), '');
        NEW.lat := nullif(addr->>'latitude', '')::numeric;
        NEW.lng := nullif(addr->>'longitude', '')::numeric;
        NEW.endereco_texto := trim(concat_ws(' ',
            addr->>'street', addr->>'complement',
            addr->>'reference', addr->>'neighborhood'));
        NEW.regiao := regiao_do_endereco(NEW.endereco_texto);
    END IF;
    RETURN NEW;
EXCEPTION WHEN others THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Backfill do texto de endereço no histórico
UPDATE pedidos p
SET endereco_texto = trim(concat_ws(' ',
        w.addr->>'street', w.addr->>'complement',
        w.addr->>'reference', w.addr->>'neighborhood'))
FROM (
    SELECT DISTINCT ON (loja_id, payload->>'id')
           loja_id, payload->>'id' AS oid,
           payload->'delivery_address' AS addr
    FROM webhook_eventos
    WHERE payload->'delivery_address' IS NOT NULL
      AND payload->'delivery_address' <> 'null'::jsonb
    ORDER BY loja_id, payload->>'id', recebido_em DESC
) w
WHERE p.loja_id = w.loja_id AND p.order_id_cw = w.oid;

-- 6. (Re)classifica todo o histórico — rode esta linha de novo sempre que
--    adicionar regras novas na tabela regras_regiao:
UPDATE pedidos SET regiao = regiao_do_endereco(endereco_texto)
WHERE endereco_texto IS NOT NULL;

-- 7. Confere o resultado
SELECT coalesce(regiao, '(sem região mapeada)') AS regiao, count(*) AS pedidos
FROM pedidos WHERE tipo = 'delivery'
GROUP BY 1 ORDER BY 2 DESC LIMIT 15;

-- 8. GARIMPO: endereços ainda sem região, dos mais frequentes pros raros.
--    Manda o resultado pro Claude que ele gera as regras que faltam.
SELECT left(endereco_texto, 70) AS endereco, count(*) AS pedidos
FROM pedidos
WHERE tipo = 'delivery' AND regiao IS NULL AND endereco_texto IS NOT NULL
GROUP BY 1 ORDER BY 2 DESC LIMIT 25;
