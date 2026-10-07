-- Alerta de margem baixa: avisa o Kui (no grupo) quando um pedido novo fecha com margem
-- (mesma conta da aba Performance, lucro / subtotal) abaixo do minimo configurado.
INSERT INTO config_alertas (chave, valor) VALUES ('margem_minima', '15') ON CONFLICT (chave) DO NOTHING;

CREATE TABLE IF NOT EXISTS alerta_margem (
    pedido_id  INTEGER PRIMARY KEY REFERENCES pedidos(id) ON DELETE CASCADE,
    margem     NUMERIC(8,2) NOT NULL,
    avisado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
