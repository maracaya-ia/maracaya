-- login por perfil (socio, gerente, cozinha): uma senha por perfil, guardada com hash
CREATE TABLE IF NOT EXISTS acessos (
    perfil        text PRIMARY KEY CHECK (perfil IN ('socio','gerente','cozinha')),
    senha_hash    text NOT NULL,
    atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS acesso_config (
    chave text PRIMARY KEY,
    valor text NOT NULL
);
