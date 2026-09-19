-- Desconto separado por patrocinador (loja x iFood) + cache de distancia de rota (Chomp/iFood)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS desconto_loja  NUMERIC(12,2);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS desconto_ifood NUMERIC(12,2);

CREATE TABLE IF NOT EXISTS pedido_distancia (
    pedido_id INTEGER PRIMARY KEY REFERENCES pedidos(id) ON DELETE CASCADE,
    km        NUMERIC(8,2),
    calculado_em TIMESTAMPTZ DEFAULT now()
);

-- Sem dado de patrocinio (Saipos etc): todo desconto conta como da loja
CREATE OR REPLACE FUNCTION pedidos_patrocinio_padrao() RETURNS trigger AS $$
BEGIN
    IF NEW.desconto_loja IS NULL THEN
        NEW.desconto_loja := coalesce(NEW.desconto, 0);
        NEW.desconto_ifood := 0;
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_pedidos_patrocinio ON pedidos;
CREATE TRIGGER trg_pedidos_patrocinio BEFORE INSERT OR UPDATE ON pedidos
    FOR EACH ROW EXECUTE FUNCTION pedidos_patrocinio_padrao();

-- Backfill a partir do payload bruto mais recente de cada pedido (Cardapio Web)
WITH ult AS (
    SELECT DISTINCT ON (loja_id, payload->>'id') loja_id, payload->>'id' AS oid, payload
    FROM webhook_eventos
    WHERE tipo_evento IN ('polling', 'backfill') AND payload ? 'id'
    ORDER BY loja_id, payload->>'id', id DESC
)
UPDATE pedidos p SET
    desconto_loja = coalesce((SELECT sum((d->>'total')::numeric)
        FROM jsonb_array_elements(coalesce(u.payload->'discounts', '[]'::jsonb)) d
        WHERE coalesce(d->>'sponsorship', 'merchant') <> 'ifood'), 0),
    desconto_ifood = coalesce((SELECT sum((d->>'total')::numeric)
        FROM jsonb_array_elements(coalesce(u.payload->'discounts', '[]'::jsonb)) d
        WHERE d->>'sponsorship' = 'ifood'), 0)
FROM ult u
WHERE u.loja_id = p.loja_id AND u.oid = p.order_id_cw;

UPDATE pedidos SET desconto_loja = coalesce(desconto, 0), desconto_ifood = 0 WHERE desconto_loja IS NULL;
