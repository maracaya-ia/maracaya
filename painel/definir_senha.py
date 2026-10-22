"""Define (ou troca) a senha de um perfil. Uso, no servidor:
   docker exec -i painel python definir_senha.py <socio|gerente|cozinha> <senha>"""
import os
import sys

import psycopg2

from auth import PERFIS, hash_senha

if len(sys.argv) != 3 or sys.argv[1] not in PERFIS or len(sys.argv[2]) < 6:
    sys.exit("uso: definir_senha.py <socio|gerente|cozinha> <senha com 6+ caracteres>")
conn = psycopg2.connect(host=os.environ.get("PGHOST", "postgres"), dbname=os.environ.get("PGDATABASE", "operacao"),
                        user=os.environ.get("PGUSER", "alvaro"), password=os.environ.get("PGPASSWORD"))
with conn, conn.cursor() as cur:
    cur.execute("""INSERT INTO acessos (perfil, senha_hash) VALUES (%s, %s)
                   ON CONFLICT (perfil) DO UPDATE SET senha_hash = EXCLUDED.senha_hash, atualizado_em = now()""",
                (sys.argv[1], hash_senha(sys.argv[2])))
print("senha do perfil", sys.argv[1], "definida")
