-- Molho Grill (Maracaya) passa a ir so no topo do pao: 20 g por lanche (antes 40 g, base + topo).
-- 1) CMV (produto_custos): tira o custo dos gramas que sairam, na mesma proporcao de cada produto
--    (20 g por lanche; combos de varios lanches proporcionalmente). Roda ANTES de mexer na ficha.
-- 2) Ficha tecnica: Maionese Grill pela metade (baixa de estoque e custo por ficha acompanham).
BEGIN;
UPDATE produto_custos pc
SET custo = round(pc.custo - (f.qtd / 2) * (SELECT custo_unitario FROM insumo_custo WHERE insumo = 'Maionese Grill'), 2),
    atualizado_em = now()
FROM ficha_tecnica f
WHERE f.insumo = 'Maionese Grill' AND pc.nome = f.produto;

UPDATE ficha_tecnica SET qtd = qtd / 2 WHERE insumo = 'Maionese Grill';
COMMIT;

-- minimo da Maionese Grill pelo novo consumo medio diario (4 semanas, ficha de 20 g): 910,7 g -> 911 g (antes 1.949 g)
UPDATE insumo_minimo SET minimo = 911 WHERE insumo = 'Maionese Grill';
