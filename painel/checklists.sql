-- checklists da equipe (abertura, cozinha): itens fixos + registro diario de quem marcou e a que horas
CREATE TABLE IF NOT EXISTS checklist_itens (
    id      serial PRIMARY KEY,
    turno   text NOT NULL,            -- 'abertura' | 'cozinha'
    ordem   int  NOT NULL DEFAULT 0,
    texto   text NOT NULL,
    ativo   boolean NOT NULL DEFAULT true,
    UNIQUE (turno, texto)
);
CREATE TABLE IF NOT EXISTS checklist_registros (
    item_id     int  NOT NULL REFERENCES checklist_itens(id) ON DELETE CASCADE,
    dia         date NOT NULL,
    quem        text,
    marcado_em  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (item_id, dia)
);
INSERT INTO checklist_itens (turno, ordem, texto) VALUES
 ('abertura',1,'Chapa ligada e temperatura conferida'),
 ('abertura',2,'Pães e blends contados e no lugar'),
 ('abertura',3,'Molhos do dia prontos e etiquetados'),
 ('abertura',4,'iFood, 99Food e portal abertos'),
 ('abertura',5,'Motoboy confirmado'),
 ('abertura',6,'Caixa conferido (troco)'),
 ('cozinha',1,'Câmara fria abaixo de 4 °C'),
 ('cozinha',2,'Validade dos molhos conferida'),
 ('cozinha',3,'Bancada higienizada'),
 ('cozinha',4,'Óleo da fritadeira trocado (a cada 3 dias)')
ON CONFLICT (turno, texto) DO NOTHING;
