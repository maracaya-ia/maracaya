-- Fundação multi-unidade: dimensão "unidade" + loja Sobradinho (Saipos)
-- Rodar:
--   docker exec -i dados_postgres psql -U alvaro -d operacao < painel/multiunidade.sql

-- 1. Cadastra a loja Sobradinho (Saipos). Reusa a coluna codigo_loja pro id_store do Saipos.
INSERT INTO lojas (codigo_loja, marca) VALUES ('81530', 'Maracayá Burger - Quadra 8')
ON CONFLICT (codigo_loja) DO UPDATE SET marca = EXCLUDED.marca;

-- 2. Coluna de plataforma na loja (pra saber de onde vem cada uma)
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS plataforma TEXT DEFAULT 'cardapio_web';
UPDATE lojas SET plataforma = 'saipos' WHERE codigo_loja = '81530';
UPDATE lojas SET plataforma = 'cardapio_web' WHERE codigo_loja = '46472';

-- 3. Dimensão UNIDADE nos pedidos (Colorado / Sobradinho / Chomp)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS unidade TEXT;

-- Preenche a unidade dos pedidos já existentes:
-- tudo que é da loja 46472 e marca Chomp -> unidade "Chomp"; senão -> "Colorado"
UPDATE pedidos p
SET unidade = CASE
    WHEN p.marca = 'Chomp Burger' THEN 'Chomp'
    ELSE 'Colorado'
END
FROM lojas l
WHERE p.loja_id = l.id AND l.codigo_loja = '46472' AND p.unidade IS NULL;

-- 4. Índice pra filtrar rápido por unidade
CREATE INDEX IF NOT EXISTS idx_pedidos_unidade ON pedidos (unidade);

-- 5. Tabela de tradução: termos do Saipos -> idioma único do sistema
CREATE TABLE IF NOT EXISTS traducao_saipos (
    campo    TEXT NOT NULL,     -- 'status' | 'tipo' | 'pagamento' | 'canal'
    origem   TEXT NOT NULL,     -- termo como vem do Saipos
    destino  TEXT NOT NULL,     -- termo padrão do nosso sistema
    PRIMARY KEY (campo, origem)
);

INSERT INTO traducao_saipos (campo, origem, destino) VALUES
    ('status', 'N', 'closed'),          -- canceled='N' -> pedido válido
    ('status', 'S', 'canceled'),        -- canceled='S' -> cancelado
    ('tipo', '1', 'delivery'),          -- id_sale_type 1 = delivery
    ('tipo', '2', 'takeout'),           -- 2 = retirada (confirmar)
    ('tipo', '3', 'dine_in'),           -- 3 = mesa/local (confirmar)
    ('canal', '99 Food', '99food'),
    ('canal', 'iFood', 'ifood'),
    ('canal', 'Saipos', 'proprio')
ON CONFLICT (campo, origem) DO UPDATE SET destino = EXCLUDED.destino;

-- Confere o resultado
SELECT 'Lojas cadastradas:' AS info;
SELECT codigo_loja, marca, plataforma FROM lojas ORDER BY id;
SELECT 'Pedidos por unidade:' AS info;
SELECT unidade, count(*) FROM pedidos GROUP BY 1 ORDER BY 2 DESC;
