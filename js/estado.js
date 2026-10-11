// Estado global y todo lo que se guarda en el navegador (historial, récords, nombre, idioma).
import { prepararCategoria } from "./motor.js";

export const almacen = {
  leer(clave, defecto) {
    try { const v = localStorage.getItem(clave); return v === null ? defecto : JSON.parse(v); } catch { return defecto; }
  },
  guardar(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* modo privado: se juega igual */ }
  },
};

function idiomaInicial() {
  const guardado = almacen.leer("hp_idioma", null);
  if (guardado) return guardado;
  return (navigator.language || "es").toLowerCase().startsWith("es") ? "es" : "en";
}

export const estado = {
  idioma: idiomaInicial(),
  datos: {},   // idioma → { ids, porId }
  fondo: null, // efectos del fondo (impulso)
};

export async function cargarDatos(idioma = estado.idioma) {
  if (estado.datos[idioma]) return estado.datos[idioma];
  const crudo = await (await fetch(`datos/${idioma}.json`)).json();
  const porId = {};
  for (const c of crudo.categorias) porId[c.id] = prepararCategoria(c, idioma);
  estado.datos[idioma] = { ids: crudo.categorias.map((c) => c.id), porId };
  return estado.datos[idioma];
}

export function cambiarIdioma(idioma) {
  estado.idioma = idioma;
  almacen.guardar("hp_idioma", idioma);
}

export function nombrePiloto() { return almacen.leer("hp_nombre", ""); }
export function guardarNombre(n) { almacen.guardar("hp_nombre", String(n || "").trim().slice(0, 16)); }

// ---------------------------------------------------------------- historial de la misión diaria

export function hoyISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function historial() { return almacen.leer("hp_historial", {}); }
export function guardarPartidaDiaria(idioma, partida, fecha = hoyISO()) {
  const h = historial();
  h[`${idioma}:${fecha}`] = partida;
  almacen.guardar("hp_historial", h);
}
export function partidaDeHoy(idioma) {
  const p = historial()[`${idioma}:${hoyISO()}`] || null;
  if (p && !p.etapas) p.etapas = p.resultados || [];   // partidas guardadas por el primer prototipo
  return p;
}

export function estadisticas(idioma) {
  const h = historial();
  const mias = Object.entries(h).filter(([k, p]) => k.startsWith(idioma + ":") && p.completa);
  const fechas = new Set(mias.map(([k]) => k.slice(idioma.length + 1)));
  let racha = 0;
  const d = new Date();
  if (!fechas.has(hoyISO(d))) d.setDate(d.getDate() - 1);   // la racha sigue viva si jugaste ayer
  while (fechas.has(hoyISO(d))) { racha++; d.setDate(d.getDate() - 1); }
  const diarios = Object.values(h).filter((p) => p.completa).reduce((s, p) => s + p.puntos, 0);
  return {
    partidas: mias.length, mejor: Math.max(0, ...mias.map(([, p]) => p.puntos)), racha,
    totalPuntos: diarios + almacen.leer("hp_viaje_extra", 0),
  };
}

/** Los otros modos también hacen avanzar el viaje, pero a un cuarto de velocidad (para que el diario siga mandando). */
export function sumarAlViaje(puntos) {
  almacen.guardar("hp_viaje_extra", almacen.leer("hp_viaje_extra", 0) + Math.round(puntos / 4));
}

// ---------------------------------------------------------------- récords por modo

export function record(modo, idioma = estado.idioma) { return almacen.leer("hp_records", {})[`${idioma}:${modo}`] || 0; }
/** Guarda el récord si se supera; devuelve true si es nuevo. */
export function registrarRecord(modo, valor, idioma = estado.idioma) {
  const r = almacen.leer("hp_records", {});
  const clave = `${idioma}:${modo}`;
  if (valor > (r[clave] || 0)) { r[clave] = valor; almacen.guardar("hp_records", r); return true; }
  return false;
}
