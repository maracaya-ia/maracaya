-- Análise por bairro: extrai endereço do JSON bruto (webhook_eventos)
-- Rodar uma vez:
--   docker exec -i dados_postgres psql -U alvaro -d operacao < painel/bairros.sql

-- 1. Colunas novas em pedidos
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS bairro TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS lat NUMERIC(10,7);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS lng NUMERIC(10,7);

-- 2. Gatilho: todo pedido novo busca o endereço no JSON bruto do evento
--    (o evento é gravado antes do pedido na mesma transação, então já existe)
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
    END IF;
    RETURN NEW;
EXCEPTION WHEN others THEN
    RETURN NEW;   -- endereço malformado nunca derruba a gravação do pedido
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_endereco ON pedidos;
CREATE TRIGGER trg_endereco
    BEFORE INSERT ON pedidos
    FOR EACH ROW EXECUTE FUNCTION extrai_endereco();

-- 3. Backfill: preenche o histórico inteiro a partir do JSON bruto
UPDATE pedidos p
SET bairro = nullif(trim(w.addr->>'neighborhood'), ''),
    lat = nullif(w.addr->>'latitude', '')::numeric,
    lng = nullif(w.addr->>'longitude', '')::numeric
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

-- 4. Confere: top bairros extraídos
SELECT coalesce(bairro, '(sem bairro)') AS bairro, count(*) AS pedidos
FROM pedidos WHERE tipo = 'delivery'
GROUP BY 1 ORDER BY 2 DESC LIMIT 12;
