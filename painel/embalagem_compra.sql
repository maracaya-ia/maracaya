-- Bacon: 2 fatias por lanche (7 g cru cada) = 14 g crus (antes assumido 3 fatias)
UPDATE ficha_tecnica SET qtd = qtd * 14 / 21 WHERE insumo = 'Bacon';

-- Embalagem de compra: quanto vem em cada caixa/bolsa, na unidade de controle do estoque.
-- A coluna "Comprar" passa a mostrar tambem quantas embalagens pedir.
CREATE TABLE IF NOT EXISTS insumo_embalagem (
    insumo TEXT PRIMARY KEY,
    nome   TEXT NOT NULL,
    qtd    NUMERIC(12,3) NOT NULL CHECK (qtd > 0)
);

INSERT INTO insumo_embalagem (insumo, nome, qtd) VALUES
('Batata Chips', 'caixa', 100),            -- pacote de 50 g; caixa com 100
('Maionese Grill', 'bolsa', 1100),
('Maionese de Bacon', 'bolsa', 1100),
('Molho Baconese', 'bolsa', 1100),
('Molho Parmesão', 'bolsa', 1100),
('Molho Ervas Finas', 'bolsa', 1100),
('Molho Ranch', 'bolsa', 1100),
('Molho Barbecue', 'bolsa', 2000),
('Ketchup', 'bolsa', 2000),
('Mostarda', 'bolsa', 2000),
('Guaraná Normal', 'fardo', 15),
('Guaraná Zero', 'fardo', 15)
ON CONFLICT (insumo) DO NOTHING;
