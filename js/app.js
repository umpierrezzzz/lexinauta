// Arranque: fondo, cabecera, ayuda, idioma y navegación inicial (incluidos los enlaces de reto y de sala).
import { PUNTOS, decodificarReto } from "./motor.js";
import { $, T, ir, montarSprites, aviso, COLOR_RAREZA } from "./ui.js";
import { estado, almacen, cargarDatos, cambiarIdioma } from "./estado.js";
import { crearFondo } from "./fondo.js";
import { sonido } from "./sonido.js";
import "./pantallas/inicio.js";
import "./pantallas/rondas.js";
import "./pantallas/contrarreloj.js";
import "./pantallas/resultados.js";
import "./pantallas/reto.js";
import "./pantallas/local.js";
import "./pantallas/online.js";
import "./pantallas/universo.js";
import { cohetesNuevos } from "./pantallas/hangar.js";
import "./pantallas/liga.js";
import { cuentasActivas, sesion, completarEntrada, sincronizar } from "./cuenta.js";

estado.fondo = crearFondo($("#fondo"));
montarSprites($(".barra"));

function textosCabecera() {
  const t = T();
  document.documentElement.lang = estado.idioma;
  document.title = t.titulo;
  $("#marca-nombre").textContent = t.titulo;
  $("#boton-idioma").textContent = estado.idioma === "es" ? "EN" : "ES";
  $("#boton-idioma").setAttribute("aria-label", `${t.idioma}: ${estado.idioma === "es" ? "English" : "Español"}`);
  $("#boton-sonido").textContent = sonido.silencio ? "✕" : "♪";
  $("#boton-sonido").setAttribute("aria-label", t.sonido);
  $("#boton-ayuda").setAttribute("aria-label", t.comoSeJuega);
  $("#ayuda-titulo").textContent = t.comoSeJuega;
  $("#ayuda-pasos").innerHTML = t.ayuda.map((p) => `<li>${p}</li>`).join("");
  $("#ayuda-rarezas").innerHTML = [1, 2, 3, 4, 5]
    .map((r) => `<span style="--c:${COLOR_RAREZA[r]}">${t.rareza[r]} +${PUNTOS[r]}</span>`).join("");
  $("#cerrar-ayuda").textContent = t.entendido;
}

function abrirAyuda() { $("#dialogo-ayuda").showModal(); }

$("#ir-inicio").addEventListener("click", () => {
  if ($("#pantalla").classList.contains("partida") && !confirm(T().seguroAbandonar)) return;
  ir("inicio");
});
$("#boton-ayuda").addEventListener("click", abrirAyuda);
$("#cerrar-ayuda").addEventListener("click", () => $("#dialogo-ayuda").close());
$("#dialogo-ayuda").addEventListener("close", () => almacen.guardar("hp_ayuda_vista", true));
$("#boton-sonido").addEventListener("click", () => { sonido.alternar(); textosCabecera(); });
$("#boton-idioma").addEventListener("click", async () => {
  const pantalla = $("#pantalla");
  if (pantalla.classList.contains("partida") && !confirm(T().seguroAbandonar)) return;
  cambiarIdioma(estado.idioma === "es" ? "en" : "es");
  await cargarDatos();
  textosCabecera();
  if (almacen.leer("hp_cohetes_vistos", null) === null) cohetesNuevos();   // primera vez: lo ya desbloqueado no se anuncia
  ir("inicio");
});

async function arrancar() {
  const params = new URLSearchParams(location.search);
  const reto = params.get("reto") ? decodificarReto(params.get("reto")) : null;
  const sala = (params.get("sala") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (reto && reto.idioma !== estado.idioma) cambiarIdioma(reto.idioma);
  const codigo = params.get("code"), errorAuth = params.get("error_description");
  if (params.has("reto") || params.has("sala") || codigo || errorAuth) history.replaceState(null, "", location.pathname);

  await cargarDatos();
  textosCabecera();
  if (almacen.leer("hp_cohetes_vistos", null) === null) cohetesNuevos();   // primera vez: lo ya desbloqueado no se anuncia
  // Vuelta del inicio de sesión con Google
  if (codigo && cuentasActivas()) {
    try {
      const s = await completarEntrada(codigo);
      await sincronizar();
      estado.cohete = almacen.leer("hp_cohete", estado.cohete);
      setTimeout(() => aviso(T().bienvenida(s.nombre.split(" ")[0] || s.correo)), 600);
    } catch { setTimeout(() => aviso(T().errorSesion, "error"), 600); }
  } else if (errorAuth) setTimeout(() => aviso(T().errorSesion, "error"), 600);
  // Con sesión iniciada, se trae lo último de la cuenta (por si se ha jugado en otro dispositivo)
  else if (sesion()) sincronizar().then((cambia) => { if (cambia && $("#pantalla.inicio")) ir("inicio"); }).catch(() => {});

  if (reto) ir("reto", reto);
  else if (sala) ir("online", { unirse: sala });
  else {
    ir("inicio");
    if (!almacen.leer("hp_ayuda_vista", false)) setTimeout(abrirAyuda, 700);
  }
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
arrancar();
