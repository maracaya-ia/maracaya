-- Alerta de desconto alto nos pedidos da 99: o unico desconto que a loja pode bancar e a taxa de
-- entrega. Quando desconto_loja passa da entrega por mais que a tolerancia, marca o Kui no grupo.
CREATE TABLE IF NOT EXISTS config_alertas (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
INSERT INTO config_alertas (chave, valor) VALUES
  ('desconto99_tolerancia', '15'),            -- R$ acima da taxa de entrega que dispara o alerta
  ('desconto99_marcar', '5561999916123')      -- WhatsApp do Kui (DDI+DDD+numero)
ON CONFLICT (chave) DO NOTHING;

CREATE TABLE IF NOT EXISTS alerta_desconto99 (
    pedido_id INTEGER PRIMARY KEY REFERENCES pedidos(id) ON DELETE CASCADE,
    excesso   NUMERIC(10,2) NOT NULL,
    avisado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
