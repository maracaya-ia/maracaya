-- Sistema de Dados — Maracayá + Chomp
-- Executado automaticamente na primeira subida do Postgres (via docker-compose)

-- Banco separado para o Metabase guardar suas configurações
CREATE DATABASE metabase_app;

-- ==========================================================
-- LOJAS
-- ==========================================================
CREATE TABLE lojas (
    id            SERIAL PRIMARY KEY,
    codigo_loja   VARCHAR(20) UNIQUE NOT NULL,
    marca         VARCHAR(50) NOT NULL,
    criado_em     TIMESTAMPTZ DEFAULT now()
);

INSERT INTO lojas (codigo_loja, marca) VALUES
    ('46472', 'Maracayá Burger'),
    ('PENDENTE', 'Chomp Burger'); -- atualizar com o código real da loja Chomp

-- ==========================================================
-- CLIENTES
-- ==========================================================
CREATE TABLE clientes (
    id                  SERIAL PRIMARY KEY,
    loja_id             INT NOT NULL REFERENCES lojas(id),
    cliente_id_cw       VARCHAR(50),
    nome                VARCHAR(150),
    telefone            VARCHAR(30),
    primeiro_pedido_em  TIMESTAMPTZ,
    ultimo_pedido_em    TIMESTAMPTZ,
    total_pedidos       INT DEFAULT 0,
    total_gasto         NUMERIC(12,2) DEFAULT 0,
    UNIQUE (loja_id, cliente_id_cw)
);

-- ==========================================================
-- PEDIDOS
-- ==========================================================
CREATE TABLE pedidos (
    id                   SERIAL PRIMARY KEY,
    loja_id              INT NOT NULL REFERENCES lojas(id),
    order_id_cw          VARCHAR(50) NOT NULL,
    cliente_id           INT REFERENCES clientes(id),
    status               VARCHAR(30),
    tipo                 VARCHAR(30),   -- delivery, retirada, mesa
    origem               VARCHAR(30),   -- site, whatsapp, balcao...
    subtotal             NUMERIC(12,2),
    taxa_entrega         NUMERIC(12,2),
    desconto             NUMERIC(12,2),
    total                NUMERIC(12,2),
    forma_pagamento      VARCHAR(50),
    cupom                VARCHAR(50),
    criado_em            TIMESTAMPTZ,
    concluido_em         TIMESTAMPTZ,
    motivo_cancelamento  TEXT,
    UNIQUE (loja_id, order_id_cw)
);

CREATE INDEX idx_pedidos_criado_em ON pedidos (criado_em);
CREATE INDEX idx_pedidos_loja ON pedidos (loja_id);
CREATE INDEX idx_pedidos_status ON pedidos (status);

-- ==========================================================
-- ITENS DO PEDIDO
-- ==========================================================
CREATE TABLE pedido_itens (
    id              SERIAL PRIMARY KEY,
    pedido_id       INT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    item_id_cw      VARCHAR(50),
    nome            VARCHAR(150),
    categoria       VARCHAR(100),
    quantidade      INT,
    preco_unitario  NUMERIC(12,2),
    total           NUMERIC(12,2)
);

CREATE INDEX idx_pedido_itens_pedido ON pedido_itens (pedido_id);
CREATE INDEX idx_pedido_itens_nome ON pedido_itens (nome);

-- ==========================================================
-- COMPLEMENTOS DO ITEM (bacon extra, ponto da carne...)
-- ==========================================================
CREATE TABLE pedido_complementos (
    id              SERIAL PRIMARY KEY,
    pedido_item_id  INT NOT NULL REFERENCES pedido_itens(id) ON DELETE CASCADE,
    nome            VARCHAR(150),
    quantidade      INT,
    preco           NUMERIC(12,2)
);

-- ==========================================================
-- CATÁLOGO (snapshot dos produtos ativos)
-- ==========================================================
CREATE TABLE catalogo_itens (
    id             SERIAL PRIMARY KEY,
    loja_id        INT NOT NULL REFERENCES lojas(id),
    item_id_cw     VARCHAR(50),
    nome           VARCHAR(150),
    categoria      VARCHAR(100),
    preco_atual    NUMERIC(12,2),
    ativo          BOOLEAN DEFAULT true,
    atualizado_em  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (loja_id, item_id_cw)
);

-- ==========================================================
-- AVALIAÇÕES
-- ==========================================================
CREATE TABLE avaliacoes (
    id            SERIAL PRIMARY KEY,
    loja_id       INT NOT NULL REFERENCES lojas(id),
    pedido_id_cw  VARCHAR(50),
    nota          INT,
    comentario    TEXT,
    criado_em     TIMESTAMPTZ
);

-- ==========================================================
-- LOG BRUTO DE EVENTOS (o "seguro" do sistema)
-- ==========================================================
CREATE TABLE webhook_eventos (
    id           SERIAL PRIMARY KEY,
    loja_id      INT REFERENCES lojas(id),
    tipo_evento  VARCHAR(50),
    payload      JSONB NOT NULL,
    recebido_em  TIMESTAMPTZ DEFAULT now(),
    processado   BOOLEAN DEFAULT false
);

CREATE INDEX idx_webhook_processado ON webhook_eventos (processado);
