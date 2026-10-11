// Base de lanzamiento: misión diaria, modos de vuelo, multijugador y el viaje acumulado.
import { numeroDeDia, categoriasDelDia, categoriasPractica, estadoViaje } from "../motor.js";
import { $, T, ruta, ir, pantalla, aviso, escapar, capital, numero, planeta, cohete, COLORES_JUGADOR, cuentaAtrasHastaManana } from "../ui.js";
import { estado, partidaDeHoy, estadisticas, record, nombrePiloto, guardarNombre } from "../estado.js";
import { htmlProgresoViaje, animarProgreso, htmlRacha } from "./universo.js";
import { htmlTarjetaLiga, activarTarjetaLiga } from "./liga.js";
import { cuentasActivas, sesion, entrarConGoogle, salir, sincronizar, errorSincronizacion } from "../cuenta.js";
import { sonido } from "../sonido.js";

function tarjetaModo({ id, icono, titulo, desc, acento, mejor }) {
  return `<button class="caja modo acento-${acento}" data-modo="${id}">
    <span class="modo-icono">${icono}</span>
    <h3>${titulo}</h3>
    <p>${desc}</p>
    ${mejor ? `<span class="modo-record">★ ${T().record}: ${mejor}</span>` : ""}
  </button>`;
}

function htmlDiaria(t, dia, hoy, est) {
  const cabecera = `<div class="diaria-cabecera"><span class="chip">${t.diario} #${dia}</span>${htmlRacha(est)}</div>`;
  if (hoy?.completa) {
    return `<section class="caja destacada diaria">
      ${cabecera}
      <div class="diaria-hecha">
        <span class="suave">${t.saltoDeHoy}</span>
        <b>+${hoy.puntos} ${t.puntos}</b>
      </div>
      <button class="btn grande ancho" data-ver-diario>${t.verResultado}</button>
      <p class="suave" style="margin:0">${t.yaJugado} <span class="cuenta" data-cuenta>${cuentaAtrasHastaManana()}</span></p>
    </section>`;
  }
  return `<section class="caja destacada diaria">
    ${cabecera}
    <p class="subtitulo">${t.diarioDesc}</p>
    <button class="btn amarillo grande ancho" data-jugar-diario>🚀 ${hoy ? `${t.despegar} · ${hoy.etapas?.length || 0}/7` : t.despegar}</button>
  </section>`;
}

const LOGO_GOOGLE = `<svg viewBox="0 0 8 8" width="16" height="16" shape-rendering="crispEdges" aria-hidden="true">
  <path fill="#ea4335" d="M2 0h4v1h1v1H5V1H2z"/><path fill="#fbbc05" d="M1 1h1v1H1v4H0V2h1z"/>
  <path fill="#34a853" d="M1 6h1v1h3V6h1v1H5v1H2V7H1z"/><path fill="#4285f4" d="M4 3h4v3H7v1H6V5H4z"/></svg>`;

function htmlCuenta(t) {
  if (!cuentasActivas()) return "";
  const s = sesion();
  if (!s) return `<button class="btn chico blanco" data-google>${LOGO_GOOGLE} ${t.entrarGoogle}</button>`;
  const error = errorSincronizacion();
  return `<div class="cuenta">${error
    ? `<span class="cuenta-estado aviso">⚠ ${t.sinSincronizar}<small>${escapar(s.correo || "")}</small><small class="detalle">${escapar(error)}</small></span>
       <button class="btn chico amarillo" data-reintentar>${t.reintentar}</button>`
    : `<span class="cuenta-estado">☁ ${t.guardadoNube}<small>${escapar(s.correo || "")}</small></span>`}
    <button class="enlace" data-salir>${t.cerrarSesion}</button></div>`;
}

ruta("inicio", () => {
  const t = T();
  const idioma = estado.idioma;
  const dia = numeroDeDia();
  const hoy = partidaDeHoy(idioma);
  const est = estadisticas(idioma);
  const viaje = estadoViaje(est.puntosViaje);

  const modos = [
    { id: "lluvia", icono: planeta("asteroides", 20, "", 2), titulo: t.lluvia, desc: t.lluviaDesc, acento: "lluvia", mejor: record("lluvia") },
    { id: "maraton", icono: planeta("sol", 20, "", 2), titulo: t.maraton, desc: t.maratonDesc, acento: "maraton", mejor: record("maraton") },
    { id: "practica", icono: planeta("luna", 20, "", 2), titulo: t.practica, desc: t.practicaDesc, acento: "practica", mejor: record("practica") },
  ];
  const multi = [
    { id: "online", icono: planeta("tierra", 20, "", 2), titulo: t.online, desc: t.onlineDesc, acento: "online" },
    { id: "local", icono: `${cohete(COLORES_JUGADOR[1], "", 2, "", "clasico")}${cohete(COLORES_JUGADOR[2], "", 2, "", "retro")}`, titulo: t.local, desc: t.localDesc, acento: "local" },
  ];

  const raiz = pantalla(`<div class="inicio-rejilla">
    <div class="inicio-col">
      <section class="hero">
        <div class="hero-escena" aria-hidden="true">
          ${planeta(viaje.alcanzado.id, viaje.alcanzado.id === "saturno" ? 40 : 52)}
          ${planeta("luna", 12, "luna-px", 3)}
          ${cohete(COLORES_JUGADOR[0], "", 3)}
        </div>
        <h1 class="titulo-pixel">${t.titulo}</h1>
        <p class="subtitulo">${t.lema}</p>
      </section>
      ${htmlDiaria(t, dia, hoy, est)}
      <section class="caja piloto">
        <button class="piloto-cohete" data-hangar aria-label="${t.hangar}">${cohete(COLORES_JUGADOR[0], "", 3)}</button>
        <div class="piloto-datos">
          <label class="etiqueta" for="nombre-piloto">${t.tuNombre}</label>
          <span class="campo chico"><input id="nombre-piloto" data-nombre maxlength="16" value="${escapar(nombrePiloto())}" placeholder="${t.nombrePorDefecto}"></span>
          <button class="btn chico violeta" data-hangar>🛠 ${t.hangar} · ${t.cohetes[estado.cohete] || ""}</button>
          ${htmlCuenta(t)}
        </div>
      </section>
    </div>
    <div class="inicio-col">
      ${htmlTarjetaLiga()}
      <h2 class="seccion">${t.modos}</h2>
      <div class="rejilla-modos">${modos.map(tarjetaModo).join("")}</div>
      <h2 class="seccion">${t.multijugador}</h2>
      <div class="rejilla-modos">${multi.map(tarjetaModo).join("")}</div>
      <p class="aviso-pie">${t.soloDiaria} ${t.retoDesc}</p>
      <h2 class="seccion">${t.tuViaje}</h2>
      <section class="caja viaje">
        <div class="viaje-cabecera">
          <span class="etiqueta">${t.capitulos[viaje.alcanzado.capitulo]}</span>
          <span class="viaje-km">${t.distancia(viaje.km)} <small>${t.desdeLaTierra}</small></span>
        </div>
        ${htmlProgresoViaje(viaje)}
        <div class="estadisticas">
          <div class="estadistica"><b>${est.partidas}</b><span>${t.partidas}</span></div>
          <div class="estadistica"><b>${est.mejorRacha}</b><span>${t.mejorRacha}</span></div>
          <div class="estadistica"><b>${est.mejor}</b><span>${t.mejor}</span></div>
        </div>
        <button class="btn violeta ancho" data-mapa>🔭 ${t.verMapa}</button>
      </section>
    </div>
  </div>`, "inicio");

  animarProgreso(raiz, viaje.progreso);
  activarTarjetaLiga(raiz);
  $("[data-mapa]", raiz).addEventListener("click", () => { sonido.clic(); ir("universo"); });
  $("[data-google]", raiz)?.addEventListener("click", () => { sonido.clic(); entrarConGoogle(); });
  $("[data-reintentar]", raiz)?.addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    try { await sincronizar(); aviso(t.guardadoNube); } catch { aviso(t.errorSincronizar, "error"); }
    ir("inicio");
  });
  $("[data-salir]", raiz)?.addEventListener("click", async () => { if (confirm(t.seguroSalir)) { await salir(); ir("inicio"); } });
  raiz.querySelectorAll("[data-hangar]").forEach((b) => b.addEventListener("click", () => { sonido.clic(); ir("hangar"); }));

  $("[data-jugar-diario]", raiz)?.addEventListener("click", () => ir("diario"));
  $("[data-ver-diario]", raiz)?.addEventListener("click", () => {
    ir("resultados", { modo: "diario", puntos: hoy.puntos, etapas: hoy.etapas || [], categorias: categoriasDelDia(estado.datos[idioma].ids, dia), dia });
  });
  raiz.querySelectorAll("[data-modo]").forEach((b) => b.addEventListener("click", () => { sonido.clic(); ir(b.dataset.modo); }));
  const nombre = $("[data-nombre]", raiz);
  nombre.addEventListener("change", () => guardarNombre(nombre.value));
  nombre.addEventListener("keydown", (e) => { if (e.key === "Enter") nombre.blur(); });
});

ruta("diario", () => {
  const ids = estado.datos[estado.idioma].ids;
  const hoy = partidaDeHoy(estado.idioma);
  if (hoy?.completa) return ir("inicio");
  ir("rondas", { modo: "diario", categorias: categoriasDelDia(ids, numeroDeDia()) });
});

ruta("practica", () => {
  ir("rondas", { modo: "practica", categorias: categoriasPractica(estado.datos[estado.idioma].ids) });
});
