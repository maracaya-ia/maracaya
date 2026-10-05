-- Restaura o papel kraft baixado a mais (combos de varios lanches baixavam 2 ou 4, o certo e 1):
-- recalcula cada baixa registrada pela ficha atual, devolve a diferenca ao estoque e corrige o registro.
BEGIN;
CREATE TEMP TABLE ajuste_kraft AS
SELECT b.pedido_id, b.quantidade AS registrado, c.quantidade AS correto, b.quantidade - c.quantidade AS excesso
FROM pedido_baixa_estoque b
JOIN LATERAL calcular_consumo_pedido(b.pedido_id) c ON c.insumo = b.insumo
WHERE b.insumo = 'Papel Kraft' AND b.quantidade <> c.quantidade;

SELECT count(*) AS pedidos_corrigidos, coalesce(sum(excesso), 0) AS kraft_a_devolver FROM ajuste_kraft;
SELECT estoque_atual AS estoque_antes FROM insumo_estoque WHERE insumo = 'Papel Kraft';

UPDATE insumo_estoque SET estoque_atual = estoque_atual + (SELECT coalesce(sum(excesso), 0) FROM ajuste_kraft),
       atualizado_em = now() WHERE insumo = 'Papel Kraft';
UPDATE pedido_baixa_estoque b SET quantidade = a.correto
FROM ajuste_kraft a WHERE b.pedido_id = a.pedido_id AND b.insumo = 'Papel Kraft';

SELECT estoque_atual AS estoque_depois FROM insumo_estoque WHERE insumo = 'Papel Kraft';
COMMIT;
