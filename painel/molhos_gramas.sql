-- Molhos passam a ser controlados em gramas.
-- Regra (confirmada pelo Alvaro): todo lanche leva molho na base e no topo do pao,
-- ~20 g em cada = 40 g por lanche (Maionese Grill e o padrao; Maionese de Bacon e
-- Molho Ranch fazem o papel de molho nos lanches que os usam).
-- Molho escolhido no pedido (complemento) vai a parte, num pote de 30 ml (~30 g),
-- e baixa a mais do molho escolhido (nao substitui o padrao) - ver _CASE_MOLHO no app.py.

BEGIN;

UPDATE ficha_tecnica SET qtd = qtd * 40, unidade = 'g' WHERE insumo = 'Maionese Grill';
UPDATE ficha_tecnica SET qtd = qtd * 40, unidade = 'g' WHERE insumo = 'Maionese de Bacon';
UPDATE ficha_tecnica SET qtd = 40, unidade = 'g' WHERE insumo = 'Molho Ranch';

-- molhos escolhidos no pedido
INSERT INTO insumo_unidade (insumo, unidade) VALUES
('Molho Maracayá', 'g'),
('Molho Baconese', 'g')
ON CONFLICT (insumo) DO NOTHING;

-- estoque antigo estava em "un"/"kg": Ranch converte (kg -> g); Grill e Bacon
-- precisam ser recontados em gramas (valores anteriores: Grill -34 un, Bacon 3 un)
UPDATE insumo_estoque SET estoque_atual = estoque_atual * 1000, atualizado_em = now()
WHERE insumo = 'Molho Ranch';
DELETE FROM insumo_estoque WHERE insumo IN ('Maionese Grill', 'Maionese de Bacon');

-- baixas ja registradas estavam na unidade antiga; apagar evita reverter em unidade errada
DELETE FROM pedido_baixa_estoque WHERE insumo IN ('Maionese Grill', 'Maionese de Bacon', 'Molho Ranch');

COMMIT;
