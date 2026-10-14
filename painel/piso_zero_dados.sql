-- Estoque nao fica negativo: zera o que estava negativo (cada ajuste fica no historico) e tira o
-- estoque dos itens de ciclo de troca (hortifruti), que nao tem contagem.
BEGIN;
INSERT INTO estoque_movimento (insumo, tipo, delta, saldo_apos, obs)
SELECT insumo, 'ajuste', -estoque_atual, 0, 'zerado (estava negativo)'
FROM insumo_estoque WHERE estoque_atual < 0 AND insumo NOT IN (SELECT insumo FROM insumo_ciclo);
UPDATE insumo_estoque SET estoque_atual = 0, atualizado_em = now()
WHERE estoque_atual < 0 AND insumo NOT IN (SELECT insumo FROM insumo_ciclo);
DELETE FROM insumo_estoque WHERE insumo IN (SELECT insumo FROM insumo_ciclo);
COMMIT;
