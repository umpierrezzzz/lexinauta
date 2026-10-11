"""Réplica local de Supabase para probar la liga: PostgreSQL + PostgREST en Docker.

Uso:
    .venv-dev\\Scripts\\python tests\\liga_local.py arrancar   # crea los contenedores y carga servidor/liga.sql
    .venv-dev\\Scripts\\python tests\\liga_local.py parar      # los borra

Como en Supabase, existe el rol «anon» y la API acepta una clave (un JWT con role=anon) firmada con
JWT_SECRETO. La API queda en http://127.0.0.1:3009 (Supabase la sirve en <proyecto>/rest/v1).
"""
import base64
import hashlib
import hmac
import json
import subprocess
import sys
import time
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
RED, PG, REST = "lexinauta-red", "lexinauta-pg", "lexinauta-rest"
PUERTO_PG, PUERTO_REST = 15439, 3009
CLAVE_PG = "pruebas"
JWT_SECRETO = "secreto-de-pruebas-de-lexinauta-32-caracteres-o-mas"
DSN = f"postgresql://postgres:{CLAVE_PG}@127.0.0.1:{PUERTO_PG}/postgres"
URL_REST = f"http://127.0.0.1:{PUERTO_REST}"

ROLES = """
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticator') then
    create role authenticator login password 'pruebas' noinherit;
  end if;
end $$;
grant anon, authenticated to authenticator;
grant usage on schema public to anon, authenticated;
"""


def _b64(datos: bytes) -> str:
    return base64.urlsafe_b64encode(datos).rstrip(b"=").decode()


def clave_anon() -> str:
    """Un JWT HS256 con role=anon, como la «anon key» de Supabase."""
    cab = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    cuerpo = _b64(json.dumps({"role": "anon", "iss": "lexinauta-pruebas"}).encode())
    firma = hmac.new(JWT_SECRETO.encode(), f"{cab}.{cuerpo}".encode(), hashlib.sha256).digest()
    return f"{cab}.{cuerpo}.{_b64(firma)}"


def docker(*args, check=True):
    r = subprocess.run(["docker", *args], capture_output=True, text=True)
    if check and r.returncode:
        raise RuntimeError(f"docker {args[0]}: {r.stderr.strip()}")
    return r


def sql(texto: str):
    import psycopg
    with psycopg.connect(DSN, autocommit=True) as c:
        c.execute(texto)


def arrancar():
    parar()
    docker("network", "create", RED)
    docker("run", "-d", "--name", PG, "--network", RED, "-p", f"127.0.0.1:{PUERTO_PG}:5432",
           "-e", f"POSTGRES_PASSWORD={CLAVE_PG}", "postgres:16-alpine")
    import psycopg
    for _ in range(60):
        try:
            psycopg.connect(DSN).close()
            break
        except psycopg.OperationalError:
            time.sleep(0.5)
    sql(ROLES)
    sql((RAIZ / "servidor" / "liga.sql").read_text(encoding="utf-8"))
    docker("run", "-d", "--name", REST, "--network", RED, "-p", f"127.0.0.1:{PUERTO_REST}:3000",
           "-e", f"PGRST_DB_URI=postgresql://authenticator:pruebas@{PG}:5432/postgres",
           "-e", "PGRST_DB_SCHEMAS=public", "-e", "PGRST_DB_ANON_ROLE=anon",
           "-e", f"PGRST_JWT_SECRET={JWT_SECRETO}", "postgrest/postgrest:v12.2.3")
    import urllib.request
    for _ in range(60):
        try:
            urllib.request.urlopen(URL_REST + "/")
            break
        except Exception:
            time.sleep(0.5)


def recargar_sql():
    sql((RAIZ / "servidor" / "liga.sql").read_text(encoding="utf-8"))
    sql("notify pgrst, 'reload schema';")


def parar():
    docker("rm", "-f", REST, PG, check=False)
    docker("network", "rm", RED, check=False)


if __name__ == "__main__":
    {"arrancar": arrancar, "parar": parar, "recargar": recargar_sql}[sys.argv[1]]()
    print("ok")
