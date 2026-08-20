-- Classificacao de marca (Maracayá x Chomp) por nome de produto
-- Rodar uma vez:
--   docker exec -i dados_postgres psql -U alvaro -d operacao < marca.sql

-- 1. Tabela de regras: nomes que identificam um pedido do Chomp
CREATE TABLE IF NOT EXISTS regras_marca (
    padrao TEXT PRIMARY KEY,
    marca  TEXT NOT NULL
);

INSERT INTO regras_marca (padrao, marca) VALUES
    ('%detroit%',  'Chomp Burger'),
    ('%texas%',    'Chomp Burger'),
    ('%colorado%', 'Chomp Burger'),
    ('%portland%', 'Chomp Burger'),
    ('%memphis%',  'Chomp Burger')
ON CONFLICT (padrao) DO NOTHING;
-- Lancou burger novo no Chomp? So adicionar:
-- INSERT INTO regras_marca VALUES ('%nashville%', 'Chomp Burger');

-- 2. Coluna de marca no pedido
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS marca TEXT;

-- 3. Funcao que classifica um pedido pelos seus itens
CREATE OR REPLACE FUNCTION classificar_pedido(p_id INT) RETURNS VOID AS $$
BEGIN
    UPDATE pedidos p SET marca = CASE
        WHEN EXISTS (
            SELECT 1 FROM pedido_itens i
            JOIN regras_marca r ON i.nome ILIKE r.padrao
            WHERE i.pedido_id = p_id
        ) THEN 'Chomp Burger'
        ELSE 'Maracayá Burger'
    END
    WHERE p.id = p_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Gatilho: sempre que um item entra, o pedido dele e reclassificado.
--    Backfill e sincronizador nao precisam mudar nada.
CREATE OR REPLACE FUNCTION trg_classificar() RETURNS TRIGGER AS $$
BEGIN
    PERFORM classificar_pedido(NEW.pedido_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS classifica_marca ON pedido_itens;
CREATE TRIGGER classifica_marca
    AFTER INSERT ON pedido_itens
    FOR EACH ROW EXECUTE FUNCTION trg_classificar();

-- 5. Reclassifica todo o historico existente
UPDATE pedidos p SET marca = CASE
    WHEN EXISTS (
        SELECT 1 FROM pedido_itens i
        JOIN regras_marca r ON i.nome ILIKE r.padrao
        WHERE i.pedido_id = p.id
    ) THEN 'Chomp Burger'
    ELSE 'Maracayá Burger'
END;

-- 6. Confere o resultado
SELECT marca, count(*) AS pedidos, round(sum(total)) AS faturamento
FROM pedidos GROUP BY marca ORDER BY 2 DESC;
