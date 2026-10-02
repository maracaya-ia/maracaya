-- Fichas que faltavam (180 vendas/60 dias sem baixa):
--  * Combo Pai Selvagem + Brinde = 2 Selvagens + 2 batatas fritas + 2 refrigerantes
--  * Combo Amor Feroz / Amor Feroz = Duplo Fera + Duplo Selvagem
--  * Nuggets: baixa por tamanho do complemento (P = 9, G = 12) - ver _CASE_NUGGET no app.py
--  * Agua mineral "com ou sem gas": o insumo vem do complemento escolhido

INSERT INTO ficha_tecnica (produto, insumo, qtd, unidade)
SELECT 'combo pai selvagem + brinde', insumo, qtd * 2, unidade FROM ficha_tecnica WHERE produto = 'selvagem'
ON CONFLICT (produto, insumo) DO UPDATE SET qtd = EXCLUDED.qtd;
INSERT INTO ficha_tecnica (produto, insumo, qtd, unidade) VALUES
('combo pai selvagem + brinde', 'Batata Frita', 0.2, 'kg'),
('combo pai selvagem + brinde', 'Papel de Batata', 2, 'un'),
('combo pai selvagem + brinde', 'Guaraná Normal', 2, 'un')
ON CONFLICT (produto, insumo) DO UPDATE SET qtd = EXCLUDED.qtd;

INSERT INTO ficha_tecnica (produto, insumo, qtd, unidade)
SELECT p, insumo, sum(qtd), min(unidade)
FROM ficha_tecnica, (VALUES ('combo amor feroz'), ('amor feroz')) AS destinos(p)
WHERE produto IN ('duplo fera', 'duplo selvagem')
GROUP BY p, insumo
ON CONFLICT (produto, insumo) DO UPDATE SET qtd = EXCLUDED.qtd;

INSERT INTO produto_alias (alias, canonico) VALUES
('combo pai selvagem + brinde (cópia)', 'combo pai selvagem + brinde')
ON CONFLICT (alias) DO NOTHING;
-- alias antigo apontava pra um nome sem ficha
UPDATE produto_alias SET canonico = 'água com gás crystal 500ml' WHERE alias = 'água com gás crystal 500ml';

INSERT INTO insumo_unidade (insumo, unidade) VALUES ('Nuggets', 'un') ON CONFLICT (insumo) DO NOTHING;
