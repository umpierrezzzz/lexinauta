"""Tests de la liga (servidor/liga.sql) contra la réplica local de Supabase.

Uso:  .venv-dev\\Scripts\\python tests\\test_liga.py      (arranca y para los contenedores de Docker)
"""
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import liga_local  # noqa: E402
import psycopg  # noqa: E402

fallos: list[str] = []


def ok(cond, msg):
    if not cond:
        fallos.append(msg)


def error_de(c, consulta, args):
    try:
        with c.transaction():
            c.execute(consulta, args)
        return None
    except psycopg.Error as e:
        return str(e)


def main():
    liga_local.arrancar()
    try:
        with psycopg.connect(liga_local.DSN, autocommit=True) as c:
            def q(consulta, args=()):
                cur = c.execute(consulta, args)
                return cur.fetchall() if cur.description else []

            # ---------------------------------------------------------- alta y validaciones
            s1 = uuid.uuid4()
            e = q("select liga_registrar(%s, %s)", (s1, "  Dani con un alias larguísimo  "))[0][0]
            ok(e["alias"] == "Dani con un alia" and e["division"] == 0 and e["grupo"] is None, "registro y alias recortado")
            e = q("select liga_enviar(%s, current_date, 300, 'saturno')", (s1,))[0][0]
            ok(e["grupo"][0]["puntos"] == 300 and e["grupo"][0]["modelo"] == "saturno", "enviar partida")
            q("select liga_enviar(%s, current_date, 500)", (s1,))
            e = q("select liga_estado(%s)", (s1,))[0][0]
            ok(e["grupo"][0]["puntos"] == 300, "la primera partida del día es la que vale")
            ok(error_de(c, "select liga_enviar(%s, current_date, 600)", (s1,)) is not None, "más de 595 puntos: rechazado")
            ok(error_de(c, "select liga_enviar(%s, current_date - 5, 100)", (s1,)) is not None, "fecha antigua: rechazada")
            ok(error_de(c, "select liga_enviar(%s, current_date, 100)", (uuid.uuid4(),)) is not None, "jugador desconocido")
            ok(q("select liga_estado(%s)", (uuid.uuid4(),))[0][0] is None, "estado de un desconocido: nulo")

            # El rol anon solo puede usar las funciones públicas
            c.execute("set role anon")
            ok(error_de(c, "select * from liga_jugadores", ()) is not None, "anon no lee tablas")
            ok(error_de(c, "select liga_asignar(1, current_date)", ()) is not None, "anon no llama a liga_asignar")
            ok(error_de(c, "select liga_estado(%s)", (s1,)) is None, "anon sí llama a liga_estado")
            c.execute("reset role")

            # ---------------------------------------------------------- ascensos y descensos
            q("truncate liga_jugadores, liga_partidas, liga_grupos, liga_miembros restart identity cascade")
            s1, s2, s3 = "2026-09-28", "2026-10-05", "2026-10-12"   # tres lunes seguidos
            ids = []
            for k in range(12):
                q("select liga_registrar(%s, %s)", (uuid.uuid4(), f"P{k:02d}"))
            ids = [r[0] for r in q("select id from liga_jugadores order by id")]

            def semana(lunes, puntos_por_jugador):
                for j, p in zip(ids, puntos_por_jugador):
                    q("select liga_asignar(%s, %s::date)", (j, lunes))
                    if p is not None:
                        q("insert into liga_partidas values (%s, %s::date, %s)", (j, lunes, p))

            semana(s1, [100 + k * 10 for k in range(12)])            # P11 el mejor ... P00 el peor
            ok(q("select count(distinct grupo) from liga_miembros where semana = %s", (s1,))[0][0] == 1, "12 jugadores: un grupo")
            semana(s2, [100] * 12)
            div = dict(q("select id, division from liga_jugadores"))
            ok([div[j] for j in ids[7:]] == [1] * 5, "los 5 primeros suben")
            ok([div[j] for j in ids[:7]] == [0] * 7, "el resto sigue en la primera división (no se puede bajar más)")
            ok(q("select count(distinct grupo) from liga_miembros where semana = %s", (s2,))[0][0] == 2, "semana 2: dos divisiones, dos grupos")

            # Semana 2 en la división 1: P07 gana, P11 queda último
            for j, p in zip(ids[7:], [500, 400, 300, 200, 50]):
                q("update liga_partidas set puntos = %s where jugador = %s and fecha = %s::date", (p, j, s2))
            for j in ids:
                q("select liga_asignar(%s, %s::date)", (j, s3))
            div = dict(q("select id, division from liga_jugadores"))
            cambio = dict(q("select id, cambio from liga_jugadores"))
            ok(div[ids[7]] == 2 and cambio[ids[7]] == 1, "el primero del grupo de 5 sube otra vez")
            ok(div[ids[11]] == 0 and cambio[ids[11]] == -1, "el último del grupo de 5 baja")

            # Quien no juega una semana no entra en la liga, y conserva su división
            antes = div[ids[8]]
            q("delete from liga_miembros where jugador = %s and semana = %s::date", (ids[8], s3))
            q("select liga_asignar(%s, %s::date)", (ids[8], "2026-10-26"))   # vuelve dos semanas después
            ok(dict(q("select id, division from liga_jugadores"))[ids[8]] >= antes, "volver tras no jugar no castiga")

            # ---------------------------------------------------------- grupos de 30
            q("truncate liga_jugadores, liga_partidas, liga_grupos, liga_miembros restart identity cascade")
            for k in range(65):
                q("select liga_registrar(%s, %s)", (uuid.uuid4(), f"J{k}"))
            for (j,) in q("select id from liga_jugadores"):
                q("select liga_asignar(%s, %s::date)", (j, s1))
            tam = [r[0] for r in q("select count(*) from liga_miembros group by grupo order by grupo")]
            ok(tam == [30, 30, 5], f"grupos de hasta 30: {tam}")
            ok(q("select liga_tamano_zona(1, true), liga_tamano_zona(4, false), liga_tamano_zona(30, false)")[0] == (1, 0, 5),
               "tamaño de las zonas")
    finally:
        liga_local.parar()

    if fallos:
        print(f"{len(fallos)} FALLOS:")
        for f in fallos:
            print("  -", f)
        sys.exit(1)
    print("liga: todas las pruebas OK")


if __name__ == "__main__":
    main()
