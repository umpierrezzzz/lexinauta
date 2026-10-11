"""Pule cómo se MUESTRAN las respuestas: tildes, ñ, mayúsculas de nombres propios y siglas.

Uso:  python herramientas/pulir_nombres.py

Para cada respuesta calcula un nombre bonito y lo pone como primera forma; la forma antigua se queda
como variante (así sigue siendo válida al escribirla). Es idempotente: se puede ejecutar varias veces.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tildes_es import FRASES, PALABRAS  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent

# Categorías cuyas respuestas son nombres propios: van en formato título.
PROPIAS = {
    "es": {"paises_europa", "paises_africa", "paises_america", "paises_asia", "capitales", "ciudades_espana",
           "rios", "constelaciones", "marcas_coches", "mitologia", "pintores", "escritores", "misiones_espaciales",
           "cientificos", "islas", "montanas", "mares", "cocteles"},
    "en": {"paises_europa", "paises_africa", "paises_america", "paises_asia", "capitales", "estados_eeuu", "rios",
           "constelaciones", "marcas_coches", "mitologia", "pintores", "escritores", "misiones_espaciales",
           "cientificos", "islas", "montanas", "mares", "cocteles", "idiomas", "razas_perro", "juegos_mesa"},
}
# Dentro de «Algo que hay en el espacio», estos sí son nombres propios.
ESPACIO_PROPIOS = {
    "marte", "saturno", "jupiter", "venus", "mercurio", "neptuno", "urano", "pluton", "via lactea", "andromeda",
    "titan", "europa", "io", "ganimedes", "fobos", "ceres", "eris", "deimos", "encelado", "calisto", "triton",
    "caronte", "proxima centauri", "betelgeuse", "sirio", "voyager", "james webb", "haumea", "makemake", "sedna",
    "cinturon de kuiper", "nube de oort", "hubble", "polaris",
    "mars", "saturn", "jupiter", "mercury", "neptune", "uranus", "pluto", "milky way", "ganymede", "phobos",
    "enceladus", "callisto", "charon", "sirius", "kuiper belt", "oort cloud",
}
MINUSCULAS = {"es": {"de", "del", "la", "las", "los", "el", "y", "e", "en", "al", "da", "do", "des", "von", "van",
                     "der", "di", "le", "les", "o", "sur", "con"},
              "en": {"of", "the", "and", "a", "an", "in", "on", "de", "du", "da", "von", "van", "der", "la", "le",
                     "di", "y", "to", "with", "et"}}
SIGLAS = {"iss", "eeuu", "usa", "us", "uk", "uae", "drc", "jwst", "bmw", "byd", "vw", "gmc", "mg", "ds", "tvr",
          "k2", "rv", "atv", "ac", "tv", "pvc", "mdf", "dart", "tess", "juice", "osiris", "kfc", "dc", "nyx", "ii",
          "iii", "lng", "a1"}

# Correcciones exactas (clave = forma normalizada).
EXACTAS = {
    "en": {
        "jk rowling": "J.K. Rowling", "jrr tolkien": "J.R.R. Tolkien", "cs lewis": "C.S. Lewis",
        "hg wells": "H.G. Wells", "ts eliot": "T.S. Eliot", "jd salinger": "J.D. Salinger",
        "f scott fitzgerald": "F. Scott Fitzgerald", "jrr martin": "George R.R. Martin", "dr seuss": "Dr. Seuss",
        "o keeffe": "O'Keeffe", "georgia o keeffe": "Georgia O'Keeffe", "st helens": "St. Helens",
        "mount st helens": "Mount St. Helens", "martha s vineyard": "Martha's Vineyard", "pimm s cup": "Pimm's Cup",
        "dark n stormy": "Dark 'n' Stormy", "s mores": "S'mores", "shepherd s pie": "Shepherd's Pie",
        "tiger s eye": "Tiger's Eye", "st elmo s fire": "St. Elmo's Fire", "nor easter": "Nor'easter",
        "neil degrasse tyson": "Neil deGrasse Tyson", "ian mckewan": "Ian McEwan", "jj thomson": "J.J. Thomson",
        "mclaren": "McLaren", "b52": "B-52", "chang e": "Chang'e", "cote d ivoire": "Côte d'Ivoire",
        "ivory coast": "Ivory Coast", "t shirt": "T-shirt", "go fish": "Go Fish", "o keefe": "O'Keeffe",
        "full english": "full English breakfast", "sunday roast": "Sunday roast", "osiris rex": "OSIRIS-REx",
        "dungeons and dragons": "Dungeons & Dragons", "7 wonders": "7 Wonders", "time s up": "Time's Up",
        "game of life": "The Game of Life", "uno": "UNO", "d and d": "D&D", "cuba libre": "Cuba Libre",
        "irn bru": "Irn-Bru", "jell o": "Jell-O", "tyrannosaurus": "Tyrannosaurus", "t rex": "T. rex",
        "bubble tea": "bubble tea", "mac and cheese": "mac and cheese", "creme brulee": "crème brûlée",
        "chicken tikka masala": "chicken tikka masala", "fish and chips": "fish and chips",
    },
    "es": {"chang e": "Chang'e", "osiris rex": "OSIRIS-REx", "b 52": "B-52", "conecta 4": "Conecta 4",
           "uno": "UNO", "f1": "Fórmula 1", "ammán": "Ammán", "dungeons and dragons": "Dungeons & Dragons",
           "7 wonders": "7 Wonders", "virus": "Virus!"},
}


def normalizar(texto: str, idioma: str) -> str:
    t = unicodedata.normalize("NFD", texto.lower())
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = re.sub(r"[^a-z0-9 ]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return re.sub(r"^(el|la|los|las|un|una|unos|unas|lo) " if idioma == "es" else r"^(the|a|an|some) ", "", t)


def con_tildes(texto: str) -> str:
    base = texto.strip()
    if base.lower() in FRASES:
        return FRASES[base.lower()]

    def palabra(m: re.Match) -> str:
        w = m.group(0)
        nueva = PALABRAS.get(w.lower())
        if not nueva:
            return w
        # respeta la mayúscula inicial si ya la tenía
        return nueva[0].upper() + nueva[1:] if w[0].isupper() else nueva
    return re.sub(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+", palabra, base)


def titulo(texto: str, idioma: str) -> str:
    palabras = texto.split(" ")
    salida = []
    for i, w in enumerate(palabras):
        lw = w.lower()
        if lw in SIGLAS:
            salida.append(w.upper())
        elif i > 0 and lw in MINUSCULAS[idioma]:
            salida.append(lw)
        elif w[:1].islower():
            # guiones: cada parte con mayúscula ("Coca-Cola")
            salida.append("-".join(p[:1].upper() + p[1:] for p in w.split("-")))
        else:
            salida.append(w)
    return " ".join(salida)


def pulir(nombre: str, categoria: str, idioma: str) -> str:
    clave = normalizar(nombre, idioma)
    if clave in EXACTAS[idioma]:
        return EXACTAS[idioma][clave]
    t = con_tildes(nombre) if idioma == "es" else nombre.strip()
    if categoria in PROPIAS[idioma] or (categoria == "espacio" and clave in ESPACIO_PROPIOS):
        t = titulo(t, idioma)
    else:
        # siglas también en categorías comunes (TV, PVC...)
        t = " ".join(w.upper() if w.lower() in SIGLAS else w for w in t.split(" "))
    return t


def procesar(idioma: str) -> int:
    ruta = RAIZ / "datos" / f"{idioma}.json"
    datos = json.loads(ruta.read_text(encoding="utf-8"))
    cambios = 0
    for cat in datos["categorias"]:
        nuevas = []
        for linea in cat["respuestas"]:
            formas_txt, rareza = linea.rsplit(":", 1)
            formas = [f.strip() for f in formas_txt.split("|") if f.strip()]
            bonito = pulir(formas[0], cat["id"], idioma)
            if bonito != formas[0]:
                cambios += 1
                vistas = {normalizar(bonito, idioma)}
                resto = []
                for f in formas:
                    n = normalizar(f, idioma)
                    if n not in vistas:
                        vistas.add(n)
                        resto.append(f)
                formas = [bonito] + resto
            nuevas.append("|".join(formas) + ":" + rareza)
        cat["respuestas"] = nuevas
    lineas = [json.dumps(c, ensure_ascii=False) for c in datos["categorias"]]
    ruta.write_text('{\n  "idioma": "%s",\n  "categorias": [\n    %s\n  ]\n}\n' % (idioma, ",\n    ".join(lineas)),
                    encoding="utf-8")
    return cambios


if __name__ == "__main__":
    for idioma in ("es", "en"):
        print(idioma, "nombres pulidos:", procesar(idioma))
