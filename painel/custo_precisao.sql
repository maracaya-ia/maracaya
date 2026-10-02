-- Custo por grama (ex: maionese R$ 39,49 / 1.100 g = R$ 0,0359/g) precisa de mais
-- que 2 casas decimais, senao arredonda pra R$ 0,04 e erra o CMV em ~11%.
ALTER TABLE insumo_custo ALTER COLUMN custo_unitario TYPE numeric(12,4);

-- Maionese Grill Defumado Pouch Junior 1,1 kg a R$ 39,49
INSERT INTO insumo_custo (insumo, custo_unitario, atualizado_em) VALUES ('Maionese Grill', 0.0359, now())
ON CONFLICT (insumo) DO UPDATE SET custo_unitario = EXCLUDED.custo_unitario, atualizado_em = EXCLUDED.atualizado_em;
