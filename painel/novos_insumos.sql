-- Cadastro de insumos que ainda nao tem consumo mapeado na ficha tecnica
-- (hoje a tabela de estoque so listava quem ja vendeu nos ultimos 28 dias).
-- unidade: 'un', 'kg' ou 'g' (molhos controlados por grama).

CREATE TABLE IF NOT EXISTS insumo_unidade (
    insumo  TEXT PRIMARY KEY,
    unidade TEXT NOT NULL CHECK (unidade IN ('un', 'kg', 'g'))
);

INSERT INTO insumo_unidade (insumo, unidade) VALUES
('Pudim', 'un'),
('Picles', 'un'),
('Molho Parmesão', 'g'),
('Molho Barbecue', 'g'),
('Molho Ervas Finas', 'g')
ON CONFLICT (insumo) DO NOTHING;

-- Pudim e vendido avulso (7 vendas): 1 pudim por item
INSERT INTO ficha_tecnica (produto, insumo, qtd, unidade)
SELECT 'pudim', 'Pudim', 1, 'un'
WHERE NOT EXISTS (SELECT 1 FROM ficha_tecnica WHERE produto = 'pudim' AND insumo = 'Pudim');
