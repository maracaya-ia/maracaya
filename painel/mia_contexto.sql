-- Memoria curta da MIA por grupo do WhatsApp: guarda o ultimo filtro/periodo/intencao
-- resolvidos, pra perguntas de continuacao ("e semana passada?", "e a Colorado?")
-- reaproveitarem o que nao foi repetido. Expira sozinha (a query so le linhas recentes).
CREATE TABLE IF NOT EXISTS mia_contexto (
    grupo           TEXT PRIMARY KEY,
    marca           TEXT,
    unidade         TEXT,
    periodo_frase   TEXT,
    intent_keyword  TEXT,
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
