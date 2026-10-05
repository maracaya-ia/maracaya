-- Historico de movimentos de estoque: toda baixa de pedido, estorno de cancelamento,
-- entrega recebida e contagem manual (ajuste) fica registrada, com o saldo apos o movimento.
CREATE TABLE IF NOT EXISTS estoque_movimento (
    id         BIGSERIAL PRIMARY KEY,
    insumo     TEXT NOT NULL,
    tipo       TEXT NOT NULL CHECK (tipo IN ('baixa', 'estorno', 'entrada', 'ajuste', 'inicial')),
    delta      NUMERIC(14,3) NOT NULL,
    saldo_apos NUMERIC(14,3),
    pedido_id  INTEGER,
    obs        TEXT,
    criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS estoque_movimento_insumo_idx ON estoque_movimento (insumo, criado_em DESC);

-- baixas que ja aconteceram (saldo desconhecido, so o que saiu e de qual pedido)
INSERT INTO estoque_movimento (insumo, tipo, delta, pedido_id, criado_em)
SELECT b.insumo, 'baixa', -b.quantidade, b.pedido_id, b.criado_em
FROM pedido_baixa_estoque b
WHERE NOT EXISTS (SELECT 1 FROM estoque_movimento m WHERE m.pedido_id = b.pedido_id AND m.insumo = b.insumo);
