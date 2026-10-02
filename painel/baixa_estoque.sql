-- Baixa automatica de estoque: sempre que um pedido novo (ou recem-cancelado/
-- reativado) e gravado, desconta (ou devolve) do insumo_estoque.estoque_atual
-- o consumo calculado pela ficha tecnica - a mesma regra usada no Plano de
-- estoque e no consumo da MIA (inclusive o sabor real do refrigerante do combo).
--
-- Molho escolhido no pedido: pote de 30 ml (~30 g) a mais do molho escolhido (_CASE_MOLHO no app.py).
--
-- Bebida do combo/item generico: se o cliente escolheu menos bebidas que a ficha prevê
-- (ex: combo com 2 e so 1 no complemento), o resto cai no sabor padrao da ficha.
--
-- So mexe em pedidos "recentes" (criado_em nas ultimas 48h) - existe justamente
-- pra NUNCA disparar durante um backfill historico (que insere pedidos com
-- criado_em de meses atras). sync.py/sync_saipos.py nao precisam de nenhuma
-- mudanca: o gatilho roda direto no banco, pra qualquer um dos dois.
--
-- So desconta insumo que ja tem uma linha em insumo_estoque (ou seja, que
-- alguem ja preencheu manualmente pelo menos uma vez) - sem isso, criaria
-- estoque negativo "do nada" pra insumo que ninguem nunca contou.

CREATE TABLE IF NOT EXISTS pedido_baixa_estoque (
    pedido_id  INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    insumo     TEXT NOT NULL,
    quantidade NUMERIC(12,3) NOT NULL,
    criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (pedido_id, insumo)
);

CREATE OR REPLACE FUNCTION calcular_consumo_pedido(p_pedido_id INTEGER)
RETURNS TABLE(insumo TEXT, quantidade NUMERIC) AS $$
BEGIN
    RETURN QUERY
    WITH base AS (
        SELECT i.id AS item_id, i.quantidade AS qtd_item,
               coalesce(a.canonico, lower(trim(i.nome))) AS produto
        FROM pedido_itens i
        JOIN pedidos p ON p.id = i.pedido_id
        LEFT JOIN produto_alias a ON a.alias = lower(trim(i.nome))
        WHERE i.pedido_id = p_pedido_id
    ),
    receita AS (
        SELECT f.insumo AS ins,
               (CASE WHEN (b.produto ILIKE 'combo%' OR b.produto IN ('refrigerantes', 'sucos', 'cervejas'))
                          AND f.insumo IN ('Coca Zero','Coca Normal','Guaraná Normal','Guaraná Zero','Fanta Laranja','Sprite',
                              'Heineken','Stella Artois','Suco Del Valle Uva','Suco Del Valle Maracujá',
                              'Suco (genérico)','Água com Gás','Água Normal','Cerveja (genérica)',
                              'Refrigerante (genérico)')
                     THEN greatest(b.qtd_item * f.qtd - coalesce((
                              SELECT sum(coalesce(co.quantidade, 1)) FROM pedido_complementos co
                              WHERE co.pedido_item_id = b.item_id AND (CASE
            WHEN co.nome ILIKE '%coca%' AND co.nome ILIKE '%zero%' THEN 'Coca Zero'
            WHEN co.nome ILIKE '%coca%' THEN 'Coca Normal'
            WHEN co.nome ILIKE '%guaran%' AND co.nome ILIKE '%zero%' THEN 'Guaraná Zero'
            WHEN co.nome ILIKE '%guaran%' THEN 'Guaraná Normal'
            WHEN co.nome ILIKE '%fanta%' THEN 'Fanta Laranja'
            WHEN co.nome ILIKE '%sprite%' THEN 'Sprite'
            WHEN co.nome ILIKE '%heineken%' THEN 'Heineken'
            WHEN co.nome ILIKE '%stella%' THEN 'Stella Artois'
            WHEN co.nome ILIKE '%suco%' AND co.nome ILIKE '%uva%' THEN 'Suco Del Valle Uva'
            WHEN co.nome ILIKE '%suco%' AND co.nome ILIKE '%maracuj%' THEN 'Suco Del Valle Maracujá'
            WHEN co.nome ILIKE '%suco%' THEN 'Suco (genérico)'
            WHEN (co.nome ILIKE '%agua%' OR co.nome ILIKE '%água%') AND (co.nome ILIKE '%gas%' OR co.nome ILIKE '%gás%') THEN 'Água com Gás'
            WHEN co.nome ILIKE '%agua%' OR co.nome ILIKE '%água%' THEN 'Água Normal'
            WHEN co.nome ILIKE '%cerveja%' THEN 'Cerveja (genérica)'
            WHEN co.nome ILIKE '%refriger%' THEN 'Refrigerante (genérico)'
        END) IS NOT NULL), 0), 0)
                     ELSE b.qtd_item * f.qtd END)::numeric AS qtd
        FROM base b JOIN ficha_tecnica f ON f.produto = b.produto
    ),
    refri_real AS (
        SELECT (CASE
            WHEN co.nome ILIKE '%coca%' AND co.nome ILIKE '%zero%' THEN 'Coca Zero'
            WHEN co.nome ILIKE '%coca%' THEN 'Coca Normal'
            WHEN co.nome ILIKE '%guaran%' AND co.nome ILIKE '%zero%' THEN 'Guaraná Zero'
            WHEN co.nome ILIKE '%guaran%' THEN 'Guaraná Normal'
            WHEN co.nome ILIKE '%fanta%' THEN 'Fanta Laranja'
            WHEN co.nome ILIKE '%sprite%' THEN 'Sprite'
            WHEN co.nome ILIKE '%heineken%' THEN 'Heineken'
            WHEN co.nome ILIKE '%stella%' THEN 'Stella Artois'
            WHEN co.nome ILIKE '%suco%' AND co.nome ILIKE '%uva%' THEN 'Suco Del Valle Uva'
            WHEN co.nome ILIKE '%suco%' AND co.nome ILIKE '%maracuj%' THEN 'Suco Del Valle Maracujá'
            WHEN co.nome ILIKE '%suco%' THEN 'Suco (genérico)'
            WHEN (co.nome ILIKE '%agua%' OR co.nome ILIKE '%água%') AND (co.nome ILIKE '%gas%' OR co.nome ILIKE '%gás%') THEN 'Água com Gás'
            WHEN co.nome ILIKE '%agua%' OR co.nome ILIKE '%água%' THEN 'Água Normal'
            WHEN co.nome ILIKE '%cerveja%' THEN 'Cerveja (genérica)'
            WHEN co.nome ILIKE '%refriger%' THEN 'Refrigerante (genérico)'
        END) AS ins, coalesce(co.quantidade, 1)::numeric AS qtd
        FROM base b
        JOIN pedido_complementos co ON co.pedido_item_id = b.item_id
        WHERE (b.produto ILIKE 'combo%' OR b.produto IN ('refrigerantes', 'sucos', 'cervejas')) AND (CASE
                    WHEN co.nome ILIKE '%coca%' AND co.nome ILIKE '%zero%' THEN 'Coca Zero'
                    WHEN co.nome ILIKE '%coca%' THEN 'Coca Normal'
                    WHEN co.nome ILIKE '%guaran%' AND co.nome ILIKE '%zero%' THEN 'Guaraná Zero'
                    WHEN co.nome ILIKE '%guaran%' THEN 'Guaraná Normal'
                    WHEN co.nome ILIKE '%fanta%' THEN 'Fanta Laranja'
                    WHEN co.nome ILIKE '%sprite%' THEN 'Sprite'
                    WHEN co.nome ILIKE '%heineken%' THEN 'Heineken'
                    WHEN co.nome ILIKE '%stella%' THEN 'Stella Artois'
                    WHEN co.nome ILIKE '%suco%' AND co.nome ILIKE '%uva%' THEN 'Suco Del Valle Uva'
                    WHEN co.nome ILIKE '%suco%' AND co.nome ILIKE '%maracuj%' THEN 'Suco Del Valle Maracujá'
                    WHEN co.nome ILIKE '%suco%' THEN 'Suco (genérico)'
                    WHEN (co.nome ILIKE '%agua%' OR co.nome ILIKE '%água%') AND (co.nome ILIKE '%gas%' OR co.nome ILIKE '%gás%') THEN 'Água com Gás'
                    WHEN co.nome ILIKE '%agua%' OR co.nome ILIKE '%água%' THEN 'Água Normal'
                    WHEN co.nome ILIKE '%cerveja%' THEN 'Cerveja (genérica)'
                    WHEN co.nome ILIKE '%refriger%' THEN 'Refrigerante (genérico)'
        END) IS NOT NULL
    )
    ,
    molho_extra AS (
        SELECT (CASE
            WHEN co.nome ILIKE '%maracay%' AND co.nome ILIKE '%molho%' THEN 'Maionese Grill'
            WHEN co.nome ILIKE '%baconese%' THEN 'Molho Baconese'
            WHEN co.nome ILIKE '%ervas%' THEN 'Molho Ervas Finas'
            WHEN co.nome ILIKE '%parmes%' THEN 'Molho Parmesão'
            WHEN co.nome ILIKE '%barbecue%' THEN 'Molho Barbecue'
        END) AS ins, (coalesce(co.quantidade, 1) * 30)::numeric AS qtd
        FROM base b
        JOIN pedido_complementos co ON co.pedido_item_id = b.item_id
        WHERE (CASE
            WHEN co.nome ILIKE '%maracay%' AND co.nome ILIKE '%molho%' THEN 'Maionese Grill'
            WHEN co.nome ILIKE '%baconese%' THEN 'Molho Baconese'
            WHEN co.nome ILIKE '%ervas%' THEN 'Molho Ervas Finas'
            WHEN co.nome ILIKE '%parmes%' THEN 'Molho Parmesão'
            WHEN co.nome ILIKE '%barbecue%' THEN 'Molho Barbecue'
        END) IS NOT NULL
    )
    ,
    nuggets AS (
        SELECT 'Nuggets'::text AS ins,
               (b.qtd_item * (CASE WHEN co.nome ILIKE '%tamanho p%' THEN 9
                                   WHEN co.nome ILIKE '%tamanho g%' THEN 12 END))::numeric AS qtd
        FROM base b JOIN pedido_complementos co ON co.pedido_item_id = b.item_id
        WHERE b.produto = 'nuggets'
          AND (co.nome ILIKE '%tamanho p%' OR co.nome ILIKE '%tamanho g%')
    ),
    agua_escolha AS (
        SELECT (CASE WHEN (co.nome ILIKE '%agua%' OR co.nome ILIKE '%água%') AND (co.nome ILIKE '%gas%' OR co.nome ILIKE '%gás%') THEN 'Água com Gás'
                     WHEN co.nome ILIKE '%agua%' OR co.nome ILIKE '%água%' THEN 'Água Normal' END) AS ins,
               (b.qtd_item * coalesce(co.quantidade, 1))::numeric AS qtd
        FROM base b JOIN pedido_complementos co ON co.pedido_item_id = b.item_id
        WHERE b.produto = 'água mineral - com ou sem gás' AND (co.nome ILIKE '%agua%' OR co.nome ILIKE '%água%')
    )
    ,
    batata_extra AS (
        SELECT 'Batata Frita'::text AS ins, (coalesce(co.quantidade, 1) * 146)::numeric AS qtd
        FROM base b JOIN pedido_complementos co ON co.pedido_item_id = b.item_id
        WHERE NOT (b.produto ILIKE 'combo%') AND lower(trim(co.nome)) = 'batata frita'
    )
    SELECT ins, sum(qtd) FROM (SELECT * FROM receita UNION ALL SELECT * FROM refri_real
                               UNION ALL SELECT * FROM batata_extra
                               UNION ALL SELECT * FROM molho_extra
                               UNION ALL SELECT * FROM nuggets
                               UNION ALL SELECT * FROM agua_escolha) t
    GROUP BY ins;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION baixar_estoque_pedido() RETURNS trigger AS $$
DECLARE
    ja_baixado boolean;
BEGIN
    IF NEW.criado_em < now() - interval '2 days' THEN
        RETURN NEW;
    END IF;

    SELECT EXISTS(SELECT 1 FROM pedido_baixa_estoque WHERE pedido_id = NEW.id) INTO ja_baixado;

    IF NEW.status <> 'canceled' AND NOT ja_baixado THEN
        INSERT INTO pedido_baixa_estoque (pedido_id, insumo, quantidade)
        SELECT NEW.id, c.insumo, c.quantidade FROM calcular_consumo_pedido(NEW.id) c
        WHERE EXISTS (SELECT 1 FROM insumo_estoque ie WHERE ie.insumo = c.insumo)
        ON CONFLICT (pedido_id, insumo) DO NOTHING;

        UPDATE insumo_estoque ie SET estoque_atual = ie.estoque_atual - b.quantidade, atualizado_em = now()
        FROM pedido_baixa_estoque b WHERE b.pedido_id = NEW.id AND b.insumo = ie.insumo;

    ELSIF NEW.status = 'canceled' AND ja_baixado THEN
        UPDATE insumo_estoque ie SET estoque_atual = ie.estoque_atual + b.quantidade, atualizado_em = now()
        FROM pedido_baixa_estoque b WHERE b.pedido_id = NEW.id AND b.insumo = ie.insumo;

        DELETE FROM pedido_baixa_estoque WHERE pedido_id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_baixar_estoque ON pedidos;
CREATE CONSTRAINT TRIGGER trg_baixar_estoque
    AFTER INSERT OR UPDATE OF status ON pedidos
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION baixar_estoque_pedido();
