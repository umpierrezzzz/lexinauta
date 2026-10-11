# Lexinauta · Lexinaut 🚀

Juego diario de palabras, en español y en inglés: cada día, 7 categorías iguales para todo el mundo
(«Un queso», «Una constelación»…). Escribe algo que encaje antes de que se acabe el combustible:
**cuanto más rara tu respuesta, más lejos llega tu cohete**. Luna, Marte, Júpiter… ¿hasta Plutón?

## Jugar

Doble clic en **`jugar.bat`** (abre <http://127.0.0.1:8300>). Hace falta servirlo por http
(no funciona abriendo `index.html` directamente, porque carga los datos con `fetch`).

## Modos

- **Misión diaria**: 7 categorías iguales para todo el mundo, un intento al día (se retoma si se cierra a medias).
- **Lluvia de meteoritos**: una categoría y 60 segundos; todas las respuestas que puedas.
- **Maratón orbital**: 90 segundos de categorías seguidas; las respuestas raras dan tiempo extra
  (+1/+2/+3/+5 s) y saltar cuesta 4 s.
- **Entrenamiento**: como la diaria, con categorías al azar.
- **Retos por enlace**: al acabar, «Retar a un amigo» genera un enlace `?reto=…` con tus categorías y respuestas;
  quien lo abre juega las mismas y al final se comparan.
- **En el mismo móvil**: 2-4 pilotos por turnos. Si dos dicen lo mismo, **chocan**: mitad de puntos cada uno.
- **Online**: salas de hasta 6 con código de 5 letras (o enlace `?sala=…`). Funciona con WebRTC (PeerJS,
  en `js/vendor/`): el servidor público de PeerJS solo pone en contacto a los navegadores; el anfitrión hace
  de árbitro (recibe respuestas, resuelve choques y reparte resultados). Necesita conexión a internet.

## Cómo funciona

- **Puntos por rareza**: muy común 10 · común 20 · poco común 35 · rara 55 · rarísima 85.
- **Destino del día** según los puntos (máximo 7 × 85 = 595): órbita, Luna (60), Marte (120),
  asteroides (180), Júpiter (240), Saturno (300), Urano (360), Neptuno (420), Plutón (480), Kuiper (560).
- **Viaje acumulado**: cada punto son 100.000 km; los días se suman (Luna, Marte… hasta el espacio interestelar).
- **Respuestas**: da igual mayúsculas, tildes, artículo o plural; se perdona una errata (dos en palabras largas).
- **Reto diario**: determinista por fecha; las categorías se recorren en ciclos barajados sin repetir.
- Sin servidor ni cuentas: el progreso se guarda en el navegador (`localStorage`). Funciona sin conexión (service worker).

## Estructura

```
index.html              armazón: fondo, cabecera, <main id="pantalla"> y diálogo de ayuda
css/estilo.css          diseño pixel art: paneles con esquinas en escalón, botones 3D, fuente Pixelify Sans
js/motor.js             lógica pura: normalizar, buscar, reto diario, destinos, viaje, choques, retos por enlace
js/pixel.js             motor de sprites: planetas procedurales tramados (Bayer) y cohetes, animados a 12 fps
js/fondo.js             fondo pixel: nebulosas, estrellas en parallax, warp y estrellas fugaces
js/sonido.js            efectos chiptune con Web Audio (sin archivos)
js/ui.js, js/estado.js  navegación entre pantallas, utilidades, y lo que se guarda en el navegador
js/red.js               salas online con PeerJS
js/pantallas/           inicio, rondas (diaria/entrenamiento/reto), contrarreloj (lluvia/maratón),
                        resultados, reto, local, online, y comun.js (altímetro, combustible, tarjetas)
js/textos.js            textos de la interfaz en español e inglés
datos/es.json, en.json  categorías y respuestas ("nombre|variante:rareza", rareza 1-5)
herramientas/           validar_datos.py, pulir_nombres.py (tildes y mayúsculas), tildes_es.py
tests/                  test_motor.py y capturas.py (juegan partidas reales en Edge con Playwright)
```

## Añadir o editar categorías

1. Edita `datos/es.json` o `datos/en.json`: una categoría por línea, respuestas `"forma|otra forma:rareza"`.
2. `python herramientas/pulir_nombres.py` (pone tildes y mayúsculas al nombre que se muestra).
3. `python herramientas/validar_datos.py` (formato, rarezas, duplicados).

## Tests y capturas

```
python -m venv .venv-dev && .venv-dev\Scripts\pip install playwright
.venv-dev\Scripts\python tests\test_motor.py      # con jugar.bat (o http.server 8300) en marcha
.venv-dev\Scripts\python tests\capturas.py        # juega todos los modos en es/en, móvil/escritorio → tests/capturas/
.venv-dev\Scripts\python tests\capturas.py es movil online   # un idioma, dispositivo y escenario concretos
```
`tests/sprites.html` muestra todos los planetas y cohetes para revisar el pixel art.

## Camino a Google Play

La app ya es una PWA (manifest, iconos 192/512, service worker). Para publicarla:
1. Alojar estos archivos en un dominio con https (p. ej. GitHub Pages o Netlify).
2. Empaquetarla como *Trusted Web Activity* con Bubblewrap (genera el .aab para Play).
3. Cuenta de desarrollador de Google Play y ficha de la tienda (capturas: `tests/capturas/`).
