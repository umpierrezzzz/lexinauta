"""Tests del motor (js/motor.js), ejecutados en Edge con el mismo código que usa el juego.

Uso (con el servidor en marcha en el puerto 8300):  .venv-dev\\Scripts\\python tests\\test_motor.py
"""
import json
import sys

from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8300/"

PRUEBAS = r"""
async () => {
  const m = await import("/js/motor.js");
  const es = await (await fetch("/datos/es.json")).json();
  const en = await (await fetch("/datos/en.json")).json();
  const cat = (d, id, idioma) => m.prepararCategoria(d.categorias.find((c) => c.id === id), idioma);
  const quesos = cat(es, "quesos", "es"), frutas = cat(es, "frutas", "es"), cheeses = cat(en, "quesos", "en");
  const fallos = [];
  const ok = (cond, msg) => { if (!cond) fallos.push(msg); };
  const nombre = (c, t) => { const r = m.buscar(c, t); return r ? r.respuesta.nombre : null; };

  ok(m.normalizar("El Taleggio", "es") === "taleggio", "normalizar artículo y mayúsculas");
  ok(m.normalizar("Ñandú", "es") === "nandu", "normalizar tildes y ñ");
  ok(m.normalizar("The Big Dipper", "en") === "big dipper", "normalizar artículo inglés");

  ok(nombre(quesos, "taleggio") === "taleggio", "respuesta exacta");
  ok(nombre(quesos, "TALEGGIO") === "taleggio", "mayúsculas");
  ok(nombre(quesos, "el manchego") === "manchego", "con artículo");
  ok(nombre(quesos, "taleggo") === "taleggio", "errata de una letra");
  ok(nombre(quesos, "tallegio") === null, "dos erratas en palabra de 8 letras: no vale");
  ok(nombre(frutas, "fresas") === "fresa", "plural -s");
  ok(nombre(frutas, "melocotones") === "melocotón", "plural -es y tilde en el nombre mostrado");
  ok(nombre(frutas, "platano") === "plátano", "sin tilde vale");
  ok(nombre(frutas, "banana") === "plátano", "sinónimo");
  ok(nombre(quesos, "zzzz") === null, "respuesta inventada");
  ok(nombre(quesos, "") === null, "vacía");
  ok(nombre(frutas, "pira") === null, "palabras cortas sin erratas");
  ok(nombre(cheeses, "cheddars") === "cheddar", "plural inglés");
  ok(nombre(cat(en, "frutas", "en"), "cherries") === "cherry", "plural inglés -ies");

  const r = m.buscar(quesos, "taleggio").respuesta;
  ok(r.rareza === 5 && r.puntos === 85, "rareza y puntos");
  ok(m.ejemplos(quesos, 3).every((e) => e.rareza === 5), "ejemplos: los más raros primero");

  const ids = es.categorias.map((c) => c.id);
  const d1 = m.categoriasDelDia(ids, 1), d1b = m.categoriasDelDia(ids, 1), d2 = m.categoriasDelDia(ids, 2);
  ok(JSON.stringify(d1) === JSON.stringify(d1b), "el reto diario es determinista");
  ok(new Set(d1).size === 7, "7 categorías distintas");
  ok(d1.every((id) => !d2.includes(id)), "días seguidos no repiten categorías dentro del ciclo");
  let todas = new Set();
  for (let d = 1; d <= Math.floor(ids.length / 7); d++) m.categoriasDelDia(ids, d).forEach((x) => todas.add(x));
  ok(todas.size === Math.floor(ids.length / 7) * 7, "un ciclo recorre categorías sin repetir");
  for (let d = 1; d < 400; d++) if (new Set(m.categoriasDelDia(ids, d)).size !== 7) { fallos.push("día " + d + " con repetidas"); break; }

  ok(m.numeroDeDia(new Date(2026, 9, 11)) === 1, "lanzamiento #1 el 11/10/2026");
  ok(m.destinoDelDia(0).id === "tierra" && m.destinoDelDia(59).id === "orbita" && m.destinoDelDia(60).id === "luna", "destinos del día");
  ok(m.destinoDelDia(595).id === "kuiper", "máximo: Kuiper");
  const v = m.estadoViaje(2250);   // 225 millones de km
  ok(v.alcanzado.id === "marte" && v.siguiente.id === "asteroides", "viaje acumulado");
  ok(m.distancia("taleggio", "tallegio") === 2 || m.distancia("taleggio", "tallegio") <= 2, "distancia de edición");

  // Categorías por semilla: reproducibles y sin repetir
  const a = m.categoriasPorSemilla(ids, 12345), b = m.categoriasPorSemilla(ids, 12345);
  ok(JSON.stringify(a) === JSON.stringify(b) && new Set(a).size === 7, "categorías por semilla");
  ok(JSON.stringify(a) !== JSON.stringify(m.categoriasPorSemilla(ids, 54321)), "otra semilla, otras categorías");

  // Choques: misma respuesta, mitad de puntos (redondeando hacia arriba); sin respuesta no choca
  const ch = m.resolverChoques({
    a: { respuesta: "avena", puntos: 35 }, b: { respuesta: "avena", puntos: 35 },
    c: { respuesta: "teff", puntos: 85 }, d: { respuesta: null, puntos: 0 }, e: { respuesta: null, puntos: 0 },
  });
  ok(ch.a.choque && ch.b.choque && ch.a.puntos === 18, "choque: mitad redondeada");
  ok(!ch.c.choque && ch.c.puntos === 85, "sin choque: puntos completos");
  ok(!ch.d.choque && !ch.e.choque, "dos sin respuesta no chocan");

  // Retos por enlace: ida y vuelta, con tildes y nombres raros
  const reto = { idioma: "es", categorias: a, nombre: "Dani Ñ «x»",
    resultados: a.map((_, k) => ({ respuesta: k % 2 ? "plátano" : null, rareza: k % 6, puntos: m.PUNTOS[k % 6] })) };
  const cod = m.codificarReto(reto);
  ok(/^[A-Za-z0-9_-]+$/.test(cod), "código de reto apto para URL");
  const vuelta = m.decodificarReto(cod);
  ok(vuelta && vuelta.nombre === reto.nombre && JSON.stringify(vuelta.categorias) === JSON.stringify(a), "reto: ida y vuelta");
  ok(vuelta && vuelta.resultados[1].respuesta === "plátano" && vuelta.resultados[0].respuesta === null, "reto: respuestas");
  ok(m.decodificarReto("basura!!") === null && m.decodificarReto("") === null, "reto inválido");

  // Todas las categorías se preparan y ninguna respuesta queda inaccesible por su propio nombre
  for (const [datos, idioma] of [[es, "es"], [en, "en"]]) {
    for (const c of datos.categorias) {
      const p = m.prepararCategoria(c, idioma);
      for (const resp of p.respuestas) {
        const h = m.buscar(p, resp.nombre);
        if (!h) { fallos.push(`${idioma}/${c.id}: «${resp.nombre}» no se encuentra`); }
      }
    }
  }
  return fallos;
}
"""

if __name__ == "__main__":
    with sync_playwright() as p:
        navegador = p.chromium.launch(channel="msedge")
        pagina = navegador.new_page()
        pagina.goto(URL)
        fallos = pagina.evaluate(PRUEBAS)
        navegador.close()
    if fallos:
        print(f"{len(fallos)} FALLOS:")
        for f in fallos[:50]:
            print("  -", f)
        sys.exit(1)
    print("motor: todas las pruebas OK")
