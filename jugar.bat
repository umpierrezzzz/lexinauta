@echo off
rem Arranca el juego en http://127.0.0.1:8300 y lo abre en el navegador.
cd /d "%~dp0"
set PY=%LOCALAPPDATA%\Programs\Python\Python313\python.exe
if not exist "%PY%" set PY=python
start "" http://127.0.0.1:8300
echo Lexinauta en http://127.0.0.1:8300  (cierra esta ventana para pararlo)
"%PY%" -m http.server 8300 --bind 127.0.0.1
