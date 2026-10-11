// Campo de estrellas en 3D sobre un <canvas>: viaja hacia el espectador.
// `impulso(n)` acelera de golpe (efecto warp) y la velocidad vuelve sola a crucero.

const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function crearCielo(canvas) {
  const ctx = canvas.getContext("2d");
  const N = 520;
  const estrellas = [];
  let ancho = 0, alto = 0, dpr = 1;
  let velocidad = 0.6, objetivo = 0.6;
  const CRUCERO = 0.6;
  let tinte = [200, 220, 255];

  function nueva(z = Math.random()) {
    const colores = [[255, 255, 255], [190, 215, 255], [255, 225, 200], [210, 200, 255]];
    return { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2, z, px: null, py: null,
             color: colores[Math.floor(Math.random() * colores.length)], tam: Math.random() * 1.2 + 0.3 };
  }
  for (let i = 0; i < N; i++) estrellas.push(nueva());

  function ajustar() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    ancho = canvas.clientWidth; alto = canvas.clientHeight;
    canvas.width = ancho * dpr; canvas.height = alto * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", ajustar);
  ajustar();

  let ultimo = performance.now();
  function cuadro(ahora) {
    const dt = Math.min((ahora - ultimo) / 16.67, 3);
    ultimo = ahora;
    velocidad += (objetivo - velocidad) * 0.06 * dt;
    objetivo += (CRUCERO - objetivo) * 0.02 * dt;

    // Rastro: con velocidad alta se borra menos y quedan estelas.
    const warp = Math.min((velocidad - CRUCERO) / 12, 1);
    ctx.fillStyle = `rgba(3, 5, 14, ${0.85 - warp * 0.55})`;
    ctx.fillRect(0, 0, ancho, alto);

    const cx = ancho / 2, cy = alto * 0.42, escala = Math.max(ancho, alto) * 0.6;
    for (let i = 0; i < estrellas.length; i++) {
      const e = estrellas[i];
      e.z -= 0.0022 * velocidad * dt;
      if (e.z <= 0.02) { estrellas[i] = nueva(1); continue; }
      const sx = cx + (e.x / e.z) * escala, sy = cy + (e.y / e.z) * escala;
      if (sx < -50 || sx > ancho + 50 || sy < -50 || sy > alto + 50) { estrellas[i] = nueva(1); continue; }
      const brillo = Math.min(1, (1 - e.z) * 1.3);
      const r = e.tam * (1 - e.z) * 2.2;
      const [cr, cg, cb] = warp > 0.15 ? tinte : e.color;
      if (e.px !== null && velocidad > 2) {
        ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${brillo})`;
        ctx.lineWidth = Math.max(r, 0.6);
        ctx.beginPath(); ctx.moveTo(e.px, e.py); ctx.lineTo(sx, sy); ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${brillo})`;
        ctx.beginPath(); ctx.arc(sx, sy, Math.max(r, 0.4), 0, Math.PI * 2); ctx.fill();
      }
      e.px = sx; e.py = sy;
    }
    if (!reducido) requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);

  return {
    /** Acelerón proporcional a los puntos (0-85). */
    impulso(puntos, color) {
      if (reducido) return;
      objetivo = CRUCERO + 3 + puntos * 0.28;
      if (color) tinte = color;
    },
  };
}
