-- Ficha tecnica do Hexa (54 vendas sem nenhuma baixa de insumo ate aqui).
-- Receita informada: pao brioche com gergelim, ketchup, mostarda, cebola picadinha,
-- picles picadinho, queijo cheddar e carne de 150 g.
-- Assumido (padrao dos demais lanches): 1 Carne Angus, 2 cheddar, embalagem/guardanapo.
-- PENDENTE: cebola picadinha e picles picadinho (quantidade por lanche).

INSERT INTO ficha_tecnica (produto, insumo, qtd, unidade) VALUES
('hexa', 'Pão Brioche com Gergelim', 1, 'un'),
('hexa', 'Carne Angus', 1, 'un'),
('hexa', 'Queijo Cheddar', 2, 'un'),
('hexa', 'Sachê de Ketchup', 1, 'un'),
('hexa', 'Sachê de Mostarda', 1, 'un'),
('hexa', 'Papel Kraft', 1, 'un'),
('hexa', 'Papel Acoplado', 1, 'un'),
('hexa', 'Guardanapo', 1, 'un')
ON CONFLICT (produto, insumo) DO UPDATE SET qtd = EXCLUDED.qtd;

-- combo (alias "combo hexa c/ refri" ja aponta pra este nome canonico)
SELECT montar_combo('combo hexa c/refri + copo edição limitada', 'hexa', 'Guaraná Normal');
