// Hangar: los cohetes que se desbloquean con la racha y el viaje. El elegido es el que vuela en todas las partidas.
import { COHETES, coheteDesbloqueado } from "../motor.js";
import { $, T, ruta, ir, pantalla, cohete, aviso, COLORES_JUGADOR, montarSprites } from "../ui.js";
import { estado, estadisticas, elegirCohete, almacen } from "../estado.js";
import { sonido } from "../sonido.js";

function requisito(c) {
  const t = T();
  if (c.racha) return t.requisitoRacha(c.racha);
  if (c.viaje) return t.requisitoViaje(t.destinoCorto[c.viaje]);
  return "";
}

/** Cohetes desbloqueados que el jugador todavía no ha visto (para anunciarlos una vez). */
export function cohetesNuevos() {
  const est = estadisticas(estado.idioma);
  const libres = COHETES.filter((c) => coheteDesbloqueado(c, est)).map((c) => c.id);
  const vistos = almacen.leer("hp_cohetes_vistos", null);
  almacen.guardar("hp_cohetes_vistos", libres);
  if (!vistos) return [];
  return libres.filter((id) => !vistos.includes(id));
}

export function htmlCoheteNuevo(id) {
  const t = T();
  return `<div class="descubrimiento cohete-nuevo">${cohete(COLORES_JUGADOR[0], "", 3, "", id)}
    <div><b>${t.nuevoCohete}</b><p>${t.cohetes[id]}</p>
    <button class="btn chico amarillo" data-estrenar="${id}">${t.elegir}</button></div></div>`;
}

/** Engancha los botones «Elegir» de los cohetes nuevos. */
export function activarEstrenar(raiz) {
  raiz.querySelectorAll("[data-estrenar]").forEach((b) => b.addEventListener("click", () => {
    elegirCohete(b.dataset.estrenar);
    sonido.planeta();
    b.disabled = true;
    b.textContent = T().elegido;
  }));
}

ruta("hangar", () => {
  const t = T();
  const est = estadisticas(estado.idioma);
  const raiz = pantalla(`<div class="pantalla estrecha">
    <div class="cabecera-pantalla" data-cabecera></div>
    <ul class="hangar" data-hangar></ul>
    <button class="btn ancho" data-volver>${t.volver}</button>
  </div>`);

  const lista = $("[data-hangar]", raiz), cabecera = $("[data-cabecera]", raiz);
  function pintar() {
    cabecera.innerHTML = `${cohete(COLORES_JUGADOR[0], "", 2)}<h1>${t.hangar}</h1>`;
    montarSprites(cabecera);
    lista.innerHTML = COHETES.map((c) => {
      const libre = coheteDesbloqueado(c, est);
      const usado = estado.cohete === c.id;
      return `<li class="caja hueco${libre ? "" : " bloqueado"}${usado ? " usado" : ""}">
        <div class="hueco-sprite">${cohete(COLORES_JUGADOR[0], libre ? "" : "silueta", 3, "", c.id)}</div>
        <h3>${libre ? t.cohetes[c.id] : "???"}</h3>
        <p>${libre ? (usado ? `<span class="chip verde">${t.elegido}</span>` : "") : `🔒 ${requisito(c)}`}</p>
        ${libre && !usado ? `<button class="btn chico cian" data-elegir="${c.id}">${t.elegir}</button>` : ""}
      </li>`;
    }).join("");
    montarSprites(lista);
  }
  pintar();
  lista.addEventListener("click", (e) => {
    const b = e.target.closest("[data-elegir]");
    if (!b) return;
    elegirCohete(b.dataset.elegir);
    sonido.despegue();
    estado.fondo?.impulso(40, "#4de1ff");
    aviso(`${t.tuCohete}: ${t.cohetes[b.dataset.elegir]}`);
    pintar();
  });
  $("[data-volver]", raiz).addEventListener("click", () => ir("inicio"));
});

