-- Batata e bacon passam a ser controlados em gramas, no peso CRU (que e o que se compra e conta).
--  * Batata frita: porcao pronta = 100 g, crua = 146 g  -> baixa 146 g por porcao (qtd_kg * 1460)
--  * Bacon: 7 g cru por fatia (5 g depois de frito); a ficha ja tinha 3 fatias (0,021 kg) -> 21 g
BEGIN;

ALTER TABLE insumo_custo ALTER COLUMN custo_unitario TYPE numeric(12,6);

UPDATE ficha_tecnica SET qtd = qtd * 1460, unidade = 'g' WHERE insumo = 'Batata Frita';
UPDATE ficha_tecnica SET qtd = qtd * 1000, unidade = 'g' WHERE insumo = 'Bacon';

UPDATE insumo_custo SET custo_unitario = custo_unitario / 1000, atualizado_em = now()
WHERE insumo IN ('Batata Frita', 'Bacon');
UPDATE insumo_estoque SET estoque_atual = estoque_atual * 1000, atualizado_em = now()
WHERE insumo IN ('Batata Frita', 'Bacon');

-- baixas ja registradas estavam em kg
DELETE FROM pedido_baixa_estoque WHERE insumo IN ('Batata Frita', 'Bacon');

-- combos novos montados com montar_combo() ja usam a batata crua em g
CREATE OR REPLACE FUNCTION montar_combo(nome_combo TEXT, burger TEXT, refri TEXT) RETURNS VOID AS $f$
BEGIN
    INSERT INTO ficha_tecnica (produto, insumo, qtd, unidade)
    SELECT nome_combo, insumo, qtd, unidade FROM ficha_tecnica WHERE produto = burger
    ON CONFLICT (produto, insumo) DO UPDATE SET qtd = EXCLUDED.qtd;
    INSERT INTO ficha_tecnica VALUES
        (nome_combo, 'Batata Frita', 146, 'g'),
        (nome_combo, 'Papel de Batata', 1, 'un'),
        (nome_combo, refri, 1, 'un')
    ON CONFLICT (produto, insumo) DO UPDATE SET qtd = EXCLUDED.qtd;
END;
$f$ LANGUAGE plpgsql;

COMMIT;
