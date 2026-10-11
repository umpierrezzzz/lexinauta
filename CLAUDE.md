# Lexinauta (Lexinaut en inglés) — instrucciones para Claude Code

Juego web diario de palabras con temática espacial, en español e inglés. Objetivo: publicarlo en Google Play
como PWA (Trusted Web Activity).

## Principios
- **Lo visual es prioritario**: tiene que ser bonito. Revisa cada cambio con capturas (`tests/capturas.py`) en
  móvil y escritorio, y en los dos idiomas, antes de darlo por bueno.
- Sin frameworks ni dependencias en el juego: HTML, CSS y JS (módulos) servidos estáticos. Playwright solo
  para desarrollo, en `.venv-dev`.
- Español e inglés siempre a la par: textos en `js/textos.js`, contenido en `datos/<idioma>.json`.
- La lógica va en `js/motor.js` (sin DOM) y se prueba con `tests/test_motor.py`.
- Tras editar datos: `herramientas/pulir_nombres.py` y `herramientas/validar_datos.py`.
- Commit tras cada cambio que funcione, con mensajes claros en español.
- Estilo pixel art: sprites en `<canvas>` (`js/pixel.js`) escalados con `--escala`, nada de degradados suaves
  ni bordes redondeados; animaciones con `steps()`.
- Cada pantalla es un módulo en `js/pantallas/` que se registra con `ruta()` y se abre con `ir()`.
