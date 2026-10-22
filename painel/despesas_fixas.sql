-- despesas fixas por mes (aluguel, folha, contas) para fechar o lucro real no DRE da 2.0
CREATE TABLE IF NOT EXISTS despesas_fixas (
    id         serial PRIMARY KEY,
    mes        date NOT NULL,                 -- sempre o dia 1 do mes
    descricao  text NOT NULL,
    valor      numeric(12,2) NOT NULL CHECK (valor >= 0),
    criado_em  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (mes, descricao)
);
