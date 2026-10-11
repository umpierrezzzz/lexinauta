// El viaje por el universo: barra de progreso, racha y la pantalla del mapa con todo lo descubierto.
import { CAPITULOS, HITOS, estadoViaje, MAX_ESCUDOS } from "../motor.js";
import { $, T, ruta, ir, pantalla, escapar, capital, numero, planeta, cohete, COLORES_JUGADOR } from "../ui.js";
import { estadisticas, estado } from "../estado.js";

/** Barra de progreso del objeto alcanzado al siguiente, con el cohete. */
export function htmlProgresoViaje(viaje) {
  const t = T();
  const sig = viaje.siguiente;
  return `<div class="viaje-pista">
      ${planeta(viaje.alcanzado.id, 14, "", 2)}
      <div class="pista"><div class="pista-hecha" data-hecha></div><div class="pista-cohete" data-cohete-viaje>${cohete(COLORES_JUGADOR[0], "", 2)}</div></div>
      ${sig ? planeta(sig.id, 14, "silueta", 2) : ""}
    </div>
    <div class="viaje-pie"><span>${capital(t.destinoCorto[viaje.alcanzado.id])}</span>
      <span>${sig ? `${t.proximoDestino}: ??? · ${numero(sig.pts - viaje.puntos)} ${t.puntos}` : t.hasLlegado}</span></div>`;
}

/** Anima la barra de progreso (llamar después de montar la pantalla). `desde`: progreso inicial (0-1). */
export function animarProgreso(raiz, progreso, desde = null) {
  const hecha = $("[data-hecha]", raiz), cohete = $("[data-cohete-viaje]", raiz);
  if (!hecha) return;
  if (desde !== null) { hecha.style.width = cohete.style.left = `${desde * 100}%`; }
  requestAnimationFrame(() => requestAnimationFrame(() => {
    hecha.style.width = cohete.style.left = `${Math.round(progreso * 1000) / 10}%`;
  }));
}

export function htmlRacha(est) {
  const t = T();
  const escudos = Array.from({ length: MAX_ESCUDOS }, (_, k) => `<svg class="escudo${k < est.escudos ? " lleno" : ""}" viewBox="0 0 7 8"
    width="14" height="16" shape-rendering="crispEdges" aria-hidden="true"><path d="M0 0h7v4h-1v2h-1v1h-1v1h-1v-1h-1v-1h-1v-2h-1z"/>
    <path class="brillo" d="M1 1h2v1h-1v2h-1z"/></svg>`).join("");
  return `<div class="racha" title="${escapar(t.escudoInfo)}">
    <span class="racha-fuego${est.racha ? "" : " apagada"}">🔥 <b>${est.racha}</b> ${t.dias(est.racha).replace(/^\d+\s/, "")}</span>
    <span class="racha-escudos" aria-label="${t.escudos}: ${est.escudos}">${escudos}</span>
  </div>`;
}

ruta("universo", () => {
  const t = T();
  const est = estadisticas(estado.idioma);
  const viaje = estadoViaje(est.puntosViaje);

  const secciones = CAPITULOS.map((cap) => {
    const tarjetas = cap.hitos.map((h) => {
      const k = HITOS.findIndex((x) => x.id === h.id);
      const visto = k <= viaje.indice;
      const aqui = k === viaje.indice;
      return `<li class="objeto${visto ? "" : " oculto"}${aqui ? " aqui" : ""}">
        <div class="objeto-sprite">${planeta(h.id, 32, visto ? "" : "silueta", 2)}</div>
        <div class="objeto-texto">
          <h3>${visto ? capital(t.destinos[h.id]) : t.porDescubrir}</h3>
          <p class="objeto-dist">${h.km ? `${t.distancia(h.km)} ${t.desdeLaTierra}` : ""}</p>
          <p>${visto ? t.hechos[h.id] : t.faltan(numero(h.pts))}</p>
          ${aqui ? `<span class="chip amarillo">${cohete(COLORES_JUGADOR[0], "", 1)} ${t.estasAqui}</span>` : ""}
        </div>
      </li>`;
    }).join("");
    const abierto = cap.hitos[0].pts <= viaje.puntos;
    return `<section class="capitulo${abierto ? "" : " cerrado"}">
      <h2 class="seccion">${t.capitulo} ${CAPITULOS.indexOf(cap) + 1} · ${abierto ? t.capitulos[cap.id] : "???"}</h2>
      <ol class="objetos">${tarjetas}</ol>
    </section>`;
  }).join("");

  const raiz = pantalla(`<div class="pantalla estrecha universo">
    <div class="cabecera-pantalla">${planeta("andromeda", 24, "", 2)}<h1>${t.mapaUniverso}</h1></div>
    <section class="caja viaje">
      <div class="viaje-cabecera">
        <span class="viaje-km">${t.distancia(viaje.km)} <small>${t.desdeLaTierra}</small></span>
        ${htmlRacha(est)}
      </div>
      ${htmlProgresoViaje(viaje)}
      <p class="aviso-pie">${t.soloDiaria}</p>
    </section>
    ${secciones}
    <button class="btn ancho" data-volver>${t.volver}</button>
  </div>`);
  animarProgreso(raiz, viaje.progreso);
  $("[data-volver]", raiz).addEventListener("click", () => ir("inicio"));
  requestAnimationFrame(() => $(".objeto.aqui", raiz)?.scrollIntoView({ block: "center" }));
});
