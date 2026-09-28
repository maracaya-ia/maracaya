-- Corrige clientes.total_pedidos / total_gasto inflados: os scripts de sync somavam +1 a cada
-- reprocessamento do mesmo pedido (ex.: backfill rodado varias vezes). A partir daqui os totais
-- sao SEMPRE recalculados da tabela pedidos (pedidos nao cancelados) por trigger.

CREATE OR REPLACE FUNCTION clientes_recalcular_totais() RETURNS trigger AS $$
DECLARE cid INTEGER;
BEGIN
    FOR cid IN
        SELECT DISTINCT x FROM unnest(ARRAY[
            CASE WHEN TG_OP <> 'INSERT' THEN OLD.cliente_id END,
            CASE WHEN TG_OP <> 'DELETE' THEN NEW.cliente_id END]) AS x
        WHERE x IS NOT NULL
    LOOP
        UPDATE clientes c SET
            total_pedidos = s.n,
            total_gasto = s.g,
            primeiro_pedido_em = coalesce(s.mi, c.primeiro_pedido_em),
            ultimo_pedido_em = coalesce(s.ma, c.ultimo_pedido_em)
        FROM (SELECT count(*) AS n, coalesce(sum(total), 0) AS g,
                     min(criado_em) AS mi, max(criado_em) AS ma
              FROM pedidos WHERE cliente_id = cid AND status <> 'canceled') s
        WHERE c.id = cid;
    END LOOP;
    RETURN NULL;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clientes_totais ON pedidos;
CREATE TRIGGER trg_clientes_totais AFTER INSERT OR DELETE OR UPDATE OF status, total, cliente_id, criado_em
    ON pedidos FOR EACH ROW EXECUTE FUNCTION clientes_recalcular_totais();

-- recalculo unico de todos os clientes
UPDATE clientes c SET
    total_pedidos = coalesce(s.n, 0),
    total_gasto = coalesce(s.g, 0),
    primeiro_pedido_em = coalesce(s.mi, c.primeiro_pedido_em),
    ultimo_pedido_em = coalesce(s.ma, c.ultimo_pedido_em)
FROM clientes c2
LEFT JOIN (SELECT cliente_id, count(*) AS n, sum(total) AS g,
                  min(criado_em) AS mi, max(criado_em) AS ma
           FROM pedidos WHERE status <> 'canceled' GROUP BY cliente_id) s ON s.cliente_id = c2.id
WHERE c.id = c2.id;
