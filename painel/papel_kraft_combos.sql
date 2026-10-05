-- Papel kraft: os combos de varios lanches vao em UM papel kraft so (antes 2 ou 4).
-- Papel acoplado e guardanapo continuam por lanche.
UPDATE ficha_tecnica SET qtd = 1
WHERE insumo = 'Papel Kraft'
  AND produto IN ('amor feroz', 'combo amor feroz', 'combo pai selvagem + brinde', 'combo pai e filho + brinde');
