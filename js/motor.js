// Motor del juego: lógica pura, sin interfaz. Se usa desde app.js y desde los tests.
//
// Formato de las respuestas en los datos:  "nombre|variante|variante:rareza"
//   - nombre: cómo se muestra la respuesta
//   - variantes: otras formas válidas (sinónimos, grafías)
//   - rareza: 1 (muy común) … 5 (rarísima)

export const PUNTOS = [0, 10, 20, 35, 55, 85];
export const SEGUNDOS_POR_RONDA = 25;
export const PENALIZACION_FALLO = 3;   // segundos que quita una respuesta no válida
export const RONDAS = 7;
export const EPOCA = "2026-10-11";     // día del lanzamiento #1

// ---------------------------------------------------------------- texto

const ARTICULOS = {
  es: /^(el|la|los|las|un|una|unos|unas|lo) /,
  en: /^(the|a|an|some) /,
};

/** Minúsculas, sin tildes ni signos, sin artículo inicial. "El Taleggio" → "taleggio". */
export function normalizar(texto, idioma = "es") {
  const t = String(texto)
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // quita tildes y la virgulilla de la ñ
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.replace(ARTICULOS[idioma] || ARTICULOS.es, "");
}

/** Distancia de edición (Levenshtein) con corte temprano si supera `max`. */
export function distancia(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previa = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const fila = [i];
    let minimo = i;
    for (let j = 1; j <= b.length; j++) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1;
      fila[j] = Math.min(previa[j] + 1, fila[j - 1] + 1, previa[j - 1] + coste);
      minimo = Math.min(minimo, fila[j]);
    }
    if (minimo > max) return max + 1;
    previa = fila;
  }
  return previa[b.length];
}

/** Erratas permitidas según la longitud: nada en palabras cortas, 1 desde 5 letras, 2 desde 9. */
export function erratasPermitidas(longitud) {
  return longitud >= 9 ? 2 : longitud >= 5 ? 1 : 0;
}

// ---------------------------------------------------------------- categorías

/** Convierte los datos crudos de una categoría en una estructura con índice para buscar rápido. */
export function prepararCategoria(cruda, idioma) {
  const respuestas = [];
  const indice = new Map();
  for (const linea of cruda.respuestas) {
    const corte = linea.lastIndexOf(":");
    const rareza = Number(linea.slice(corte + 1));
    const formas = linea.slice(0, corte).split("|").map((f) => f.trim()).filter(Boolean);
    const respuesta = { nombre: formas[0], rareza, puntos: PUNTOS[rareza] };
    respuestas.push(respuesta);
    for (const forma of formas) {
      const clave = normalizar(forma, idioma);
      if (clave && !indice.has(clave)) indice.set(clave, respuesta);
    }
  }
  return { ...cruda, idioma, respuestas, indice };
}

/** Variantes de singular para probar si la entrada viene en plural. */
function singulares(t, idioma) {
  const v = [];
  if (idioma === "es") {
    if (t.endsWith("es")) v.push(t.slice(0, -2));
    if (t.endsWith("s")) v.push(t.slice(0, -1));
  } else {
    if (t.endsWith("ies")) v.push(t.slice(0, -3) + "y");
    if (t.endsWith("es")) v.push(t.slice(0, -2));
    if (t.endsWith("s")) v.push(t.slice(0, -1));
  }
  return v;
}

/**
 * Busca la entrada del jugador en una categoría preparada.
 * Devuelve { respuesta, exacta } o null si no es válida.
 */
export function buscar(categoria, entrada) {
  const t = normalizar(entrada, categoria.idioma);
  if (!t) return null;
  if (categoria.indice.has(t)) return { respuesta: categoria.indice.get(t), exacta: true };
  for (const s of singulares(t, categoria.idioma)) {
    if (categoria.indice.has(s)) return { respuesta: categoria.indice.get(s), exacta: true };
  }
  // Erratas: la clave más parecida dentro del margen permitido.
  const max = erratasPermitidas(t.length);
  if (!max) return null;
  let mejor = null;
  let mejorDist = max + 1;
  for (const [clave, respuesta] of categoria.indice) {
    if (erratasPermitidas(clave.length) === 0) continue;
    const d = distancia(t, clave, max);
    if (d < mejorDist) {
      mejor = respuesta;
      mejorDist = d;
      if (d === 1) break;
    }
  }
  return mejor && mejorDist <= max ? { respuesta: mejor, exacta: false } : null;
}

/** Algunas respuestas de ejemplo para enseñar al final de una ronda: las más raras primero. */
export function ejemplos(categoria, cuantas = 3, excluir = null) {
  return [...categoria.respuestas]
    .filter((r) => r !== excluir)
    .sort((a, b) => b.rareza - a.rareza || a.nombre.localeCompare(b.nombre))
    .slice(0, cuantas);
}

// ---------------------------------------------------------------- reto diario

/** Número de día desde la época (día 1 = lanzamiento #1), según la fecha local. */
export function numeroDeDia(fecha = new Date()) {
  const local = Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const [a, m, d] = EPOCA.split("-").map(Number);
  return Math.round((local - Date.UTC(a, m - 1, d)) / 86400000) + 1;
}

/** Generador pseudoaleatorio determinista (mulberry32). */
export function aleatorio(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function barajar(lista, semilla) {
  const r = aleatorio(semilla);
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Las categorías de un día. Las categorías se recorren en ciclos barajados: no se repite ninguna
 * hasta haber usado todas, y todos los jugadores del mismo idioma reciben las mismas.
 */
export function categoriasDelDia(ids, dia, n = RONDAS, sal = 7919) {
  const total = ids.length;
  const resultado = [];
  let pos = Math.max(dia - 1, 0) * n;
  while (resultado.length < Math.min(n, total)) {
    const ciclo = Math.floor(pos / total);
    const id = barajar(ids, ciclo * 104729 + sal)[pos % total];
    if (!resultado.includes(id)) resultado.push(id);
    pos++;
  }
  return resultado;
}

/** Categorías al azar para el modo práctica. */
export function categoriasPractica(ids, n = RONDAS) {
  return barajar(ids, Math.floor(Math.random() * 2 ** 31)).slice(0, n);
}

// ---------------------------------------------------------------- planetas y viaje

// Destino de la partida del día según los puntos (máximo 7 × 85 = 595).
export const DESTINOS_DIA = [
  { min: 0, id: "tierra" },
  { min: 1, id: "orbita" },
  { min: 60, id: "luna" },
  { min: 120, id: "marte" },
  { min: 180, id: "asteroides" },
  { min: 240, id: "jupiter" },
  { min: 300, id: "saturno" },
  { min: 360, id: "urano" },
  { min: 420, id: "neptuno" },
  { min: 480, id: "pluton" },
  { min: 560, id: "kuiper" },
];

export function destinoDelDia(puntos) {
  let destino = DESTINOS_DIA[0];
  for (const d of DESTINOS_DIA) if (puntos >= d.min) destino = d;
  return destino;
}

// Viaje acumulado: cada punto son 100.000 km. Distancias aproximadas desde la Tierra
// (para los planetas, la distancia media; sirven como hitos del viaje, no como efemérides).
export const KM_POR_PUNTO = 100000;
export const HITOS_VIAJE = [
  { km: 384400, id: "luna" },
  { km: 225e6, id: "marte" },
  { km: 400e6, id: "asteroides" },
  { km: 628e6, id: "jupiter" },
  { km: 1.28e9, id: "saturno" },
  { km: 2.72e9, id: "urano" },
  { km: 4.35e9, id: "neptuno" },
  { km: 5.9e9, id: "pluton" },
  { km: 7.5e9, id: "kuiper" },
  { km: 25e9, id: "voyager" },
];

/** Dónde está la nave en el viaje acumulado: último hito alcanzado, siguiente y progreso entre ambos. */
export function estadoViaje(puntosTotales) {
  const km = puntosTotales * KM_POR_PUNTO;
  let anterior = { km: 0, id: "tierra" };
  for (const h of HITOS_VIAJE) {
    if (km < h.km) {
      return { km, alcanzado: anterior, siguiente: h, progreso: (km - anterior.km) / (h.km - anterior.km) };
    }
    anterior = h;
  }
  return { km, alcanzado: anterior, siguiente: null, progreso: 1 };
}

// ---------------------------------------------------------------- compartir

const CUADROS = ["⬛", "🟦", "🟩", "🟨", "🟧", "🟥"];

export function textoCompartir({ titulo, dia, puntos, destino, rarezas }) {
  return `🚀 ${titulo} #${dia}\n${destino} · ${puntos}\n${rarezas.map((r) => CUADROS[r || 0]).join("")}`;
}

// ---------------------------------------------------------------- modos de juego

export const MODOS = {
  diario: { rondas: 7, segundos: 25 },
  practica: { rondas: 7, segundos: 25 },
  reto: { rondas: 7, segundos: 25 },
  local: { rondas: 7, segundos: 25 },
  online: { rondas: 7, segundos: 25 },
  lluvia: { total: 60 },      // una categoría, todas las respuestas que puedas
  maraton: { total: 90 },     // categorías sin parar; las raras dan tiempo extra
};

// Maratón: segundos extra según la rareza, y lo que cuesta saltar una categoría.
export const BONUS_MARATON = [0, 0, 1, 2, 3, 5];
export const COSTE_SALTO = 4;

/** Categorías al azar pero reproducibles a partir de una semilla (para retos y salas online). */
export function categoriasPorSemilla(ids, semilla, n = RONDAS) {
  return barajar(ids, semilla >>> 0).slice(0, n);
}

/** Semilla aleatoria de 31 bits. */
export function nuevaSemilla() { return Math.floor(Math.random() * 2 ** 31); }

/**
 * Choques: si dos o más jugadores dan la misma respuesta en una ronda, cada uno se lleva la mitad.
 * Recibe { jugador: {respuesta, puntos} } y devuelve { jugador: {puntos, choque} }.
 */
export function resolverChoques(respuestas) {
  const cuenta = {};
  for (const r of Object.values(respuestas)) if (r.respuesta) cuenta[r.respuesta] = (cuenta[r.respuesta] || 0) + 1;
  const final = {};
  for (const [j, r] of Object.entries(respuestas)) {
    const choque = !!r.respuesta && cuenta[r.respuesta] > 1;
    final[j] = { ...r, choque, puntos: choque ? Math.ceil(r.puntos / 2) : r.puntos };
  }
  return final;
}

// ---------------------------------------------------------------- retos por enlace

function aBase64Url(texto) {
  const bytes = new TextEncoder().encode(texto);
  let bin = ""; bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function deBase64Url(codigo) {
  const b64 = codigo.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((codigo.length + 3) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Empaqueta un reto: idioma, categorías, nombre del retador y sus resultados. */
export function codificarReto({ idioma, categorias, nombre, resultados }) {
  return aBase64Url(JSON.stringify({
    v: 1, i: idioma, c: categorias, n: String(nombre || "").slice(0, 20),
    r: resultados.map((r) => [r.respuesta || "", r.rareza, r.puntos]),
  }));
}

export function decodificarReto(codigo) {
  try {
    const d = JSON.parse(deBase64Url(codigo));
    if (d.v !== 1 || !Array.isArray(d.c) || !Array.isArray(d.r)) return null;
    return {
      idioma: d.i === "en" ? "en" : "es", categorias: d.c.slice(0, RONDAS).map(String), nombre: String(d.n || ""),
      resultados: d.r.slice(0, RONDAS).map(([respuesta, rareza, puntos], k) => ({
        categoria: d.c[k], respuesta: respuesta || null, rareza: Number(rareza) || 0, puntos: Number(puntos) || 0,
      })),
    };
  } catch {
    return null;
  }
}
