-- Numero curto do pedido (o que aparece pro cliente/loja), diferente do
-- order_id_cw interno (longo). Cardapio Web: external_display_id (numero da
-- propria plataforma, ex iFood/99Food) quando existe, senao display_id
-- (sequencial da loja). Saipos nao tem um numero curto separado -> usa o
-- order_id_cw mesmo (id_sale ja e relativamente curto).
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS numero_curto VARCHAR(50);

WITH ult AS (
    SELECT DISTINCT ON (loja_id, payload->>'id') loja_id, payload->>'id' AS oid,
           coalesce(payload->>'external_display_id', payload->>'display_id') AS numero
    FROM webhook_eventos
    WHERE tipo_evento IN ('polling', 'backfill') AND payload ? 'id'
    ORDER BY loja_id, payload->>'id', id DESC
)
UPDATE pedidos p SET numero_curto = u.numero
FROM ult u
WHERE u.loja_id = p.loja_id AND u.oid = p.order_id_cw AND u.numero IS NOT NULL;

UPDATE pedidos SET numero_curto = order_id_cw WHERE numero_curto IS NULL;

-- Saipos (sync_saipos.py) nao preenche numero_curto -> cai no order_id_cw por padrao
CREATE OR REPLACE FUNCTION pedidos_numero_curto_padrao() RETURNS trigger AS $$
BEGIN
    IF NEW.numero_curto IS NULL THEN
        NEW.numero_curto := NEW.order_id_cw;
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_pedidos_numero_curto ON pedidos;
CREATE TRIGGER trg_pedidos_numero_curto BEFORE INSERT OR UPDATE ON pedidos
    FOR EACH ROW EXECUTE FUNCTION pedidos_numero_curto_padrao();
