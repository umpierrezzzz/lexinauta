// Fondo en pixel art: nebulosas tramadas, tres capas de estrellas en parallax y estrellas fugaces.
// La nave "sube": todo se desplaza hacia abajo. `impulso()` acelera a velocidad warp.

const ESCALA = 3;   // cada píxel del fondo mide 3×3 píxeles de pantalla
const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;

function hash(n) { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; }
function ruido(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const h = (a, b) => hash(a * 73856093 ^ b * 19349663 ^ s * 83492791);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);

export function crearFondo(canvas) {
  const ctx = canvas.getContext("2d");
  let ancho = 0, alto = 0;
  let nebulosa = null;            // canvas con la nebulosa (2× de alto, para desplazarla en bucle)
  let estrellas = [];
  let fugaces = [];
  let velocidad = 1, objetivo = 1;
  let tinte = "#ffffff";
  let desplazamientoNeb = 0;

  function crearNebulosa() {
    const c = document.createElement("canvas");
    c.width = ancho; c.height = alto * 2;
    const g = c.getContext("2d");
    const img = g.createImageData(c.width, c.height);
    // Colores de nebulosa: violeta, azul y magenta muy oscuros (tres tonos por zona, con tramado)
    const tonos = [[[18, 14, 46], [34, 20, 78], [58, 30, 112]], [[10, 22, 52], [16, 40, 92], [28, 70, 140]],
                   [[38, 12, 46], [70, 18, 78], [110, 30, 110]]];
    for (let y = 0; y < c.height; y++) {
      const yy = y % alto;   // periódica para que el bucle no tenga costura visible
      for (let x = 0; x < c.width; x++) {
        const n1 = ruido(x / 38, yy / 30, 1) * 0.6 + ruido(x / 14, yy / 12, 2) * 0.4;
        const zona = ruido(x / 70 + 9, yy / 60 + 3, 5);
        const familia = zona < 0.4 ? 0 : zona < 0.7 ? 1 : 2;
        const umbral = BAYER[(y & 3) * 4 + (x & 3)];
        const nivel = n1 - 0.38;
        const i = (y * c.width + x) * 4;
        if (nivel > umbral * 0.5) {
          const tono = tonos[familia][Math.min(2, Math.floor((nivel + umbral * 0.25) * 4))];
          img.data[i] = tono[0]; img.data[i + 1] = tono[1]; img.data[i + 2] = tono[2]; img.data[i + 3] = 255;
        } else {
          img.data[i] = 5; img.data[i + 1] = 6; img.data[i + 2] = 18; img.data[i + 3] = 255;
        }
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function crearEstrellas() {
    const lista = [];
    const n = Math.round((ancho * alto) / 90);
    const colores = ["#ffffff", "#cfe0ff", "#ffe4c4", "#d8c8ff", "#9fe8ff"];
    for (let i = 0; i < n; i++) {
      const capa = Math.random() < 0.6 ? 0 : Math.random() < 0.7 ? 1 : 2;
      lista.push({
        x: Math.random() * ancho, y: Math.random() * alto, capa,
        color: colores[Math.floor(Math.random() * colores.length)],
        fase: Math.random() * 6.28, cruz: capa === 2 && Math.random() < 0.35,
      });
    }
    return lista;
  }

  function ajustar() {
    ancho = Math.ceil(window.innerWidth / ESCALA);
    alto = Math.ceil(window.innerHeight / ESCALA);
    canvas.width = ancho; canvas.height = alto;
    nebulosa = crearNebulosa();
    estrellas = crearEstrellas();
  }
  ajustar();
  let espera;
  window.addEventListener("resize", () => { clearTimeout(espera); espera = setTimeout(ajustar, 150); });

  let ultimo = performance.now();
  function cuadro(ahora) {
    const dt = Math.min((ahora - ultimo) / 1000, 0.05);
    ultimo = ahora;
    velocidad += (objetivo - velocidad) * Math.min(1, dt * 4);
    objetivo += (1 - objetivo) * Math.min(1, dt * 2.2);

    desplazamientoNeb = (desplazamientoNeb + dt * 1.2 * velocidad) % alto;
    ctx.drawImage(nebulosa, 0, Math.floor(desplazamientoNeb) - alto);

    const warp = Math.max(0, (velocidad - 2.5) / 20);
    const VEL = [3, 7, 14];
    for (const e of estrellas) {
      e.y += VEL[e.capa] * velocidad * dt;
      if (e.y > alto + 2) { e.y -= alto + 4; e.x = Math.random() * ancho; }
      const x = Math.floor(e.x), y = Math.floor(e.y);
      const brillo = e.capa === 0 ? 0.45 : e.capa === 1 ? 0.75 : 1;
      const titila = 0.75 + Math.sin(ahora / 400 + e.fase) * 0.25;
      ctx.globalAlpha = Math.min(1, brillo * titila);
      ctx.fillStyle = warp > 0.05 && e.capa === 2 ? tinte : e.color;
      if (warp > 0.05 && e.capa > 0) {
        ctx.globalAlpha *= e.capa === 2 ? 0.6 : 0.3;
        const largo = Math.max(1, Math.round(Math.min(warp, 1) * 14 * e.capa));
        ctx.fillRect(x, y - largo, 1, largo);
      } else if (e.cruz) {
        ctx.fillRect(x, y, 1, 1);
        ctx.globalAlpha *= 0.55;
        ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1);
        ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, y + 1, 1, 1);
      } else {
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.globalAlpha = 1;

    // Estrellas fugaces de vez en cuando
    if (Math.random() < dt * 0.12) fugaces.push({ x: Math.random() * ancho * 0.8 + ancho * 0.2, y: Math.random() * alto * 0.5, vida: 1 });
    fugaces = fugaces.filter((f) => f.vida > 0);
    for (const f of fugaces) {
      f.x -= dt * 90; f.y += dt * 45; f.vida -= dt * 1.4;
      for (let k = 0; k < 10; k++) {
        ctx.globalAlpha = Math.max(0, f.vida * (1 - k / 10));
        ctx.fillStyle = k < 2 ? "#ffffff" : "#9fe8ff";
        ctx.fillRect(Math.floor(f.x + k * 2), Math.floor(f.y - k), 1, 1);
      }
    }
    ctx.globalAlpha = 1;
    if (!reducido) requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);

  return {
    /** Acelerón proporcional a los puntos (0-85) con el color de la rareza. */
    impulso(puntos, color) {
      if (reducido) return;
      objetivo = 3 + puntos * 0.25;
      if (color) tinte = color;
    },
  };
}
