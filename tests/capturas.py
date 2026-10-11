"""Juega partidas reales en Edge (Playwright) y guarda capturas de cada pantalla.

Uso (con el servidor en marcha: python -m http.server 8300):
    .venv-dev\\Scripts\\python tests\\capturas.py [es|en] [movil|escritorio]

Las capturas quedan en tests/capturas/. Falla si la página tiene errores de JavaScript.
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "tests" / "capturas"
URL = "http://127.0.0.1:8300/"
# Rareza con la que contestar en cada etapa (0 = dejar que se acabe el tiempo... demasiado lento: se usa 1).
PLAN = [5, 2, 4, 1, 3, 5, 4]


def respuestas_por_nombre(idioma: str) -> dict:
    datos = json.loads((RAIZ / "datos" / f"{idioma}.json").read_text(encoding="utf-8"))
    out = {}
    for c in datos["categorias"]:
        por_rareza = {}
        for linea in c["respuestas"]:
            formas, rareza = linea.rsplit(":", 1)
            por_rareza.setdefault(int(rareza), formas.split("|")[0])
        out[c["nombre"]] = por_rareza
    return out


def jugar(idioma: str, dispositivo: str) -> list[str]:
    SALIDA.mkdir(parents=True, exist_ok=True)
    resp = respuestas_por_nombre(idioma)
    errores: list[str] = []
    pref = f"{idioma}-{dispositivo}"
    with sync_playwright() as p:
        navegador = p.chromium.launch(channel="msedge")
        if dispositivo == "movil":
            ctx = navegador.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                        is_mobile=True, has_touch=True, locale=f"{idioma}-ES")
        else:
            ctx = navegador.new_context(viewport={"width": 1366, "height": 860}, locale=f"{idioma}-ES")
        ctx.add_init_script(f"localStorage.setItem('hp_idioma', JSON.stringify('{idioma}'))")
        pagina = ctx.new_page()
        pagina.on("pageerror", lambda e: errores.append(f"pageerror: {e}"))
        pagina.on("console", lambda m: errores.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)

        pagina.goto(URL)
        pagina.wait_for_selector("#dialogo-ayuda[open]")
        pagina.wait_for_timeout(700)
        pagina.screenshot(path=SALIDA / f"{pref}-0-ayuda.png")
        pagina.click("[data-accion='cerrar-ayuda']")
        pagina.wait_for_timeout(900)
        pagina.screenshot(path=SALIDA / f"{pref}-1-inicio.png", full_page=True)

        pagina.click("[data-accion='jugar']")
        pagina.wait_for_selector("#tarjeta:not([hidden])")
        pagina.wait_for_timeout(1500)
        pagina.screenshot(path=SALIDA / f"{pref}-2-etapa.png")

        # Un fallo a propósito
        pagina.fill("#respuesta", "zzzzqqq")
        pagina.press("#respuesta", "Enter")
        pagina.wait_for_timeout(250)
        pagina.screenshot(path=SALIDA / f"{pref}-3-fallo.png")

        for i, rareza in enumerate(PLAN):
            nombre = pagina.inner_text("#categoria-nombre")
            opciones = resp[nombre]
            r = rareza if rareza in opciones else max(opciones)
            pagina.fill("#respuesta", opciones[r])
            pagina.press("#respuesta", "Enter")
            pagina.wait_for_selector("#resultado-etapa:not([hidden])")
            if i in (0, 3):
                pagina.wait_for_timeout(350)
                pagina.screenshot(path=SALIDA / f"{pref}-4-acierto-{i + 1}.png")
            pagina.wait_for_timeout(1100)
            if i == 0:
                pagina.screenshot(path=SALIDA / f"{pref}-5-resultado-etapa.png")
            pagina.click("#boton-siguiente")
            if i < len(PLAN) - 1:
                pagina.wait_for_selector("#tarjeta:not([hidden])")
                pagina.wait_for_timeout(300)
            if i == 4:
                pagina.wait_for_timeout(700)
                pagina.screenshot(path=SALIDA / f"{pref}-6-etapa-5.png")

        pagina.wait_for_selector("#p-resultado:not([hidden])")
        pagina.wait_for_timeout(2000)
        pagina.screenshot(path=SALIDA / f"{pref}-7-final.png", full_page=True)
        pagina.click("#boton-otra")
        pagina.wait_for_timeout(1600)
        pagina.screenshot(path=SALIDA / f"{pref}-8-inicio-tras-jugar.png", full_page=True)
        navegador.close()
    return errores


if __name__ == "__main__":
    idiomas = [sys.argv[1]] if len(sys.argv) > 1 else ["es", "en"]
    dispositivos = [sys.argv[2]] if len(sys.argv) > 2 else ["movil", "escritorio"]
    hubo = False
    for idioma in idiomas:
        for d in dispositivos:
            errores = jugar(idioma, d)
            print(f"{idioma}/{d}: {'OK' if not errores else 'ERRORES'}")
            for e in errores:
                print("   ", e)
            hubo |= bool(errores)
    sys.exit(1 if hubo else 0)
