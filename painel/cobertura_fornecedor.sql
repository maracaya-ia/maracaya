-- Cobertura de estoque por fornecedor: por quantos dias o pedido deve cobrir o consumo
-- depois da entrega (a sugestao de compra nunca cobre menos que o maior intervalo
-- entre duas entregas do fornecedor).
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS cobertura_dias INTEGER NOT NULL DEFAULT 14;

UPDATE fornecedores SET cobertura_dias = CASE nome
    WHEN 'Ki Karnes'   THEN 3    -- carnes/bacon, perecivel, entrega todo dia
    WHEN 'Juju Batata' THEN 3    -- perecivel, entrega todo dia
    WHEN 'Pão e Roça'  THEN 4    -- paes frescos, entrega seg/qua/sex (intervalo de 2-3 dias)
    WHEN 'Ki Pudim'    THEN 7    -- perecivel, so quarta (intervalo de 7 dias)
    WHEN 'Ambev'       THEN 7    -- bebida, entrega todo dia, prazo curto
    WHEN 'Brasal'      THEN 10   -- bebida, qua/sab, boleto em 10 dias
    WHEN 'Delly''s'    THEN 14   -- congelados, molhos, queijo; qua/sex
    WHEN 'Garra'       THEN 21   -- descartaveis e saches, nao estragam, seg/ter/qua
    ELSE cobertura_dias END;
