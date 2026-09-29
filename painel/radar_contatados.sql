-- Historico de quem apareceu no Radar semanal (sumido/risco/primeira sem segunda),
-- pra medir depois se a pessoa voltou a comprar sem precisar de nenhuma marcacao manual.
CREATE TABLE IF NOT EXISTS radar_contatados (
    id            SERIAL PRIMARY KEY,
    cliente_id    INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    categoria     TEXT NOT NULL CHECK (categoria IN ('sumido', 'risco', 'primeira_sem_segunda')),
    sinalizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_radar_contatados_cliente ON radar_contatados (cliente_id, sinalizado_em);
