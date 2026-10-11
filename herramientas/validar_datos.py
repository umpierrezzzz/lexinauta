"""Valida datos/es.json y datos/en.json.

Uso:  python herramientas/validar_datos.py

Comprueba formato ("nombre|variante:rareza"), rarezas 1-5, ids únicos y respuestas repetidas
dentro de una categoría (con la misma normalización que el juego). Termina con código 1 si hay errores.
"""
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ARTICULOS = {"es": r"^(el|la|los|las|un|una|unos|unas|lo) ", "en": r"^(the|a|an|some) "}


def normalizar(texto: str, idioma: str) -> str:
    t = unicodedata.normalize("NFD", texto.lower())
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = re.sub(r"[^a-z0-9 ]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return re.sub(ARTICULOS[idioma], "", t)


def validar(idioma: str) -> tuple[list[str], list[str], dict]:
    datos = json.loads((RAIZ / "datos" / f"{idioma}.json").read_text(encoding="utf-8"))
    errores, avisos = [], []
    ids = Counter(c["id"] for c in datos["categorias"])
    errores += [f"id repetido: {i}" for i, n in ids.items() if n > 1]
    rarezas_total = Counter()
    for cat in datos["categorias"]:
        for campo in ("id", "nombre", "icono", "respuestas"):
            if campo not in cat:
                errores.append(f"{cat.get('id', '?')}: falta «{campo}»")
        vistas: dict[str, str] = {}
        rarezas = Counter()
        for linea in cat.get("respuestas", []):
            m = re.fullmatch(r"(.+):([1-5])", linea)
            if not m:
                errores.append(f"{cat['id']}: formato no válido «{linea}»")
                continue
            rarezas[int(m.group(2))] += 1
            for forma in m.group(1).split("|"):
                clave = normalizar(forma, idioma)
                if not clave:
                    errores.append(f"{cat['id']}: forma vacía en «{linea}»")
                elif clave in vistas and vistas[clave] != linea:
                    avisos.append(f"{cat['id']}: «{forma}» aparece dos veces ({vistas[clave]} / {linea})")
                else:
                    vistas[clave] = linea
        if sum(rarezas.values()) < 30:
            avisos.append(f"{cat['id']}: solo {sum(rarezas.values())} respuestas")
        for r in (1, 5):
            if not rarezas[r]:
                avisos.append(f"{cat['id']}: no tiene respuestas de rareza {r}")
        rarezas_total.update(rarezas)
    resumen = {"categorias": len(datos["categorias"]), "respuestas": sum(rarezas_total.values()),
               "por_rareza": dict(sorted(rarezas_total.items()))}
    return errores, avisos, resumen


if __name__ == "__main__":
    hay_errores = False
    for idioma in ("es", "en"):
        errores, avisos, resumen = validar(idioma)
        print(f"[{idioma}] {resumen}")
        for e in errores:
            print("  ERROR", e)
        for a in avisos:
            print("  aviso", a)
        hay_errores |= bool(errores)
    sys.exit(1 if hay_errores else 0)
