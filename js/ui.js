// Utilidades de interfaz compartidas por todas las pantallas: navegación, sprites, efectos.
import { canvasPlaneta, canvasCohete } from "./pixel.js";
import { TEXTOS } from "./textos.js";
import { estado } from "./estado.js";

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

export const COLOR_RAREZA = ["#5a6185", "#5aa9ff", "#3ddc84", "#ffd23f", "#ff8a3d", "#ff4f9a"];
export const RGB_RAREZA = ["#8a90b0", "#5aa9ff", "#3ddc84", "#ffd23f", "#ff8a3d", "#ff4f9a"];
export const COLORES_JUGADOR = ["#ff4f6a", "#4de1ff", "#ffd23f", "#3ddc84", "#b77dff", "#ff9a3d"];

export const T = () => TEXTOS[estado.idioma];

export function escapar(t) {
  return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export function capital(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; }
export function numero(n) { return Math.round(n).toLocaleString(estado.idioma === "es" ? "es-ES" : "en-GB"); }

// ---------------------------------------------------------------- navegación

const rutas = {};
let limpiezaActual = null;

/** Registra una pantalla: `fn(...args)` la pinta y puede devolver una función de limpieza. */
export function ruta(nombre, fn) { rutas[nombre] = fn; }

/** Va a otra pantalla. */
export function ir(nombre, ...args) {
  if (typeof limpiezaActual === "function") { try { limpiezaActual(); } catch { /* nada */ } }
  limpiezaActual = null;
  const resultado = rutas[nombre](...args);
  if (typeof resultado === "function") limpiezaActual = resultado;
  window.scrollTo({ top: 0 });
}

/** Pone el HTML de la pantalla y monta los sprites (elementos con data-planeta / data-cohete). */
export function pantalla(html, clase = "") {
  const main = $("#pantalla");
  main.className = `pantalla ${clase}`;
  main.innerHTML = html;
  montarSprites(main);
  main.classList.remove("entra"); void main.offsetWidth; main.classList.add("entra");
  return main;
}

/** Sustituye los marcadores <i data-planeta="marte" data-tam="32"> y <i data-cohete="#color"> por canvas animados. */
export function montarSprites(raiz) {
  $$("[data-planeta]:not(canvas)", raiz).forEach((el) => {
    const c = canvasPlaneta(el.dataset.planeta, Number(el.dataset.tam || 32), el.className);
    c.style.setProperty("--w", c.width);
    if (el.dataset.escala) c.style.setProperty("--escala", el.dataset.escala);
    el.replaceWith(c);
  });
  $$("[data-cohete]:not(canvas)", raiz).forEach((el) => {
    const c = canvasCohete(el.dataset.cohete || COLORES_JUGADOR[0], el.className);
    c.style.setProperty("--w", c.width);
    if (el.dataset.escala) c.style.setProperty("--escala", el.dataset.escala);
    if (el.dataset.jugador) c.dataset.jugador = el.dataset.jugador;
    el.replaceWith(c);
  });
}

/** Marcadores de sprite para las plantillas. Sin `escala`, el tamaño lo decide el CSS (--escala). */
export function planeta(tipo, tam = 32, clase = "", escala = null) {
  return `<i data-planeta="${tipo}" data-tam="${tam}" class="${clase}"${escala ? ` data-escala="${escala}"` : ""}></i>`;
}
export function cohete(color, clase = "", escala = null, jugador = "") {
  return `<i data-cohete="${color}" class="${clase}"${escala ? ` data-escala="${escala}"` : ""}${jugador !== "" ? ` data-jugador="${jugador}"` : ""}></i>`;
}

// ---------------------------------------------------------------- piezas comunes

/** Barra de combustible segmentada (pixel). */
export function barraSegmentos(segmentos, clase = "") {
  return `<div class="segmentos ${clase}" style="--n:${segmentos}">${"<i></i>".repeat(segmentos)}</div>`;
}
export function rellenarSegmentos(barra, fraccion) {
  const segs = barra.children, n = segs.length;
  const llenos = Math.ceil(fraccion * n - 1e-6);
  for (let i = 0; i < n; i++) segs[i].classList.toggle("lleno", i < llenos);
  barra.classList.toggle("poco", fraccion <= 0.2);
}

/** Puntos flotantes (+55) y explosión de partículas pixeladas. */
export function efectoPuntos(texto, rareza, ancla) {
  const caja = (ancla || $("#pantalla")).getBoundingClientRect();
  const x = caja.left + caja.width / 2, y = caja.top + 10;
  const f = document.createElement("div");
  f.className = "flotante";
  f.style.setProperty("--c", COLOR_RAREZA[rareza]);
  f.style.left = `${x}px`; f.style.top = `${y}px`;
  f.textContent = texto;
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1300);
  if (rareza >= 4 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const n = rareza === 5 ? 32 : 18;
    for (let i = 0; i < n; i++) {
      const p = document.createElement("div");
      p.className = "particula";
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const dist = 60 + Math.random() * (rareza === 5 ? 170 : 100);
      p.style.setProperty("--c", COLOR_RAREZA[Math.random() < 0.3 ? 3 : rareza]);
      p.style.setProperty("--dx", `${Math.round(Math.cos(ang) * dist / 4) * 4}px`);
      p.style.setProperty("--dy", `${Math.round(Math.sin(ang) * dist / 4) * 4}px`);
      p.style.left = `${Math.round(x / 4) * 4}px`; p.style.top = `${Math.round(y / 4) * 4}px`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1100);
    }
  }
}

/** Mensaje breve en la parte de abajo. */
export function aviso(texto, tipo = "") {
  $$(".aviso-flotante").forEach((v) => v.remove());
  const a = document.createElement("div");
  a.className = `aviso-flotante ${tipo}`;
  a.textContent = texto;
  document.body.appendChild(a);
  setTimeout(() => a.classList.add("fuera"), 2200);
  setTimeout(() => a.remove(), 2700);
}

export async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch { return false; }
}

/** Comparte con el menú nativo del móvil si existe; si no, copia al portapapeles. */
export async function compartirTexto(texto, avisoCopiado) {
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) { await navigator.share({ text: texto }); return; }
  } catch { /* cancelado */ }
  if (await copiar(texto)) aviso(avisoCopiado);
  else prompt("", texto);
}

/** Anima un número de 0 a `hasta`. */
export function contar(el, hasta, dur = 1100) {
  const inicio = performance.now();
  const paso = (ahora) => {
    const k = Math.min((ahora - inicio) / dur, 1);
    el.textContent = numero(hasta * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

export function cuentaAtrasHastaManana() {
  const ahora = new Date();
  const manana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1);
  const s = Math.max(0, Math.floor((manana - ahora) / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
}
setInterval(() => $$("[data-cuenta]").forEach((el) => { el.textContent = cuentaAtrasHastaManana(); }), 1000);

export function vibrar(patron) { if (navigator.vibrate) navigator.vibrate(patron); }
