-- tela Equipe: checklist de fechamento, recado do dia e escala da semana
INSERT INTO checklist_itens (turno, ordem, texto) VALUES
 ('fechamento',1,'Fechar caixa e conferir sangria'),
 ('fechamento',2,'Desligar chapa e fritadeira'),
 ('fechamento',3,'Guardar insumos na câmara com etiqueta'),
 ('fechamento',4,'Pausar lojas no iFood e 99Food'),
 ('fechamento',5,'Foto da cozinha limpa no grupo')
ON CONFLICT (turno, texto) DO NOTHING;
CREATE TABLE IF NOT EXISTS recados (
    id        serial PRIMARY KEY,
    texto     text NOT NULL,
    autor     text,
    criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS escala (
    dia    date NOT NULL,
    funcao text NOT NULL,
    nome   text,
    PRIMARY KEY (dia, funcao)
);
