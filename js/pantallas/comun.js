// Piezas de juego compartidas por todos los modos: altímetro, temporizador, tarjeta de categoría y resultado de etapa.
import { buscar, ejemplos, PENALIZACION_FALLO } from "../motor.js";
import { $, $$, T, escapar, capital, planeta, cohete, barraSegmentos, rellenarSegmentos, efectoPuntos, aviso,
  COLOR_RAREZA, montarSprites, vibrar } from "../ui.js";
import { sonido } from "../sonido.js";
import { estado } from "../estado.js";

// ---------------------------------------------------------------- altímetro (la ruta del sistema solar)

// Los planetas de la ruta con los puntos que hacen falta para llegar (los mismos que DESTINOS_DIA).
// `menor`: se oculta en el altímetro horizontal del móvil para que no se amontonen.
export const RUTA = [
  { id: "tierra", min: 0 }, { id: "luna", min: 60 }, { id: "marte", min: 120 }, { id: "asteroides", min: 180, menor: true },
  { id: "jupiter", min: 240 }, { id: "saturno", min: 300 }, { id: "urano", min: 360, menor: true },
  { id: "neptuno", min: 420 }, { id: "pluton", min: 480 }, { id: "kuiper", min: 560, menor: true },
];
const TOPE = 595;
const pos = (p) => `${(Math.min(p, TOPE) / TOPE) * 100}%`;

/** La ruta de la misión diaria: el tramo del universo que puede recorrer hoy el cohete (desde donde se quedó ayer). */
export function rutaDelViaje(tramo) {
  const ruta = [{ id: tramo.inicio.id, min: 0 }, ...tramo.dentro.map((h) => ({ id: h.id, min: h.pts - tramo.desde, hito: true }))];
  if (tramo.despues) ruta.push({ id: tramo.despues.id, min: TOPE, lejos: true });
  // En el móvil, si hay muchos, se ocultan los intermedios alternos
  if (ruta.length > 7) ruta.forEach((r, k) => { if (k % 2 && k < ruta.length - 1) r.menor = true; });
  return ruta;
}

/** `jugadores`: [{color}] — un cohete por jugador. `ruta`: los objetos del camino (por defecto, el sistema solar). */
export function htmlAltimetro(jugadores, ruta = RUTA) {
  const t = T();
  return `<div class="altimetro" aria-hidden="true">
    <div class="alt-progreso"></div>
    ${ruta.map((r) => `<div class="alt-planeta${r.menor ? " menor" : ""}${r.lejos ? " lejos" : ""}" data-min="${r.lejos ? 99999 : r.min}"
      data-id="${r.id}" style="--pos:${pos(r.min)}">${planeta(r.id, 12)}<span>${t.destinoCorto[r.id]}</span></div>`).join("")}
    ${jugadores.map((j, i) => `<div class="alt-cohete n${i}" data-j="${i}" style="--pos:0%">${cohete(j.color, "", null, "", j.modelo)}</div>`).join("")}
  </div>`;
}

/** Mueve los cohetes. Devuelve el objeto más lejano que se acaba de pasar (o null). */
export function moverAltimetro(raiz, puntos) {
  const alt = $(".altimetro", raiz);
  if (!alt) return null;
  puntos.forEach((p, i) => {
    const c = $(`.alt-cohete[data-j="${i}"]`, alt);
    if (!c) return;
    if (c.style.getPropertyValue("--pos") !== pos(p)) {
      const lienzo = $("canvas", c);
      if (lienzo) lienzo.__empuje = 2.2;
    }
    c.style.setProperty("--pos", pos(p));
  });
  const max = Math.max(0, ...puntos);
  const antes = Number(alt.dataset.max || 0);
  alt.dataset.max = max;
  alt.querySelector(".alt-progreso").style.setProperty("--pos", pos(max));
  let pasado = null;
  $$(".alt-planeta", alt).forEach((el) => {
    const min = Number(el.dataset.min);
    el.classList.toggle("pasado", min > 0 && max >= min);
    if (min > 0 && antes < min && max >= min) pasado = el.dataset.id;
  });
  return pasado;
}

/** Sonido y aviso al cruzar un planeta. */
export function celebrarPlaneta(id, descubrimiento = false) {
  if (!id) return;
  const pantallaActual = $("#pantalla").firstElementChild;
  setTimeout(() => {
    if (!pantallaActual?.isConnected) return;   // ya se ha cambiado de pantalla
    sonido.planeta();
    aviso(descubrimiento ? `${T().nuevoDescubrimiento} ${capital(T().destinos[id])}` : T().pasado(T().destinos[id]));
  }, 650);
}

// ---------------------------------------------------------------- temporizador (combustible)

/**
 * Cuenta atrás con penalizaciones y bonus. Pinta una barra de segmentos y un número.
 * `total` es lo que representa la barra llena.
 */
export function temporizador({ segundos, total = segundos, barra, numero, alAcabar }) {
  let fin = performance.now() + segundos * 1000;
  let ultimoEntero = segundos;
  let parado = false;
  const pintar = () => {
    const resto = Math.max(0, fin - performance.now());
    rellenarSegmentos(barra, Math.min(1, resto / (total * 1000)));
    const entero = Math.ceil(resto / 1000);
    numero.textContent = entero;
    if (entero !== ultimoEntero) {
      if (entero <= 5 && entero > 0) sonido.tic();
      ultimoEntero = entero;
    }
    return resto;
  };
  pintar();
  const id = setInterval(() => {
    if (parado) return;
    if (!barra.isConnected) { clearInterval(id); return; }   // se ha salido de la pantalla
    if (pintar() <= 0) { parado = true; clearInterval(id); alAcabar(); }
  }, 100);
  return {
    quitar(s) { fin -= s * 1000; pintar(); },
    anadir(s) { fin += s * 1000; pintar(); },
    parar() { parado = true; clearInterval(id); },
    get restante() { return Math.max(0, fin - performance.now()) / 1000; },
  };
}

// ---------------------------------------------------------------- tarjeta de categoría

const FLECHA = `<svg viewBox="0 0 7 7" width="21" height="21" shape-rendering="crispEdges" aria-hidden="true"><path d="M3 0h1v1h1v1h1v1h1v1h-1v1h-1v1h-1v1h-1v-2h-3v-3h3z" fill="currentColor"/></svg>`;

export function htmlTarjeta(cat, { etiqueta = "", segmentos = 25, pie = "" } = {}) {
  const t = T();
  return `<article class="caja clara tarjeta entra">
    <div class="icono-cat" data-icono>${cat.icono}</div>
    ${etiqueta ? `<p class="etiqueta">${etiqueta}</p>` : ""}
    <h2 class="nombre-cat" data-nombre>${escapar(cat.nombre)}</h2>
    <div>
      ${barraSegmentos(segmentos)}
      <div class="combustible-texto"><span>${t.combustible}</span><b data-segundos></b></div>
    </div>
    <form class="entrada" autocomplete="off">
      <div class="campo"><input name="respuesta" type="text" enterkeyhint="send" autocapitalize="off" autocorrect="off"
        spellcheck="false" maxlength="60" placeholder="${t.escribe}" aria-label="${t.escribe}"></div>
      <button type="submit" class="btn cian" aria-label="${t.enviar}">${FLECHA}</button>
    </form>
    <p class="mensaje" role="status" aria-live="polite"></p>
    ${pie}
  </article>`;
}

/** Marca un fallo en la tarjeta (temblor, mensaje, sonido). */
export function marcarFallo(tarjeta, texto) {
  const campo = $(".campo", tarjeta), msg = $(".mensaje", tarjeta), input = $("input", tarjeta);
  campo.classList.remove("error"); void campo.offsetWidth; campo.classList.add("error");
  msg.className = "mensaje error";
  msg.textContent = texto;
  sonido.fallo();
  vibrar(60);
  input.select();
}

export function enfocar(input) {
  setTimeout(() => { try { input.focus({ preventScroll: true }); } catch { /* nada */ } }, 60);
}

/**
 * Una etapa clásica: una categoría, una respuesta, con combustible limitado.
 * Resuelve con { respuesta, rareza, puntos, escrito } (respuesta null si se acabó el tiempo).
 */
export function jugarEtapa(cont, cat, { segundos = 25, etiqueta = "" } = {}) {
  return new Promise((resolver) => {
    cont.innerHTML = htmlTarjeta(cat, { etiqueta });
    const tarjeta = $(".tarjeta", cont), form = $("form", tarjeta), input = $("input", tarjeta);
    let terminado = false;
    const terminar = (res) => {
      if (terminado) return;
      terminado = true;
      reloj.parar();
      input.blur();
      resolver(res);
    };
    const reloj = temporizador({
      segundos, barra: $(".segmentos", tarjeta), numero: $("[data-segundos]", tarjeta),
      alAcabar: () => { sonido.sinTiempo(); terminar({ respuesta: null, rareza: 0, puntos: 0, escrito: "" }); },
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (terminado) return;
      const escrito = input.value.trim();
      if (!escrito) return;
      const r = buscar(cat, escrito);
      if (!r) {
        reloj.quitar(PENALIZACION_FALLO);
        marcarFallo(tarjeta, `${T().noValida} · −${PENALIZACION_FALLO} s`);
        return;
      }
      terminar({ respuesta: r.respuesta.nombre, rareza: r.respuesta.rareza, puntos: r.respuesta.puntos, escrito });
    });
    enfocar(input);
  });
}

/** Fiesta al acertar: sonido, número flotante, partículas, acelerón del fondo. */
export function celebrar(res, ancla) {
  if (!res.respuesta) return;
  sonido.acierto(res.rareza);
  efectoPuntos(`+${res.puntos}`, res.rareza, ancla);
  estado.fondo?.impulso(res.puntos, COLOR_RAREZA[res.rareza]);
  if (res.rareza >= 4) vibrar([30, 40, 60]);
}

// ---------------------------------------------------------------- resultado de una etapa (un jugador)

export function htmlRespuestas(lista) {
  return `<ul class="lista-chips">${lista.map((r) =>
    `<li style="--c:${COLOR_RAREZA[r.rareza]}">${escapar(capital(r.nombre))}<small>${r.puntos}</small></li>`).join("")}</ul>`;
}

export function htmlResultadoEtapa(cat, res, { boton, rival = null } = {}) {
  const t = T();
  const propia = res.respuesta ? cat.respuestas.find((r) => r.nombre === res.respuesta) : null;
  return `<article class="caja clara resultado-etapa tarjeta entra" style="--c:${COLOR_RAREZA[res.rareza]}">
    <div class="puntos-etapa">+${res.puntos}</div>
    <span class="rareza">${res.respuesta ? t.rareza[res.rareza] : t.sinTiempo}</span>
    ${res.respuesta ? `<p class="respuesta-dada">${escapar(capital(res.respuesta))}
      ${res.escrito && res.escrito.toLowerCase() !== res.respuesta.toLowerCase() ? `<small>«${escapar(res.escrito)}»</small>` : ""}</p>` : ""}
    ${rival ? `<p class="suave">${escapar(rival.nombre)}: <b style="color:${COLOR_RAREZA[rival.rareza]}">${rival.respuesta ? escapar(capital(rival.respuesta)) : "—"} · +${rival.puntos}</b></p>` : ""}
    <div class="lejanas">
      <span class="etiqueta">${t.respuestasLejanas}</span>
      ${htmlRespuestas(ejemplos(cat, 5, propia))}
    </div>
    <button class="btn amarillo grande ancho" data-seguir>${boton}</button>
  </article>`;
}

/** Espera a que se pulse el botón [data-seguir] (o Enter). */
export function esperarSeguir(cont) {
  return new Promise((resolver) => {
    const b = $("[data-seguir]", cont);
    if (!b) { resolver(); return; }
    b.addEventListener("click", () => { sonido.clic(); resolver(); }, { once: true });
    setTimeout(() => b.focus({ preventScroll: true }), 400);
  });
}

/** Barras de etapas (arriba del todo). */
export function htmlEtapas(n) {
  return `<div class="etapas" style="--n:${n}">${"<i></i>".repeat(n)}</div>`;
}
export function pintarEtapas(raiz, actual, rarezas) {
  $$(".etapas i", raiz).forEach((el, i) => {
    el.className = i < rarezas.length ? "hecha" : i === actual ? "actual" : "";
    if (i < rarezas.length) el.style.setProperty("--c", COLOR_RAREZA[rarezas[i]]);
  });
}

export { montarSprites };
