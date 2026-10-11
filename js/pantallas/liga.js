// Liga semanal: división, clasificación del grupo con zonas de ascenso y descenso, y alias del piloto.
import { $, T, ruta, ir, pantalla, escapar, numero, planeta, cohete, aviso, COLORES_JUGADOR, montarSprites } from "../ui.js";
import { estado, nombrePiloto, almacen } from "../estado.js";
import { sonido } from "../sonido.js";
import { ligaActiva, ligaGuardada, registrar, reintentarPendientes } from "../liga.js";

export const SPRITE_DIVISION = ["luna", "marte", "jupiter", "saturno", "sirio", "andromeda"];

export function aliasLiga() { return almacen.leer("hp_liga_alias", null) || nombrePiloto() || `Lexinauta${Math.floor(Math.random() * 9000 + 1000)}`; }

function tiempoRestante(e) {
  const ms = Math.max(0, new Date(e.fin) - Date.now());
  return T().terminaEn(Math.floor(ms / 864e5), Math.floor((ms % 864e5) / 36e5));
}

/** Posición del jugador en su grupo (o null si aún no ha entrado esta semana). */
function miFila(e) { return e?.grupo?.find((f) => f.yo) || null; }

/** Tarjeta de la liga para la portada. */
export function htmlTarjetaLiga() {
  if (!ligaActiva()) return "";
  return `<section class="caja liga-tarjeta" data-liga-tarjeta role="button" tabindex="0">${contenidoTarjeta(ligaGuardada())}</section>`;
}

function contenidoTarjeta(e) {
  const t = T();
  if (!e) return `${planeta(SPRITE_DIVISION[0], 20, "silueta", 2)}
    <div class="liga-tarjeta-texto"><span class="etiqueta">${t.ligaSemanal}</span><small>${t.entraLiga}</small></div>`;
  const fila = miFila(e);
  return `${planeta(SPRITE_DIVISION[e.division], 20, "", 2)}
    <div class="liga-tarjeta-texto">
      <span class="etiqueta">${t.ligaSemanal}</span>
      <b>${t.divisiones[e.division]}</b>
      <small>${fila ? `${t.posicion(fila.posicion)} ${t.deN(e.grupo.length)} · ${numero(fila.puntos)} ${t.puntosSemana}` : t.entraLiga}</small>
    </div>
    ${fila ? `<span class="liga-puesto">${t.posicion(fila.posicion)}</span>` : ""}`;
}

/** Activa la tarjeta de la portada y la refresca con datos del servidor. */
export function activarTarjetaLiga(raiz) {
  const tarjeta = $("[data-liga-tarjeta]", raiz);
  if (!tarjeta) return;
  const abrir = () => { sonido.clic(); ir("liga"); };
  tarjeta.addEventListener("click", abrir);
  tarjeta.addEventListener("keydown", (e) => { if (e.key === "Enter") abrir(); });
  reintentarPendientes(aliasLiga(), estado.cohete).then((e) => {
    if (!tarjeta.isConnected || !e) return;
    tarjeta.innerHTML = contenidoTarjeta(e);
    montarSprites(tarjeta);
  }).catch(() => {});
}

function htmlClasificacion(e) {
  const t = T();
  if (!e.grupo) return `<section class="caja"><p class="subtitulo" style="margin:0">${t.entraLiga}</p></section>`;
  const n = e.grupo.length;
  // En la primera división no se baja, y de la última no se sube
  e = { ...e, sube: e.division >= SPRITE_DIVISION.length - 1 ? 0 : e.sube, baja: e.division === 0 ? 0 : e.baja };
  return `<ol class="clasificacion">${e.grupo.map((f, k) => {
    const sube = f.posicion <= e.sube, baja = f.posicion > n - e.baja;
    const separador = k === 0 && e.sube > 0 ? `<li class="zona sube">▲ ${t.zonaAscenso}</li>` : "";
    const separadorBaja = f.posicion === n - e.baja + 1 && e.baja > 0 ? `<li class="zona baja">▼ ${t.zonaDescenso}</li>` : "";
    return `${separador}${separadorBaja}<li class="fila${f.yo ? " yo" : ""}${sube ? " en-sube" : ""}${baja ? " en-baja" : ""}" style="animation-delay:${k * 40}ms">
      <span class="pos">${f.posicion}</span>
      ${cohete(f.yo ? COLORES_JUGADOR[0] : COLORES_JUGADOR[(k % 5) + 1], "", 2, "", f.yo ? "propio" : f.modelo)}
      <span class="nombre">${escapar(f.alias)}<small>${t.diasJugados(f.dias)}</small></span>
      <span class="pts">${numero(f.puntos)}</span>
    </li>`;
  }).join("")}</ol>`;
}

ruta("liga", () => {
  const t = T();
  if (!ligaActiva()) return ir("inicio");
  const raiz = pantalla(`<div class="pantalla estrecha" data-liga></div>`);
  const cont = $("[data-liga]", raiz);

  function pintar(e, error = false) {
    const div = e ? e.division : 0;
    const vistoCambio = almacen.leer("hp_liga_cambio_visto", "");
    const anuncio = e && e.cambio !== 0 && vistoCambio !== e.semana
      ? `<p class="veredicto ${e.cambio > 0 ? "nuevo-record" : ""}">${e.cambio > 0 ? t.subiste(t.divisiones[div]) : t.bajaste(t.divisiones[div])}</p>` : "";
    if (anuncio) { almacen.guardar("hp_liga_cambio_visto", e.semana); if (e.cambio > 0) sonido.fin(); }
    cont.innerHTML = `
      <section class="liga-cabecera">
        <div class="escalera" aria-hidden="true">${SPRITE_DIVISION.map((p, k) =>
          `<span class="peldano${k === div ? " actual" : k < div ? " pasado" : ""}">${planeta(p, k === div ? 24 : 12, k > div ? "silueta" : "", 2)}</span>`).join("")}</div>
        <h1 class="destino">${t.divisiones[div]}</h1>
        ${anuncio}
        ${e ? `<span class="chip oscuro">⏱ ${tiempoRestante(e)}</span>` : ""}
      </section>
      ${error ? `<p class="mensaje error" style="text-align:center">${t.sinConexionLiga}</p>` : ""}
      ${e ? htmlClasificacion(e) : `<section class="caja"><p class="subtitulo" style="margin:0">${t.entraLiga}</p></section>`}
      <p class="aviso-pie">${t.ligaInfo}</p>
      <section class="caja" style="display:grid;gap:10px">
        <label class="etiqueta" for="alias-liga">${t.tuAlias}</label>
        <form class="fila" data-alias>
          <span class="campo chico"><input id="alias-liga" maxlength="16" value="${escapar(e?.alias || aliasLiga())}"></span>
          <button class="btn cian chico" type="submit">${t.guardar}</button>
        </form>
      </section>
      <button class="btn ancho" data-volver>${t.volver}</button>`;
    montarSprites(cont);
    $("[data-volver]", cont).addEventListener("click", () => ir("inicio"));
    $("[data-alias]", cont).addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const alias = $("#alias-liga", cont).value.trim();
      if (!alias) return;
      almacen.guardar("hp_liga_alias", alias);
      try { pintar(await registrar(alias, estado.cohete)); aviso(t.aliasGuardado); } catch { aviso(t.sinConexionLiga, "error"); }
    });
  }

  pintar(ligaGuardada());
  reintentarPendientes(aliasLiga(), estado.cohete)
    .then((e) => { if (cont.isConnected) pintar(e); })
    .catch(() => { if (cont.isConnected) pintar(ligaGuardada(), true); });
});
