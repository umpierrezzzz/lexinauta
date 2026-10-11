// Motor de pixel art: planetas que giran (esferas sombreadas con tramado) y el cohete.
// Todo se dibuja en <canvas> pequeños y se escala con `image-rendering: pixelated`.

// ---------------------------------------------------------------- ruido determinista

function hash(x, y, z = 0) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function suave(t) { return t * t * (3 - 2 * t); }
function ruido(x, y, semilla = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = hash(xi, yi, semilla), b = hash(xi + 1, yi, semilla);
  const c = hash(xi, yi + 1, semilla), d = hash(xi + 1, yi + 1, semilla);
  const u = suave(xf), v = suave(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, semilla = 0, octavas = 4) {
  let total = 0, amp = 0.5, f = 1;
  for (let i = 0; i < octavas; i++) { total += amp * ruido(x * f, y * f, semilla + i * 17); f *= 2; amp *= 0.5; }
  return total;
}

// Tramado ordenado 4×4 (Bayer): el sombreado típico del pixel art.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);
function tramar(valor, x, y, niveles) {
  const v = valor * (niveles - 1) + BAYER[(y & 3) * 4 + (x & 3)] * 0.6;
  return Math.max(0, Math.min(niveles - 1, Math.round(v)));
}

function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
const R = (...cs) => cs.map(hex);   // rampa de colores, de oscuro a claro

// ---------------------------------------------------------------- planetas

const RAMPAS = {
  oceano: R("#0a1238", "#11257a", "#1b48b8", "#2f7be6", "#7cc4ff"),
  tierra: R("#0f2a1a", "#1c5130", "#2f7d3c", "#5bb04f", "#a7e07b"),
  nube: R("#5a6488", "#9aa4c8", "#dfe6ff", "#ffffff"),
  luna: R("#1c1c2c", "#3c3c52", "#666680", "#9a9ab2", "#d8d8e6"),
  marte: R("#2a0a08", "#5e170c", "#9c2f17", "#d4572a", "#ff9a5c"),
  jupiterA: R("#3a2014", "#7a4524", "#b8794a", "#e3b27d", "#fbe2bb"),
  jupiterB: R("#2c1810", "#5e3220", "#8f5133", "#c47e56", "#e8b48d"),
  mancha: R("#4a1208", "#8c2a12", "#c84a24", "#ee7a46"),
  saturno: R("#3a2e14", "#7a6230", "#b89a56", "#e6cd8a", "#fff0c2"),
  anillo: R("#4a3c22", "#8c7448", "#c8ad74", "#efdba6"),
  urano: R("#0e3a44", "#1b6b78", "#36a8b4", "#76dde2", "#c8fbff"),
  neptuno: R("#08103e", "#132886", "#2448d0", "#4d7cf6", "#9ab8ff"),
  pluton: R("#26160e", "#5a3a26", "#9a7050", "#cfa77e", "#f3dcc0"),
  corazon: R("#8c7a68", "#c8b49c", "#f2e6d4", "#fffaf0"),
  roca: R("#1e1a16", "#3e3528", "#6a5a44", "#9a8668", "#cbb898"),
  hielo: R("#1a2a40", "#3a5a80", "#6d94c0", "#a8cdf0", "#effaff"),
  sol: R("#7a2a00", "#d45a00", "#ff9a1a", "#ffd23f", "#fff6c8"),
  gigante: R("#3a0600", "#7a1608", "#c0381a", "#ff6a30", "#ffb070"),
};

// Cada tipo de planeta devuelve, para un punto de su superficie (lon, lat en radianes), la rampa
// y el brillo base (0-1) antes de aplicar la luz.
const SUPERFICIES = {
  tierra(lon, lat) {
    const n = fbm(lon * 1.6 + 10, lat * 2.2 + 3, 1, 5);
    const nubes = fbm(lon * 2.4 + 40, lat * 4 + 9, 7, 4);
    if (Math.abs(lat) > 1.25) return ["nube", 0.95];
    if (nubes > 0.62) return ["nube", 0.7 + (nubes - 0.62)];
    return n > 0.52 ? ["tierra", 0.35 + (n - 0.52) * 2.2] : ["oceano", 0.45 + n * 0.5];
  },
  luna(lon, lat) {
    const n = fbm(lon * 2 + 5, lat * 2 + 1, 3, 4);
    const crater = ruido(lon * 3.2, lat * 3.2, 11);
    return ["luna", 0.55 + (n - 0.5) * 0.6 - (crater > 0.72 ? 0.35 : 0)];
  },
  marte(lon, lat) {
    if (Math.abs(lat) > 1.3) return ["nube", 0.9];
    const n = fbm(lon * 1.8 + 2, lat * 2.4, 5, 4);
    return ["marte", 0.45 + (n - 0.5) * 0.9];
  },
  jupiter(lon, lat) {
    const turb = fbm(lon * 2 + 3, lat * 6, 9, 3) * 0.35;
    const banda = Math.sin((lat + turb) * 9);
    // Gran mancha roja
    const dl = ((lon % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - 3.6, dt = lat + 0.38;
    if (dl * dl / 0.16 + dt * dt / 0.02 < 1) return ["mancha", 0.65 - (dl * dl / 0.16 + dt * dt / 0.02) * 0.3];
    return banda > 0 ? ["jupiterA", 0.55 + banda * 0.3] : ["jupiterB", 0.5 - banda * 0.2];
  },
  saturno(lon, lat) {
    const banda = Math.sin((lat + fbm(lon, lat * 5, 4, 2) * 0.15) * 11);
    return ["saturno", 0.58 + banda * 0.18];
  },
  urano(lon, lat) {
    return ["urano", 0.62 + Math.sin(lat * 5) * 0.06];
  },
  neptuno(lon, lat) {
    const dl = ((lon % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - 2, dt = lat + 0.35;
    if (dl * dl / 0.08 + dt * dt / 0.02 < 1) return ["neptuno", 0.12];
    return ["neptuno", 0.55 + Math.sin((lat + fbm(lon * 2, lat * 4, 2, 3) * 0.2) * 8) * 0.12];
  },
  pluton(lon, lat) {
    // El «corazón» (región Tombaugh)
    const dl = ((lon % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - 1.2, dt = lat - 0.1;
    const corazon = (dl * dl) / 0.35 + (dt * dt) / 0.25;
    if (corazon < 1) return ["corazon", 0.8 - corazon * 0.3];
    return ["pluton", 0.5 + (fbm(lon * 2, lat * 2, 8, 4) - 0.5) * 0.8];
  },
  roca(lon, lat) {
    const crater = ruido(lon * 3, lat * 3, 21);
    return ["roca", 0.5 + (fbm(lon * 2.5, lat * 2.5, 13, 3) - 0.5) * 0.8 - (crater > 0.75 ? 0.3 : 0)];
  },
  hielo(lon, lat) {
    return ["hielo", 0.6 + (fbm(lon * 3, lat * 3, 17, 3) - 0.5) * 0.7];
  },
  gigante(lon, lat, t) {
    // Supergigante roja: grandes celdas de convección que cambian despacio
    const celdas = 1 - Math.abs(fbm(lon * 1.4 + t * 0.05, lat * 1.4, 121, 3) * 2 - 1);
    return ["gigante", 0.3 + celdas * 0.42];
  },
  sol(lon, lat, t) {
    return ["sol", 0.75 + (fbm(lon * 3 + t * 0.4, lat * 3, 31, 3) - 0.5) * 0.6];
  },
};

// Qué superficie y qué extras usa cada destino del juego.
export const PLANETAS = {
  tierra: { superficie: "tierra", velocidad: 0.25, atmosfera: [125, 200, 255] },
  orbita: { superficie: "tierra", velocidad: 0.25, atmosfera: [125, 200, 255], orbita: true },
  luna: { superficie: "luna", velocidad: 0.12 },
  marte: { superficie: "marte", velocidad: 0.22, atmosfera: [255, 140, 100] },
  asteroides: { superficie: "roca", velocidad: 0.35, irregular: 0.22, satelites: 3 },
  jupiter: { superficie: "jupiter", velocidad: 0.45 },
  saturno: { superficie: "saturno", velocidad: 0.4, anillos: true },
  urano: { superficie: "urano", velocidad: 0.3, atmosfera: [150, 240, 245] },
  neptuno: { superficie: "neptuno", velocidad: 0.33, atmosfera: [110, 140, 255] },
  pluton: { superficie: "pluton", velocidad: 0.15 },
  kuiper: { superficie: "hielo", velocidad: 0.3, irregular: 0.18 },
  voyager: { sonda: true },
  sol: { superficie: "sol", velocidad: 0.1, brillo: true },
  betelgeuse: { superficie: "gigante", velocidad: 0.04, brillo: true, halo: [255, 120, 70] },
  ...Object.fromEntries(["oort", "alfacentauri", "sirio", "vega", "pleyades", "orion", "centro", "magallanes", "andromeda",
    "triangulo", "m87", "laniakea", "cuasar", "borde"].map((id) => [id, { objeto: id }])),
};

const LUZ = (() => { const l = [-0.62, -0.52, 0.58]; const m = Math.hypot(...l); return l.map((v) => v / m); })();

/**
 * Dibuja un planeta en un canvas de `tam`×`tam` píxeles lógicos (sin contar anillos).
 * `t` es el tiempo en segundos: hace girar la superficie.
 */
export function dibujarPlaneta(canvas, tipo, tam, t = 0) {
  const def = PLANETAS[tipo] || PLANETAS.luna;
  if (def.sonda) return dibujarSonda(canvas, tam, t);
  if (def.objeto) return dibujarObjeto(canvas, def.objeto, Math.round(tam * 1.15), t);
  const margen = def.anillos ? Math.round(tam * 0.55) : def.atmosfera || def.brillo ? 2 : 0;
  const ancho = tam + margen * 2, alto = def.anillos ? Math.round(tam * 1.0) + 4 : tam + margen * 2;
  if (canvas.width !== ancho || canvas.height !== alto) { canvas.width = ancho; canvas.height = alto; }
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(ancho, alto);
  const d = img.data;
  const cx = ancho / 2, cy = alto / 2, r = tam / 2 - 0.5;
  const giro = t * def.velocidad;
  const sup = SUPERFICIES[def.superficie];

  const pintar = (x, y, rgb, a = 255) => {
    const i = (y * ancho + x) * 4;
    d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = a;
  };

  // Anillos de Saturno: inclinados. Primero la parte de detrás (y < centro), luego el planeta, luego la delantera.
  const anillo = (x, y) => {
    const dx = (x + 0.5 - cx) / (r * 2.05), dy = (y + 0.5 - cy) / (r * 0.52);
    const dist = Math.hypot(dx, dy + dx * 0.32);
    if (dist < 0.62 || dist > 1) return null;
    const banda = dist < 0.7 ? 0.35 : dist < 0.74 ? 0.15 : dist < 0.88 ? 0.75 : 0.5;   // con la división de Cassini
    return { nivel: tramar(banda, x, y, RAMPAS.anillo.length), delante: dy + dx * 0.32 > 0 };
  };

  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const px = (x + 0.5 - cx) / r, py = (y + 0.5 - cy) / r;
      let dist = Math.hypot(px, py);
      if (def.irregular) {
        const ang = Math.atan2(py, px);
        dist /= 1 + (ruido(Math.cos(ang) * 1.6 + 5, Math.sin(ang) * 1.6 + 5, 3) - 0.5) * def.irregular * 2;
      }
      const ani = def.anillos ? anillo(x, y) : null;
      if (dist <= 1) {
        if (ani && ani.delante) { pintar(x, y, RAMPAS.anillo[ani.nivel]); continue; }
        const z = Math.sqrt(Math.max(0, 1 - dist * dist));
        const nx = px / Math.max(dist, 1e-6) * Math.min(dist, 1), ny = py / Math.max(dist, 1e-6) * Math.min(dist, 1);
        const lon = Math.atan2(nx, z) + giro, lat = Math.asin(Math.max(-1, Math.min(1, ny)));
        const [rampa, base] = sup(lon, lat, t);
        const luz = def.brillo ? 1 : Math.max(0, nx * LUZ[0] + ny * LUZ[1] + z * LUZ[2]);
        const valor = Math.max(0, Math.min(1, base * (0.25 + luz * 0.95)));
        const colores = RAMPAS[rampa];
        let rgb = colores[tramar(valor, x, y, colores.length)];
        // Borde iluminado por la atmósfera
        if (def.atmosfera && dist > 0.9 && luz > 0.25) rgb = rgb.map((c, i) => Math.round(c * 0.55 + def.atmosfera[i] * 0.45));
        pintar(x, y, rgb);
      } else if (ani) {
        pintar(x, y, RAMPAS.anillo[ani.nivel]);
      } else if ((def.atmosfera || def.brillo) && dist <= 1 + 1.2 / r) {
        // Halo: un anillo limpio de un píxel, más intenso en el lado iluminado
        const col = def.halo || (def.brillo ? [255, 200, 90] : def.atmosfera);
        const lado = Math.max(0, -(px * 0.7 + py * 0.7)) ;
        pintar(x, y, col, Math.round(def.brillo ? 230 : 70 + lado * 150));
      }
    }
  }

  // Pequeños asteroides alrededor
  if (def.satelites) {
    for (let k = 0; k < def.satelites; k++) {
      const a = t * (0.6 + k * 0.2) + k * 2.1;
      const sx = Math.round(cx + Math.cos(a) * r * (1.05 + k * 0.08)), sy = Math.round(cy + Math.sin(a) * r * 0.35);
      if (sx >= 1 && sy >= 1 && sx < ancho - 1 && sy < alto - 1) {
        pintar(sx, sy, RAMPAS.roca[3]); pintar(sx + 1, sy, RAMPAS.roca[2]); pintar(sx, sy + 1, RAMPAS.roca[1]);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  if (def.orbita) {
    ctx.fillStyle = "rgba(160, 210, 255, .9)";
    const a = t * 1.4;
    const ox = Math.round(cx + Math.cos(a) * r * 1.0), oy = Math.round(cy + Math.sin(a) * r * 0.3);
    if (Math.sin(a) > -0.1 || Math.hypot(ox - cx, oy - cy) > r) ctx.fillRect(ox, oy, 2, 2);
  }
}

// ---------------------------------------------------------------- objetos del espacio profundo

// Más allá del Sistema Solar no hay esferas: estrellas, nebulosas y galaxias se dibujan como campos de luz.
// Cada objeto devuelve, para cada píxel (coordenadas -1..1), [rampa, valor 0-1] o null (transparente).
// El valor se trama con Bayer: por debajo de un umbral, el píxel queda transparente.
const RAMPAS_COSMOS = {
  amarilla: R("#5a2a00", "#b86a10", "#ffb83f", "#fff0a0", "#ffffff"),
  naranja: R("#4a1600", "#a8441a", "#ff8a3d", "#ffc890", "#ffffff"),
  azul: R("#0c1a50", "#2a52c0", "#6aa0ff", "#c0dcff", "#ffffff"),
  gigante: R("#3a0600", "#7a1608", "#c0381a", "#ff6a30", "#ffb070"),
  rosa: R("#2a0a2e", "#5e1658", "#a02a7a", "#e65a9a", "#ffb0d0"),
  turquesa: R("#062a30", "#0e5660", "#1e8e94", "#5ad0c8", "#b8fff0"),
  disco: R("#3a0e00", "#8a2a00", "#e06a10", "#ffb040", "#fff0c0"),
  galaxia: R("#0a1040", "#1a2c80", "#3a64c8", "#86b0ff", "#e0ecff"),
  nucleo: R("#4a2a08", "#a06a20", "#e8b860", "#fff0c0", "#ffffff"),
  eliptica: R("#2a1a10", "#6a4a2a", "#b88a50", "#ecc890", "#fff4dc"),
  red: R("#140a30", "#341a70", "#6a3ab8", "#a878ff", "#e8d8ff"),
  cmb: R("#1a3a9a", "#4a8ae0", "#d8e8c8", "#f0a040", "#c83a10"),
  hielo: RAMPAS.hielo,
  negro: R("#000000"),
};

/** Una estrella: núcleo blanco, halo de color y picos de difracción. */
function estrella(px, py, cx, cy, radio, rampa, { picos = 0.9, tam = 48, t = 0, fase = 0 } = {}) {
  const dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy);
  const titila = 0.9 + Math.sin(t * 3 + fase) * 0.1;
  if (d < radio) return [rampa, 0.82 + (1 - d / radio) * 0.18];
  let v = Math.exp(-(d - radio) * (10 / Math.max(radio, 0.08))) * 0.6 * titila;
  const fino = 1.6 / tam;
  if (picos && (Math.abs(dx) < fino || Math.abs(dy) < fino)) v = Math.max(v, picos * titila * Math.max(0, 1 - d / (radio * 4.5 + 0.18)));
  return v > 0.04 ? [rampa, v] : null;
}

function mayor(...capas) {
  let mejor = null;
  for (const c of capas) if (c && (!mejor || c[1] > mejor[1])) mejor = c;
  return mejor;
}

/** Galaxia espiral: bulbo, brazos logarítmicos con grumos y polvo, inclinada y girando despacio. */
function espiral(px, py, t, { inclinacion = 1, brazos = 2, giro = 0, enrollado = 2.6 } = {}) {
  const a0 = t * 0.05 + giro;
  const x = px, y = py / inclinacion;   // inclinada: el disco se ve achatado
  const xr = x * Math.cos(a0) + y * Math.sin(a0), yr = -x * Math.sin(a0) + y * Math.cos(a0);
  const r = Math.hypot(xr, yr);
  if (r > 1) return null;
  const ang = Math.atan2(yr, xr);
  const brazo = Math.cos(brazos * (ang - Math.log(r + 0.04) * enrollado));
  const grumos = fbm(xr * 5 + 3, yr * 5 + 7, 41, 3);
  const bulbo = Math.exp(-r * 7);
  const disco = Math.pow(0.5 + 0.5 * brazo, 2.2) * Math.exp(-r * 2.4) * (0.6 + grumos * 0.8);
  const polvo = brazo > -0.15 && brazo < 0.1 && r > 0.15 ? 0.45 : 1;
  if (bulbo > 0.25) return ["nucleo", Math.min(1, 0.5 + bulbo * 0.6)];
  const v = (disco * 1.45 + bulbo * 0.8) * polvo;
  return v > 0.05 ? ["galaxia", Math.min(1, v)] : null;
}

const OBJETOS = {
  oort(px, py, t, tam, x, y) {
    const d = Math.hypot(px, py);
    if (d < 0.07) return ["amarilla", 0.9];
    // Cometas helados repartidos en una cáscara
    if (d > 0.45 && d < 1 && hash(x, y, 77) > 0.9) return ["hielo", 0.45 + hash(x, y, 78) * 0.5];
    // Un cometa cruzando, con la cola apuntando lejos del Sol
    const a = t * 0.25, cx = Math.cos(a) * 0.62, cy = Math.sin(a) * 0.62;
    const ux = cx / 0.62, uy = cy / 0.62;
    const rx = px - cx, ry = py - cy;
    const largo = rx * ux + ry * uy, lado = Math.abs(rx * uy - ry * ux);
    if (Math.hypot(rx, ry) < 0.05) return ["hielo", 1];
    if (largo > 0 && largo < 0.35 && lado < 0.02 + largo * 0.12) return ["hielo", 0.75 - largo * 1.6];
    return null;
  },
  alfacentauri(px, py, t, tam) {
    const a = t * 0.35;
    const A = [Math.cos(a) * 0.3, Math.sin(a) * 0.14], B = [-A[0] * 1.2, -A[1] * 1.2];
    return mayor(estrella(px, py, A[0], A[1], 0.17, "amarilla", { tam, t }),
      estrella(px, py, B[0], B[1], 0.12, "naranja", { tam, t, fase: 2 }),
      estrella(px, py, 0.72, -0.62, 0.035, "gigante", { tam, t, picos: 0, fase: 4 }));
  },
  sirio(px, py, t, tam) {
    const a = t * 0.5;
    return mayor(estrella(px, py, 0, 0, 0.2, "azul", { tam, t }),
      estrella(px, py, Math.cos(a) * 0.55, Math.sin(a) * 0.25, 0.035, "azul", { tam, t, picos: 0 }));
  },
  vega(px, py, t, tam) {
    const e = Math.hypot(px, py / 0.32);
    const anillo = e > 0.55 && e < 0.9 ? ["naranja", 0.3 + (fbm(Math.atan2(py / 0.32, px) * 2 + t * 0.3, e * 4, 51, 2) - 0.4) * 0.6] : null;
    const est = estrella(px, py, 0, 0, 0.17, "azul", { tam, t });
    if (anillo && py > 0) return mayor(anillo, est && est[1] > 0.8 ? null : est) || anillo;
    return mayor(est, anillo);
  },
  pleyades(px, py, t, tam) {
    const posiciones = [[-0.35, -0.3, 0.1], [0.05, -0.42, 0.08], [0.32, -0.12, 0.11], [-0.1, 0.05, 0.13],
      [0.4, 0.3, 0.07], [-0.45, 0.35, 0.08], [0.05, 0.48, 0.07]];
    const estrellas = posiciones.map(([x, y, r], k) => estrella(px, py, x, y, r * 0.7, "azul", { tam, t, fase: k, picos: 0.7 }));
    const neb = fbm(px * 2.2 + 3, py * 2.2 + 1, 61, 3) - Math.hypot(px, py) * 0.45;
    return mayor(...estrellas, neb > 0.25 ? ["azul", (neb - 0.25) * 0.9] : null);
  },
  orion(px, py, t, tam, x, y) {
    const d = Math.hypot(px, py);
    const n = fbm(px * 2.1 + 9, py * 2.1 + t * 0.02, 71, 4) - d * 0.55 + 0.12;
    const tono = fbm(px * 1.6 + 30, py * 1.6, 72, 3);
    const estrellas = [[-0.06, -0.02], [0.05, 0.03], [0.02, -0.08], [-0.03, 0.07]]
      .map(([cx, cy], k) => estrella(px, py, cx, cy, 0.03, "azul", { tam, t, picos: 0, fase: k }));
    const fondo = hash(x, y, 73) > 0.985 ? ["azul", 0.7] : null;
    return mayor(...estrellas, n > 0.2 ? [tono > 0.5 ? "rosa" : "turquesa", Math.min(1, (n - 0.2) * 1.9)] : null, fondo);
  },
  centro(px, py, t, tam) {
    const d = Math.hypot(px, py);
    const e = Math.hypot(px, py / 0.28);
    const ang = Math.atan2(py / 0.28, px) - t * 0.9;
    const doppler = 0.75 - px * 0.35;   // el lado que se acerca brilla más
    const vetas = 0.75 + (fbm(ang * 2, e * 6, 81, 2) - 0.5) * 0.6;
    const discoV = e > 0.36 && e < 0.98 ? Math.pow(1 - (e - 0.36) / 0.62, 0.8) * doppler * vetas : 0;
    if (discoV > 0 && py > 0) return ["disco", Math.min(1, discoV)];      // parte delantera del disco
    if (d < 0.27) return ["negro", 0];
    if (d < 0.33) return ["disco", 0.95];                                     // anillo de fotones
    if (d < 0.46 && py < 0) return ["disco", (0.46 - d) * 3.2 * doppler];    // disco trasero, curvado por la gravedad
    return discoV > 0.06 ? ["disco", Math.min(1, discoV)] : null;
  },
  magallanes(px, py, t, tam, x, y) {
    const n = fbm(px * 2 + 5, py * 2.4 + 3, 91, 4) * 1.5 - Math.hypot(px * 1.1, py * 1.4) * 1.05;
    const barra = Math.exp(-Math.pow((py + px * 0.4) * 4.5, 2)) * Math.exp(-Math.abs(px) * 2.2) * 0.55;
    const regiones = fbm(px * 6, py * 6, 92, 2) > 0.7 && n > 0.2 ? ["rosa", 0.75] : null;
    const brillo = hash(x, y, 93) > 0.97 && n > 0.05 ? ["galaxia", 0.95] : null;
    const v = n + barra;
    return mayor(v > 0.08 ? ["galaxia", Math.min(1, v * 1.1)] : null, regiones, brillo);
  },
  andromeda(px, py, t) {
    const c = Math.cos(-0.6), s = Math.sin(-0.6);
    const x = px * c - py * s, y = px * s + py * c;
    const gal = espiral(x * 0.98, y * 0.98, t * 0.4, { inclinacion: 0.42, brazos: 2, enrollado: 3 });
    const m32 = estrella(px, py, 0.18, -0.32, 0.05, "nucleo", { picos: 0, t });
    return mayor(gal, m32);
  },
  triangulo(px, py, t) {
    return espiral(px * 1.05, py * 1.05, t, { inclinacion: 0.85, brazos: 3, enrollado: 2.2, giro: 1 });
  },
  m87(px, py, t, tam) {
    const e = Math.hypot(px, py / 0.8);
    const cuerpo = Math.exp(-e * 2.8) * 1.15;
    const ux = 0.8, uy = -0.6;
    const largo = px * ux + py * uy, lado = Math.abs(px * uy - py * ux);
    const chorro = largo > 0.05 && largo < 0.95 && lado < 1.4 / tam
      ? ["azul", 0.55 + 0.45 * Math.max(0, Math.sin(largo * 22 - t * 4))] : null;
    return mayor(cuerpo > 0.07 ? ["eliptica", Math.min(1, cuerpo)] : null, chorro);
  },
  laniakea(px, py, t, tam, x, y) {
    const d = Math.hypot(px, py);
    if (d > 1) return null;
    const cresta = 1 - Math.abs(fbm(px * 2.4 + 11, py * 2.4 + 5, 101, 4) * 2 - 1);
    const v = Math.pow(cresta, 5) * (1.2 - d * 0.9);
    const nodo = v > 0.45 && hash(x, y, 102) > 0.8 ? ["red", 1] : null;
    // Flujo hacia el Gran Atractor: el brillo recorre los filamentos
    const pulso = 0.85 + 0.15 * Math.sin(t * 1.5 - d * 6);
    return mayor(v > 0.1 ? ["red", Math.min(1, v * pulso)] : null, nodo);
  },
  cuasar(px, py, t, tam) {
    const fino = 1.5 / tam;
    const chorro = Math.abs(px) < fino && Math.abs(py) > 0.14 && Math.abs(py) < 0.98
      ? ["azul", 0.5 + 0.5 * Math.max(0, Math.sin(Math.abs(py) * 18 - t * 7))] : null;
    const anfitriona = Math.exp(-Math.hypot(px, py / 0.6) * 4) * 0.6;
    return mayor(estrella(px, py, 0, 0, 0.12, "azul", { tam, t: t * 3, picos: 1 }), chorro,
      anfitriona > 0.08 ? ["eliptica", anfitriona] : null);
  },
  borde(px, py, t) {
    const e = Math.hypot(px, py * 1.9);
    if (e > 1) return null;
    const v = fbm(px * 4 + 3, py * 4 + t * 0.01, 111, 4);
    return ["cmb", Math.max(0, Math.min(1, (v - 0.28) * 2.2))];
  },
};

function dibujarObjeto(canvas, tipo, tam, t) {
  if (canvas.width !== tam || canvas.height !== tam) { canvas.width = tam; canvas.height = tam; }
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(tam, tam);
  const d = img.data;
  const f = OBJETOS[tipo];
  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      const px = ((x + 0.5) / tam) * 2 - 1, py = ((y + 0.5) / tam) * 2 - 1;
      const c = f(px, py, t, tam, x, y);
      if (!c) continue;
      const colores = RAMPAS_COSMOS[c[0]];
      let rgb;
      if (colores.length === 1) rgb = colores[0];
      else {
        // Los valores bajos se traman contra el fondo: así los bordes se deshacen en píxeles
        const v = c[1] + BAYER[(y & 3) * 4 + (x & 3)] * 0.22;
        if (v < 0.1) continue;
        rgb = colores[tramar(Math.min(1, c[1]), x, y, colores.length)];
      }
      const i = (y * tam + x) * 4;
      d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// La sonda Voyager, para el espacio interestelar
const SONDA = [
  "......w......",
  ".....www.....",
  "....wgggw....",
  "...wgg.ggw...",
  "...wg...gw...",
  "....wgggw....",
  "......o......",
  "...oooyooo...",
  "......o......",
  ".....o.o.....",
  "....o...o....",
];
function dibujarSonda(canvas, tam, t) {
  const escala = Math.max(1, Math.floor(tam / 14));
  canvas.width = tam; canvas.height = tam;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, tam, tam);
  const colores = { w: "#dfe6ff", g: "#9aa4c8", o: "#c8ad74", y: Math.sin(t * 4) > 0 ? "#ffd23f" : "#ff7b29" };
  const ox = Math.floor((tam - 13 * escala) / 2), oy = Math.floor((tam - SONDA.length * escala) / 2);
  SONDA.forEach((fila, y) => [...fila].forEach((c, x) => {
    if (colores[c]) { ctx.fillStyle = colores[c]; ctx.fillRect(ox + x * escala, oy + y * escala, escala, escala); }
  }));
}

// ---------------------------------------------------------------- cohete

// Media nave (de izquierda al centro); se refleja para la otra mitad, que queda en sombra.
const MEDIO_COHETE = [
  ".....o",
  "....or",
  "...orr",
  "...orr",
  "..owww",
  "..owww",
  "..owoo",
  "..owob",
  "..owob",
  "..owoo",
  "..owww",
  "..owww",
  ".oroww",
  "orrrow",
  "orrrow",
  "ooooon",
];
const SOMBRA = { w: "g", r: "R", b: "B" };

export function spriteCohete(color = "#ff4f6a") {
  const oscuro = mezclar(color, "#000000", 0.38);
  const paleta = { o: "#1b1530", w: "#f2f4ff", g: "#a9b0d4", r: color, R: oscuro, b: "#4de1ff", B: "#1f6fbf", c: "#e8fbff", n: "#3b3f5c" };
  const filas = MEDIO_COHETE.map((m) => m + [...m].reverse().map((c) => SOMBRA[c] || c).join(""));
  filas[7] = filas[7].slice(0, 5) + "c" + filas[7].slice(6);   // brillo en la ventanilla
  return { filas, paleta, ancho: 12, alto: filas.length };
}

function mezclar(a, b, k) {
  const [r1, g1, b1] = hex(a), [r2, g2, b2] = hex(b);
  const m = (x, y) => Math.round(x + (y - x) * k).toString(16).padStart(2, "0");
  return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`;
}

/** Dibuja el cohete (mirando hacia arriba) con su llama animada. `empuje` 0-1 alarga la llama. */
export function dibujarCohete(canvas, { color = "#ff4f6a", t = 0, empuje = 0.3 } = {}) {
  const s = spriteCohete(color);
  const altoLlama = 8;
  canvas.width = s.ancho + 2; canvas.height = s.alto + altoLlama;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  s.filas.forEach((fila, y) => [...fila].forEach((c, x) => {
    if (s.paleta[c]) { ctx.fillStyle = s.paleta[c]; ctx.fillRect(x + 1, y, 1, 1); }
  }));
  // Llama: tres capas que parpadean
  const largo = Math.round(3 + empuje * 5 + Math.sin(t * 30) * 1.2 + hash(Math.floor(t * 20), 1) * 1.5);
  const capas = [["#ff4f3d", 4, largo], ["#ffb23d", 3, largo - 1], ["#fff3b0", 2, Math.max(1, largo - 3)]];
  for (const [col, ancho, l] of capas) {
    ctx.fillStyle = col;
    const x0 = 1 + s.ancho / 2 - ancho / 2;
    for (let y = 0; y < l; y++) {
      const w = Math.max(1, Math.round(ancho * (1 - y / (l + 1))));
      ctx.fillRect(Math.round(x0 + (ancho - w) / 2), s.alto + y, w, 1);
    }
  }
}

// ---------------------------------------------------------------- animación de todos los sprites visibles

const ESCENA = new Set();
let ultimo = 0;
const reducido = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Registra un canvas para animarlo: `dibujar(t)` se llama ~12 veces por segundo mientras esté en el DOM. */
export function animar(canvas, dibujar) {
  canvas.__dibujar = dibujar;
  dibujar(performance.now() / 1000);
  ESCENA.add(canvas);
}

function bucle(ahora) {
  if (ahora - ultimo > 83) {   // 12 fps: el ritmo del pixel art
    ultimo = ahora;
    for (const c of ESCENA) {
      if (!c.isConnected) { ESCENA.delete(c); continue; }
      if (c.offsetParent === null) continue;   // oculto: no gastar
      c.__dibujar(ahora / 1000);
    }
  }
  if (!reducido) requestAnimationFrame(bucle);
}
if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(bucle);

/** Crea un <canvas> con un planeta animado. */
export function canvasPlaneta(tipo, tam, clase = "") {
  const c = document.createElement("canvas");
  c.className = `pixel planeta-px ${clase}`;
  c.dataset.planeta = tipo;
  animar(c, (t) => dibujarPlaneta(c, tipo, tam, t));
  return c;
}

/** Crea un <canvas> con el cohete animado. */
export function canvasCohete(color, clase = "") {
  const c = document.createElement("canvas");
  c.className = `pixel cohete-px ${clase}`;
  c.__empuje = 0.3;
  animar(c, (t) => {
    c.__empuje = Math.max(0.3, (c.__empuje || 0.3) * 0.93);
    dibujarCohete(c, { color, t, empuje: c.__empuje });
  });
  return c;
}
