-- Dados gerais da empresa usados no painel (ex: time atual no card de crescimento).
CREATE TABLE IF NOT EXISTS config_geral (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
INSERT INTO config_geral (chave, valor) VALUES ('funcionarios', '5') ON CONFLICT (chave) DO NOTHING;
