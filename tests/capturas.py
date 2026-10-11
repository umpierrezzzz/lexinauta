"""Juega partidas reales en Edge (Playwright) en todos los modos y guarda capturas de cada pantalla.

Uso (con el servidor en marcha: python -m http.server 8300):
    .venv-dev\\Scripts\\python tests\\capturas.py [es|en] [movil|escritorio] [escenario...]

Escenarios: diario, lluvia, maraton, local, reto, online (por defecto, todos).
"online" abre dos navegadores (anfitrión e invitado) y necesita internet para el servidor de PeerJS.
Las capturas quedan en tests/capturas/. Falla si la página tiene errores de JavaScript.
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "tests" / "capturas"
URL = "http://127.0.0.1:8300/"
PLAN = [5, 2, 4, 1, 3, 5, 4]   # rareza con la que contestar en cada etapa de la misión diaria
ESCENARIOS = ["diario", "lluvia", "maraton", "local", "reto", "online"]

# Los modos contrarreloj duran 60-90 s: en las pruebas su reloj corre más rápido.
RELOJ_RAPIDO = """(() => {
  const ahora = performance.now.bind(performance), t0 = ahora();
  performance.now = () => t0 + (ahora() - t0) * (window.__rapido || 1);
})();"""


def respuestas_por_nombre(idioma: str) -> dict:
    """nombre de categoría → {rareza: [respuestas]}"""
    datos = json.loads((RAIZ / "datos" / f"{idioma}.json").read_text(encoding="utf-8"))
    out = {}
    for c in datos["categorias"]:
        por_rareza: dict[int, list[str]] = {}
        for linea in c["respuestas"]:
            formas, rareza = linea.rsplit(":", 1)
            por_rareza.setdefault(int(rareza), []).append(formas.split("|")[0])
        out[c["nombre"]] = por_rareza
    return out


def elegir(opciones: dict, rareza: int, k: int = 0) -> str:
    r = rareza if rareza in opciones else max(opciones)
    lista = opciones[r]
    return lista[k % len(lista)]


class Partida:
    def __init__(self, pagina, idioma, pref):
        self.p = pagina
        self.resp = respuestas_por_nombre(idioma)
        self.pref = pref

    def foto(self, nombre, completa=False, espera=0):
        if espera:
            self.p.wait_for_timeout(espera)
        self.p.screenshot(path=SALIDA / f"{self.pref}-{nombre}.png", full_page=completa)

    def categoria(self):
        return self.resp[self.p.inner_text(".tarjeta .nombre-cat").strip()]

    def contestar(self, texto):
        self.p.fill(".tarjeta input", texto)
        self.p.press(".tarjeta input", "Enter")

    def inicio(self):
        self.p.goto(URL)
        self.p.wait_for_selector(".inicio")

    # ------------------------------------------------------------ escenarios

    def diario(self):
        self.p.goto(URL)
        self.p.wait_for_selector("#dialogo-ayuda[open]")
        self.foto("0-ayuda", espera=600)
        self.p.click("#cerrar-ayuda")
        self.foto("1-inicio", completa=True, espera=900)
        self.p.click("[data-jugar-diario]")
        self.p.wait_for_selector(".tarjeta input")
        self.foto("2-etapa", espera=1200)
        self.contestar("zzzzqqq")
        self.foto("3-fallo", espera=250)
        for i, rareza in enumerate(PLAN):
            self.contestar(elegir(self.categoria(), rareza))
            self.p.wait_for_selector(".resultado-etapa")
            if i in (0, 5):
                self.foto(f"4-acierto-{i + 1}", espera=300)
            if i == 4:
                self.foto("5-resultado-etapa", espera=1300)
            self.p.click("[data-seguir]")
            if i < len(PLAN) - 1:
                self.p.wait_for_selector(".tarjeta input")
        self.p.wait_for_selector(".final [data-total]")
        self.foto("6-final", completa=True, espera=2200)
        self.p.click("[data-volver]")
        self.p.wait_for_selector(".inicio")
        self.foto("7-inicio-tras-jugar", completa=True, espera=1500)

    def lluvia(self):
        self.inicio()
        self.p.click("[data-modo='lluvia']")
        self.p.wait_for_selector(".tarjeta input")
        opciones = self.categoria()
        for k, rareza in enumerate([1, 1, 2, 3, 5, 4, 2, 3]):
            self.contestar(elegir(opciones, rareza, k))
            self.p.wait_for_timeout(120)
        self.contestar(elegir(opciones, 1, 0))   # repetida
        self.foto("lluvia-1", espera=200)
        self.p.evaluate("window.__rapido = 8")
        self.p.wait_for_selector(".final", timeout=30000)
        self.foto("lluvia-2-final", completa=True, espera=1800)

    def maraton(self):
        self.inicio()
        self.p.click("[data-modo='maraton']")
        self.p.wait_for_selector(".tarjeta input")
        for rareza in [5, 3, 1, 4, 2]:
            self.contestar(elegir(self.categoria(), rareza))
            self.p.wait_for_timeout(250)
        self.foto("maraton-1", espera=100)
        self.p.click("[data-saltar]")
        self.p.evaluate("window.__rapido = 10")
        self.p.wait_for_selector(".final", timeout=30000)
        self.foto("maraton-2-final", completa=True, espera=1800)

    def local(self):
        self.inicio()
        self.p.click("[data-modo='local']")
        self.p.wait_for_selector("[data-empezar]")
        self.p.click("[data-anadir]")
        self.foto("local-1-pilotos", espera=400)
        self.p.click("[data-empezar]")
        rondas = 0
        while True:
            self.p.wait_for_selector(".turno, .podio")
            if self.p.query_selector(".podio"):
                break
            for j in range(3):
                self.p.wait_for_selector(".turno")
                if rondas == 0 and j == 0:
                    self.foto("local-2-turno", espera=400)
                self.p.click(".turno [data-seguir]")
                self.p.wait_for_selector(".tarjeta input")
                opciones = self.categoria()
                # Los pilotos 1 y 2 chocan en la primera etapa
                texto = elegir(opciones, 2) if (rondas == 0 and j < 2) else elegir(opciones, [1, 3, 5][j], rondas)
                self.contestar(texto)
            self.p.wait_for_selector(".tabla-etapa")
            if rondas == 0:
                self.foto("local-3-etapa", completa=True, espera=1200)
            rondas += 1
            self.p.click("[data-seguir]")
        self.foto("local-4-podio", completa=True, espera=1500)

    def reto(self):
        self.inicio()
        # Una partida de entrenamiento para generar el enlace
        self.p.click("[data-modo='practica']")
        for i in range(7):
            self.p.wait_for_selector(".tarjeta input")
            self.contestar(elegir(self.categoria(), [3, 1, 2, 4, 2, 1, 3][i]))
            self.p.wait_for_selector(".resultado-etapa")
            self.p.click("[data-seguir]")
        self.p.wait_for_selector("[data-retar]")
        self.foto("practica-final", completa=True, espera=1500)
        self.p.evaluate("navigator.clipboard.writeText = async (t) => { window.__copiado = t; }")
        self.p.click("[data-retar]")
        self.p.wait_for_timeout(300)
        texto = self.p.evaluate("window.__copiado")
        enlace = texto.strip().splitlines()[-1]
        assert "?reto=" in enlace, texto
        self.p.goto(enlace)
        self.p.wait_for_selector("[data-aceptar]")
        self.foto("reto-1-intro", completa=True, espera=900)
        self.p.click("[data-aceptar]")
        for i in range(7):
            self.p.wait_for_selector(".tarjeta input")
            self.contestar(elegir(self.categoria(), [4, 2, 2, 3, 5, 1, 2][i]))
            self.p.wait_for_selector(".resultado-etapa")
            if i == 0:
                self.foto("reto-2-etapa", espera=900)
            self.p.click("[data-seguir]")
        self.p.wait_for_selector(".veredicto")
        self.foto("reto-3-final", completa=True, espera=1800)


def online(navegador, nuevo_contexto, idioma, pref, errores):
    """Dos pilotos en contextos separados: el anfitrión crea la sala y el invitado se une con el enlace."""
    paginas = []
    for quien in ("anfitrion", "invitado"):
        ctx = nuevo_contexto()
        ctx.add_init_script(f"localStorage.setItem('hp_nombre', JSON.stringify('{'Ana' if quien == 'anfitrion' else 'Leo'}'));")
        pg = ctx.new_page()
        pg.on("pageerror", lambda e, q=quien: errores.append(f"online/{q} pageerror: {e}"))
        pg.on("console", lambda m, q=quien: errores.append(f"online/{q} console.{m.type}: {m.text}")
              if m.type == "error" else None)
        paginas.append(Partida(pg, idioma, f"{pref}-online-{quien}"))
    ana, leo = paginas
    ana.inicio()
    ana.p.click("[data-modo='online']")
    ana.p.wait_for_selector("[data-crear]")
    ana.foto("1-entrada", espera=400)
    ana.p.click("[data-crear]")
    ana.p.wait_for_selector("[data-codigo-sala]", timeout=20000)
    codigo = ana.p.inner_text("[data-codigo-sala]").strip()
    leo.p.goto(f"{URL}?sala={codigo}")
    leo.p.wait_for_selector("[data-codigo]")
    leo.p.click("[data-unirse] button")
    leo.p.wait_for_selector("[data-codigo-sala]", timeout=20000)
    ana.p.wait_for_selector("[data-empezar]:not([disabled])", timeout=20000)
    ana.foto("2-sala", espera=500)
    leo.foto("2-sala", espera=100)
    ana.p.click("[data-empezar]")
    for r in range(7):
        for k, jugador in enumerate((ana, leo)):
            jugador.p.wait_for_selector(".tarjeta input", timeout=15000)
            opciones = jugador.categoria()
            # En la primera etapa los dos dicen lo mismo: choque
            jugador.contestar(elegir(opciones, 2) if r == 0 else elegir(opciones, [3, 1][k] + r % 3, r))
            if r == 0 and k == 0:
                jugador.p.wait_for_selector("[data-respondidos]")
                jugador.foto("3-esperando", espera=400)
        ana.p.wait_for_selector(".tabla-etapa", timeout=15000)
        leo.p.wait_for_selector(".tabla-etapa", timeout=15000)
        if r == 0:
            ana.foto("4-etapa", espera=900)
            leo.foto("4-etapa", espera=100)
        ana.p.click("[data-seguir]")
    ana.p.wait_for_selector(".podio", timeout=15000)
    leo.p.wait_for_selector(".podio", timeout=15000)
    ana.foto("5-podio", completa=True, espera=1500)
    leo.foto("5-podio", completa=True)
    ana.p.click("[data-otra]")
    leo.p.wait_for_selector("[data-codigo-sala]", timeout=15000)
    for jugador in paginas:
        jugador.p.context.close()


def jugar(idioma: str, dispositivo: str, escenarios: list[str]) -> list[str]:
    SALIDA.mkdir(parents=True, exist_ok=True)
    errores: list[str] = []
    with sync_playwright() as pw:
        navegador = pw.chromium.launch(channel="msedge")
        def nuevo_contexto(ayuda_vista=True):
            if dispositivo == "movil":
                ctx = navegador.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                            is_mobile=True, has_touch=True, locale=f"{idioma}-ES")
            else:
                ctx = navegador.new_context(viewport={"width": 1366, "height": 860}, locale=f"{idioma}-ES")
            ctx.add_init_script(f"localStorage.setItem('hp_idioma', JSON.stringify('{idioma}'));"
                                + ("localStorage.setItem('hp_ayuda_vista', 'true');" if ayuda_vista else "")
                                + RELOJ_RAPIDO)
            return ctx

        for esc in escenarios:
            if esc == "online":
                online(navegador, nuevo_contexto, idioma, f"{idioma}-{dispositivo}", errores)
                continue
            ctx = nuevo_contexto(ayuda_vista=esc != "diario")
            pagina = ctx.new_page()
            pagina.on("pageerror", lambda e, esc=esc: errores.append(f"{esc} pageerror: {e}"))
            pagina.on("console", lambda m, esc=esc: errores.append(f"{esc} console.{m.type}: {m.text}")
                      if m.type == "error" else None)
            getattr(Partida(pagina, idioma, f"{idioma}-{dispositivo}"), esc)()
            ctx.close()
        navegador.close()
    return errores


if __name__ == "__main__":
    idiomas = [sys.argv[1]] if len(sys.argv) > 1 else ["es", "en"]
    dispositivos = [sys.argv[2]] if len(sys.argv) > 2 else ["movil", "escritorio"]
    escenarios = sys.argv[3:] or ESCENARIOS
    hubo = False
    for idioma in idiomas:
        for d in dispositivos:
            errores = jugar(idioma, d, escenarios)
            print(f"{idioma}/{d}: {'OK' if not errores else 'ERRORES'}")
            for e in errores:
                print("   ", e)
            hubo |= bool(errores)
    sys.exit(1 if hubo else 0)
