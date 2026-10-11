import {
  PUNTOS, SEGUNDOS_POR_RONDA, PENALIZACION_FALLO, RONDAS, DESTINOS_DIA,
  prepararCategoria, buscar, ejemplos, numeroDeDia, categoriasDelDia, categoriasPractica,
  destinoDelDia, estadoViaje, textoCompartir,
} from "./motor.js";
import { TEXTOS } from "./textos.js";
import { crearCielo } from "./estrellas.js";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const MAX_DIA = RONDAS * PUNTOS[5];
const COLOR_RAREZA = ["#4a5373", "#6fa8ff", "#47dca0", "#ffd25c", "#ff944a", "#ff4f9a"];
const RGB_RAREZA = [[150, 160, 200], [111, 168, 255], [71, 220, 160], [255, 210, 92], [255, 148, 74], [255, 79, 154]];

// ---------------------------------------------------------------- almacenamiento (siempre con red)

const almacen = {
  leer(clave, defecto) {
    try { const v = localStorage.getItem(clave); return v === null ? defecto : JSON.parse(v); } catch { return defecto; }
  },
  guardar(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* modo privado: se juega igual */ }
  },
};

function hoyISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function historial() { return almacen.leer("hp_historial", {}); }
function guardarPartida(idioma, fecha, partida) {
  const h = historial();
  h[`${idioma}:${fecha}`] = partida;
  almacen.guardar("hp_historial", h);
}
function partidaDeHoy(idioma) { return historial()[`${idioma}:${hoyISO()}`] || null; }

function estadisticas(idioma) {
  const h = historial();
  const mias = Object.entries(h).filter(([k, p]) => k.startsWith(idioma + ":") && p.completa);
  const fechas = new Set(mias.map(([k]) => k.slice(idioma.length + 1)));
  let racha = 0;
  const d = new Date();
  if (!fechas.has(hoyISO(d))) d.setDate(d.getDate() - 1);   // la racha sigue viva si jugaste ayer
  while (fechas.has(hoyISO(d))) { racha++; d.setDate(d.getDate() - 1); }
  const total = Object.values(h).filter((p) => p.completa).reduce((s, p) => s + p.puntos, 0);
  return { partidas: mias.length, mejor: Math.max(0, ...mias.map(([, p]) => p.puntos)), racha, totalPuntos: total };
}

// ---------------------------------------------------------------- estado

function idiomaInicial() {
  const guardado = almacen.leer("hp_idioma", null);
  if (guardado) return guardado;
  return (navigator.language || "es").toLowerCase().startsWith("es") ? "es" : "en";
}

const estado = {
  idioma: idiomaInicial(),
  datos: {},          // idioma → { ids, porId }
  modo: "diario",
  ids: [],
  ronda: 0,
  resultados: [],
  limite: 0,           // instante en que se acaba el combustible
  temporizador: null,
  terminada: false,
};

const T = () => TEXTOS[estado.idioma];
let cielo;

async function cargarDatos(idioma) {
  if (estado.datos[idioma]) return estado.datos[idioma];
  const crudo = await (await fetch(`datos/${idioma}.json`)).json();
  const porId = {};
  for (const c of crudo.categorias) porId[c.id] = prepararCategoria(c, idioma);
  estado.datos[idioma] = { ids: crudo.categorias.map((c) => c.id), porId };
  return estado.datos[idioma];
}

// ---------------------------------------------------------------- piezas visuales

function cohete() {
  return `<svg class="cohete" viewBox="0 0 40 64" aria-hidden="true">
    <path class="llama" d="M13 46 Q20 70 27 46 Z" fill="url(#hp-fuego)"/>
    <path class="llama-interior" d="M16 46 Q20 60 24 46 Z" fill="#fffbe0"/>
    <path d="M10 34 L3 46 L10 44 Z M30 34 L37 46 L30 44 Z" fill="url(#hp-aleta)"/>
    <path d="M20 2 C29 10 31 24 30 44 L10 44 C9 24 11 10 20 2 Z" fill="url(#hp-cuerpo)"/>
    <path d="M20 2 C24 5.5 26.5 9.5 28 14 L12 14 C13.5 9.5 16 5.5 20 2 Z" fill="url(#hp-aleta)"/>
    <circle cx="20" cy="24" r="5" fill="url(#hp-ventana)" stroke="#8592b8" stroke-width="1.5"/>
    <rect x="17" y="44" width="6" height="3" rx="1" fill="#6b7596"/>
  </svg>`;
}

function planeta(id, clase = "") {
  return `<div class="planeta ${clase}" data-planeta="${id === "orbita" ? "orbita" : id}"></div>`;
}

function capital(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

function textos() {
  document.documentElement.lang = estado.idioma;
  document.title = T().titulo;
  $$("[data-t]").forEach((el) => { el.textContent = T()[el.dataset.t]; });
  $$("[data-t-aria]").forEach((el) => el.setAttribute("aria-label", T()[el.dataset.tAria]));
  $(".selector-idioma").textContent = estado.idioma === "es" ? "ES" : "EN";
  $(".selector-idioma").setAttribute("aria-label", `${T().idioma}: ${T().nombreIdioma}`);
  $("#respuesta").placeholder = T().escribe;
  $("#ayuda-pasos").innerHTML = T().ayuda.map((p) => `<li>${p}</li>`).join("");
  $("#ayuda-rarezas").innerHTML = [1, 2, 3, 4, 5]
    .map((r) => `<span style="--c:${COLOR_RAREZA[r]}">${T().rareza[r]}<b>+${PUNTOS[r]}</b></span>`).join("");
}

function mostrar(pantalla) {
  ["inicio", "juego", "resultado"].forEach((p) => { $(`#p-${p}`).hidden = p !== pantalla; });
  window.scrollTo({ top: 0 });
}

function formatoKm(km) {
  return Math.round(km).toLocaleString(estado.idioma === "es" ? "es-ES" : "en-GB");
}

function cuentaAtras() {
  const ahora = new Date();
  const manana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1);
  const s = Math.max(0, Math.floor((manana - ahora) / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
}

// ---------------------------------------------------------------- INICIO

function pintarInicio() {
  const t = T();
  $("#inicio-lanzamiento").textContent = `${t.lanzamiento} #${numeroDeDia()}`;
  const hoy = partidaDeHoy(estado.idioma);
  const boton = $(".boton-despegar");
  if (hoy && hoy.completa) {
    $("#texto-despegar").textContent = t.verResultado;
    boton.classList.add("secundario");
    $("#ya-jugado").hidden = false;
    $("#ya-jugado").innerHTML = `${t.yaJugado} <b data-cuenta>${cuentaAtras()}</b>`;
  } else {
    $("#texto-despegar").textContent = t.despegar;
    boton.classList.remove("secundario");
    $("#ya-jugado").hidden = true;
  }

  const est = estadisticas(estado.idioma);
  const viaje = estadoViaje(est.totalPuntos);
  $("#viaje-km").textContent = formatoKm(viaje.km);
  $("#viaje-desde").outerHTML = `<div class="planeta planeta-mini" id="viaje-desde" data-planeta="${viaje.alcanzado.id}"></div>`;
  const hacia = viaje.siguiente ? viaje.siguiente.id : "voyager";
  $("#viaje-hacia").outerHTML = `<div class="planeta planeta-mini" id="viaje-hacia" data-planeta="${hacia}"></div>`;
  $("#viaje-desde-txt").textContent = t.destinoCorto[viaje.alcanzado.id];
  $("#viaje-hacia-txt").textContent = viaje.siguiente ? `${t.proximoDestino}: ${t.destinoCorto[hacia]}` : t.hasLlegado;
  const pct = Math.max(0, Math.min(1, viaje.progreso));
  requestAnimationFrame(() => {
    $("#viaje-hecho").style.width = `${pct * 100}%`;
    $("#viaje-cohete").style.left = `calc(22px + (100% - 44px) * ${pct})`;
  });
  $("#estadisticas").innerHTML = [
    [est.racha, `${t.racha}`], [est.mejor, t.mejor], [est.partidas, t.partidas],
  ].map(([v, n]) => `<div class="estadistica"><b>${v}</b><span>${n}</span></div>`).join("");
}

// ---------------------------------------------------------------- JUEGO

async function empezar(modo) {
  const datos = await cargarDatos(estado.idioma);
  estado.modo = modo;
  estado.terminada = false;
  if (modo === "diario") {
    const hoy = partidaDeHoy(estado.idioma);
    if (hoy && hoy.completa) return pintarResultadoFinal(hoy);
    estado.ids = categoriasDelDia(datos.ids, numeroDeDia());
    estado.resultados = hoy ? hoy.resultados : [];      // se retoma si se cerró a medias
  } else {
    estado.ids = categoriasPractica(datos.ids);
    estado.resultados = [];
  }
  estado.ronda = estado.resultados.length;
  mostrar("juego");
  pintarAltimetro();
  pintarEtapas();
  $("#juego-puntos").textContent = puntosTotales();
  if (estado.ronda >= RONDAS) return terminarPartida();
  mostrarRonda();
}

function puntosTotales() { return estado.resultados.reduce((s, r) => s + r.puntos, 0); }

function pintarAltimetro() {
  const t = T();
  const hitos = DESTINOS_DIA.filter((d) => d.min > 0 && d.id !== "orbita");
  $("#altimetro").innerHTML =
    `<div class="alt-planeta" style="--pos:0%">${planeta("tierra")}<span>${t.destinoCorto.tierra}</span></div>` +
    hitos.map((d) => `<div class="alt-planeta" data-min="${d.min}" style="--pos:${(d.min / MAX_DIA) * 100}%">${planeta(d.id)}<span>${t.destinoCorto[d.id]}</span></div>`).join("") +
    `<div class="alt-estela" style="--pos:0%"></div><div class="alt-cohete" style="--pos:0%">${cohete()}</div>`;
  moverCohete();
}

function moverCohete() {
  const total = puntosTotales();
  const pos = `${Math.min(total / MAX_DIA, 1) * 100}%`;
  $(".alt-cohete").style.setProperty("--pos", pos);
  $(".alt-estela").style.setProperty("--pos", pos);
  $$(".alt-planeta[data-min]").forEach((el) => el.classList.toggle("pasado", total >= Number(el.dataset.min)));
}

function pintarEtapas() {
  $("#etapas").innerHTML = Array.from({ length: RONDAS }, (_, i) => {
    const r = estado.resultados[i];
    if (r) return `<li data-r="${r.rareza}" style="--c:${COLOR_RAREZA[r.rareza]}"></li>`;
    return `<li class="${i === estado.ronda ? "actual" : ""}"></li>`;
  }).join("");
  $("#juego-etapa").textContent = `${T().ronda} ${Math.min(estado.ronda + 1, RONDAS)} ${T().de} ${RONDAS}`;
}

function categoriaActual() { return estado.datos[estado.idioma].porId[estado.ids[estado.ronda]]; }

function mostrarRonda() {
  const cat = categoriaActual();
  $("#resultado-etapa").hidden = true;
  const tarjeta = $("#tarjeta");
  tarjeta.hidden = false;
  tarjeta.classList.remove("entra", "poco");
  void tarjeta.offsetWidth;          // reinicia la animación de entrada
  tarjeta.classList.add("entra");
  $("#categoria-icono").textContent = cat.icono;
  $("#categoria-nombre").textContent = cat.nombre;
  $("#mensaje").textContent = "";
  $("#mensaje").className = "mensaje";
  $("#formulario").classList.remove("error");
  const input = $("#respuesta");
  input.value = "";
  input.disabled = false;
  setTimeout(() => input.focus({ preventScroll: true }), 50);
  pintarEtapas();
  estado.limite = performance.now() + SEGUNDOS_POR_RONDA * 1000;
  cancelAnimationFrame(estado.temporizador);
  estado.temporizador = requestAnimationFrame(tic);
}

function tic(ahora) {
  const restante = Math.max(0, estado.limite - ahora);
  $("#combustible").style.transform = `scaleX(${restante / (SEGUNDOS_POR_RONDA * 1000)})`;
  $("#segundos").textContent = Math.ceil(restante / 1000);
  $("#tarjeta").classList.toggle("poco", restante <= 5000);
  if (restante <= 0) return terminarRonda(null);
  estado.temporizador = requestAnimationFrame(tic);
}

function enviar(evento) {
  evento.preventDefault();
  if (estado.terminada || $("#tarjeta").hidden) return;
  const input = $("#respuesta");
  const valor = input.value.trim();
  if (!valor) return;
  const hallada = buscar(categoriaActual(), valor);
  if (!hallada) {
    estado.limite -= PENALIZACION_FALLO * 1000;
    const formulario = $("#formulario");
    formulario.classList.remove("error");
    void formulario.offsetWidth;
    formulario.classList.add("error");
    $("#mensaje").className = "mensaje error";
    $("#mensaje").textContent = `${T().noValida} · −${PENALIZACION_FALLO} s`;
    if (navigator.vibrate) navigator.vibrate(60);
    input.select();
    return;
  }
  terminarRonda(hallada.respuesta, valor);
}

function terminarRonda(respuesta, escrita = "") {
  cancelAnimationFrame(estado.temporizador);
  const cat = categoriaActual();
  const destinoAntes = destinoDelDia(puntosTotales()).id;
  const rareza = respuesta ? respuesta.rareza : 0;
  const puntos = respuesta ? respuesta.puntos : 0;
  estado.resultados.push({ categoria: cat.id, respuesta: respuesta ? respuesta.nombre : null, rareza, puntos });
  if (estado.modo === "diario") {
    guardarPartida(estado.idioma, hoyISO(), { resultados: estado.resultados, puntos: puntosTotales(), completa: false });
  }

  // Marcador, cohete y cielo
  const marcador = $("#juego-puntos");
  marcador.textContent = puntosTotales();
  marcador.classList.remove("sube"); void marcador.offsetWidth; marcador.classList.add("sube");
  moverCohete();
  if (puntos) {
    cielo.impulso(puntos, RGB_RAREZA[rareza]);
    efectoPuntos(puntos, rareza);
    if (navigator.vibrate) navigator.vibrate(rareza >= 4 ? [30, 40, 60] : 25);
  }

  // Tarjeta de resultado de la etapa
  const t = T();
  const tarjeta = $("#resultado-etapa");
  tarjeta.style.setProperty("--c", COLOR_RAREZA[rareza]);
  $("#resultado-puntos").textContent = respuesta ? `+${puntos}` : "0";
  $("#resultado-rareza").textContent = respuesta ? t.rareza[rareza] : t.sinTiempo;
  const destinoDespues = destinoDelDia(puntosTotales()).id;
  const pasado = destinoDespues !== destinoAntes && destinoDespues !== "orbita"
    ? `<small>🚀 ${t.pasado} ${t.destinos[destinoDespues]}!</small>` : "";
  $("#resultado-respuesta").innerHTML = respuesta
    ? `${escapar(capital(respuesta.nombre))}${escrita && normal(escrita) !== normal(respuesta.nombre) ? ` <small>(${escapar(escrita)})</small>` : ""}${pasado}`
    : `<small>${escapar(cat.nombre)}</small>`;
  $("#lejanas").innerHTML = ejemplos(cat, 4, respuesta)
    .map((r) => `<li style="--c:${COLOR_RAREZA[r.rareza]}">${escapar(capital(r.nombre))}<small>+${r.puntos}</small></li>`).join("");
  const ultima = estado.ronda === RONDAS - 1;
  $("#boton-siguiente").textContent = ultima ? t.verDestino : t.siguiente;
  $("#tarjeta").hidden = true;
  tarjeta.hidden = false;
  estado.ronda++;
  pintarEtapas();
  setTimeout(() => $("#boton-siguiente").focus({ preventScroll: true }), 80);
}

function normal(t) { return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim(); }
function escapar(t) { return String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function efectoPuntos(puntos, rareza) {
  const ref = $("#marcador-ref") || $("#tarjeta");
  const caja = $("#formulario").getBoundingClientRect();
  const x = caja.left + caja.width / 2, y = caja.top;
  const f = document.createElement("div");
  f.className = "flotante";
  f.style.setProperty("--c", COLOR_RAREZA[rareza]);
  f.style.left = `${x}px`; f.style.top = `${y - 20}px`;
  f.textContent = `+${puntos}`;
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1400);
  if (rareza >= 4 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const n = rareza === 5 ? 36 : 20;
    for (let i = 0; i < n; i++) {
      const p = document.createElement("div");
      p.className = "particula";
      const ang = (Math.PI * 2 * i) / n + Math.random() * .3;
      const dist = 80 + Math.random() * (rareza === 5 ? 160 : 90);
      p.style.setProperty("--c", COLOR_RAREZA[Math.random() < .3 ? 3 : rareza]);
      p.style.setProperty("--dx", `${Math.cos(ang) * dist}px`);
      p.style.setProperty("--dy", `${Math.sin(ang) * dist}px`);
      p.style.left = `${x}px`; p.style.top = `${y}px`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1200);
    }
  }
  void ref;
}

function siguiente() {
  if (estado.ronda >= RONDAS) return terminarPartida();
  mostrarRonda();
}

function terminarPartida() {
  estado.terminada = true;
  const partida = { resultados: estado.resultados, puntos: puntosTotales(), completa: true, dia: numeroDeDia() };
  if (estado.modo === "diario") guardarPartida(estado.idioma, hoyISO(), partida);
  pintarResultadoFinal(partida);
}

// ---------------------------------------------------------------- RESULTADO

let ultimoCompartir = "";

function pintarResultadoFinal(partida) {
  const t = T();
  const destino = destinoDelDia(partida.puntos).id;
  const visual = destino === "orbita" ? "orbita" : destino;
  mostrar("resultado");
  $("#final-planeta").outerHTML = `<div class="planeta planeta-final" id="final-planeta" data-planeta="${visual}"></div>`;
  $(".final-cohete").innerHTML = cohete();
  $("#final-etiqueta").textContent = estado.modo === "diario"
    ? `${t.lanzamiento} #${partida.dia || numeroDeDia()} · ${t.hoyHasLlegado}` : `${t.practica} · ${t.hoyHasLlegado}`;
  $("#final-destino").textContent = capital(t.destinos[destino]);
  animarNumero($("#final-puntos"), partida.puntos);
  const datos = estado.datos[estado.idioma];
  $("#final-etapas").innerHTML = partida.resultados.map((r, i) => {
    const cat = datos.porId[r.categoria];
    return `<li style="--c:${COLOR_RAREZA[r.rareza]}; animation-delay:${.15 + i * .08}s">
      <span class="fe-icono">${cat ? cat.icono : "•"}</span>
      <span class="fe-texto"><small>${escapar(cat ? cat.nombre : r.categoria)}</small><span>${r.respuesta ? escapar(capital(r.respuesta)) : "—"}</span></span>
      <span class="fe-puntos">+${r.puntos}</span></li>`;
  }).join("");
  ultimoCompartir = textoCompartir({
    titulo: t.titulo, dia: partida.dia || numeroDeDia(), puntos: `${partida.puntos} ${t.puntos}`,
    destino: capital(t.destinos[destino]), rarezas: partida.resultados.map((r) => r.rareza),
  }) + `\n${location.origin}${location.pathname}`;
  $("#boton-otra").textContent = estado.modo === "diario" ? t.volver : t.otraPractica;
  $("#aviso-copiado").textContent = "";
  $("#proximo").innerHTML = estado.modo === "diario" ? `${t.yaJugado} <b data-cuenta>${cuentaAtras()}</b>` : "";
  if (partida.puntos) cielo.impulso(Math.min(partida.puntos / 6, 85), RGB_RAREZA[3]);
}

function animarNumero(el, hasta) {
  const inicio = performance.now(), dur = 1200;
  const paso = (ahora) => {
    const k = Math.min((ahora - inicio) / dur, 1);
    el.textContent = Math.round(hasta * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

async function compartir() {
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ text: ultimoCompartir });
      return;
    }
    await navigator.clipboard.writeText(ultimoCompartir);
    $("#aviso-copiado").textContent = T().copiado;
  } catch {
    $("#aviso-copiado").textContent = ultimoCompartir;
  }
}

// ---------------------------------------------------------------- eventos

async function cambiarIdioma() {
  if (!$("#p-juego").hidden) return;     // no se cambia en mitad de una partida
  estado.idioma = estado.idioma === "es" ? "en" : "es";
  almacen.guardar("hp_idioma", estado.idioma);
  await cargarDatos(estado.idioma);
  textos();
  pintarInicio();
  mostrar("inicio");
}

function abrirAyuda() { const d = $("#dialogo-ayuda"); if (!d.open) d.showModal(); }

document.addEventListener("click", (e) => {
  const boton = e.target.closest("[data-accion]");
  if (!boton) return;
  const accion = boton.dataset.accion;
  if (accion === "jugar") empezar("diario");
  else if (accion === "practica") empezar("practica");
  else if (accion === "ayuda") abrirAyuda();
  else if (accion === "cerrar-ayuda") { $("#dialogo-ayuda").close(); almacen.guardar("hp_ayuda_vista", true); }
  else if (accion === "idioma") cambiarIdioma();
  else if (accion === "siguiente") siguiente();
  else if (accion === "compartir") compartir();
  else if (accion === "otra") (estado.modo === "practica" ? empezar("practica") : (pintarInicio(), mostrar("inicio")));
  else if (accion === "inicio") {
    if (!$("#p-juego").hidden && !estado.terminada) return;   // en mitad de la partida, el logo no saca del juego
    pintarInicio(); mostrar("inicio");
  }
});
$("#formulario").addEventListener("submit", enviar);
$("#dialogo-ayuda").addEventListener("close", () => almacen.guardar("hp_ayuda_vista", true));
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !$("#resultado-etapa").hidden && document.activeElement?.id !== "boton-siguiente") siguiente();
});
setInterval(() => $$("[data-cuenta]").forEach((el) => { el.textContent = cuentaAtras(); }), 1000);

// ---------------------------------------------------------------- arranque

(async function arrancar() {
  cielo = crearCielo($("#cielo"));
  await cargarDatos(estado.idioma);
  $("#viaje-cohete").innerHTML = cohete();
  textos();
  pintarInicio();
  mostrar("inicio");
  if (!almacen.leer("hp_ayuda_vista", false)) setTimeout(abrirAyuda, 600);
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
