-- Hortifruti (alface, tomate, rucula) nao tem contagem de estoque: e trocado em ciclo
-- (segunda, quarta e sexta), por ter acabado ou por ja estar velho. O sistema calcula
-- a quantidade necessaria ate a proxima troca, em vez de estoque minimo/pedir ate.
CREATE TABLE IF NOT EXISTS insumo_ciclo (insumo TEXT PRIMARY KEY);
INSERT INTO insumo_ciclo (insumo) VALUES ('Alface'), ('Tomate'), ('Rúcula') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS config_estoque (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
INSERT INTO config_estoque (chave, valor) VALUES ('troca_dias', 'seg,qua,sex') ON CONFLICT DO NOTHING;
