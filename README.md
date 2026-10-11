# Lexinauta · Lexinaut 🚀

Juego diario de palabras, en español y en inglés: cada día, 7 categorías iguales para todo el mundo
(«Un queso», «Una constelación»…). Escribe algo que encaje antes de que se acabe el combustible:
**cuanto más rara tu respuesta, más lejos llega tu cohete**. Cada misión diaria es un salto por el
universo: la Luna, Plutón, Alfa Centauri, Andrómeda… hasta el borde del universo observable.

## Progresión

- **Viaje**: solo la misión diaria mueve el cohete (si se juega en los dos idiomas, cuenta la mejor).
  25 objetos en 4 capítulos con su distancia real; el mapa del universo enseña lo descubierto.
- **Racha** de días seguidos, con **escudos** (uno cada 7 días, máximo 2) que salvan un día perdido.
- **Hangar**: 10 cohetes que se desbloquean por racha y por hasta dónde ha llegado el viaje.
- **Liga semanal** online (opcional, ver abajo): grupos de 30 por división (Lunar → Galáctica);
  cada lunes suben los 5 primeros y bajan los 5 últimos.

## Jugar

Publicado en **<https://umpierrezzzz.github.io/lexinauta/>** (GitHub Pages: cada `git push` a `main`
actualiza la web en un par de minutos).

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
- **Destino de la partida** (en los modos que no son la diaria) según los puntos (máximo 7 × 85 = 595): órbita, Luna (60), Marte (120),
  asteroides (180), Júpiter (240), Saturno (300), Urano (360), Neptuno (420), Plutón (480), Kuiper (560).
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
js/liga.js, config.js   cliente de la liga semanal (Supabase) y su configuración
servidor/liga.sql       tablas y funciones de la liga (se pega en el SQL Editor de Supabase)
js/pantallas/           inicio, rondas (diaria/entrenamiento/reto), contrarreloj (lluvia/maratón),
                        resultados, reto, local, online, universo, hangar, liga,
                        y comun.js (altímetro, combustible, tarjetas)
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

## Liga online (Supabase)

El juego funciona sin servidor; la liga necesita una base de datos compartida. Se usa Supabase (gratis):

1. Crea una cuenta en <https://supabase.com> y un proyecto nuevo (región Europa; apunta la contraseña).
2. En el proyecto: **SQL Editor → New query**, pega `servidor/liga.sql` entero y pulsa **Run**.
3. En **Project Settings → API** copia la *Project URL* y la clave *anon public* en `js/config.js`.

La clave anon es pública por diseño: solo deja llamar a `liga_registrar`, `liga_enviar` y `liga_estado`,
que validan todo (una misión al día, 0-595 puntos, fecha de hoy). Los jugadores son anónimos: un alias
y un identificador secreto guardado en su navegador. Ojo: los proyectos gratuitos se pausan tras una
semana sin uso (se reactivan desde el panel).

Pruebas: `tests/test_liga.py` (reglas de ascenso/descenso, permisos) y el escenario `liga` de
`tests/capturas.py` usan una réplica local en Docker (`tests/liga_local.py`: Postgres + PostgREST).

## Camino a Google Play

La app ya es una PWA (manifest, iconos 192/512, service worker). Para publicarla:
1. **Alojarla con https** (gratis): GitHub Pages o Netlify.
2. **Empaquetarla** como *Trusted Web Activity* (gratis): <https://www.pwabuilder.com> → pegar la URL →
   Android → genera el `.aab` y el archivo `assetlinks.json`, que hay que subir a `/.well-known/` de la web
   (así la app se abre sin barra del navegador). Alternativa por consola: Bubblewrap.
3. **Cuenta de desarrollador de Google Play**: pago único de 25 $ y verificación de identidad.
4. **Prueba cerrada**: las cuentas personales nuevas deben tener la app en prueba cerrada con al menos
   12 testers durante 14 días seguidos antes de pedir acceso a producción (normas de 2024-2025; revisar).
5. **Ficha**: icono 512, gráfico destacado 1024×500, capturas (`tests/capturas/`), política de privacidad
   (una página sencilla: no hay cuentas; la liga guarda alias y puntuaciones) y cuestionario de contenido.
