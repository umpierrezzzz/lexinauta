// Efectos de sonido chiptune generados al momento con Web Audio (sin archivos).

let ctx = null;
let silencio = false;
try { silencio = JSON.parse(localStorage.getItem("hp_silencio") || "false"); } catch { /* sin almacenamiento */ }

function audio() {
  if (silencio) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function nota(frec, inicio, dur, { tipo = "square", vol = 0.08, desliz = 0 } = {}) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + inicio;
  const o = a.createOscillator(), g = a.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(frec, t);
  if (desliz) o.frequency.exponentialRampToValueAtTime(Math.max(30, frec + desliz), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

function ruido(inicio, dur, { vol = 0.06, desde = 2000, hasta = 200 } = {}) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + inicio;
  const buffer = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
  const fuente = a.createBufferSource(); fuente.buffer = buffer;
  const filtro = a.createBiquadFilter(); filtro.type = "lowpass";
  filtro.frequency.setValueAtTime(desde, t); filtro.frequency.exponentialRampToValueAtTime(hasta, t + dur);
  const g = a.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  fuente.connect(filtro).connect(g).connect(a.destination);
  fuente.start(t);
}

// Escala pentatónica: cuanto más rara la respuesta, más alta y larga la melodía.
const ESCALA = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568];

export const sonido = {
  get silencio() { return silencio; },
  alternar() {
    silencio = !silencio;
    try { localStorage.setItem("hp_silencio", JSON.stringify(silencio)); } catch { /* nada */ }
    if (!silencio) this.clic();
    return silencio;
  },
  clic() { nota(880, 0, 0.05, { vol: 0.04 }); },
  despegue() {
    ruido(0, 0.9, { vol: 0.07, desde: 400, hasta: 3000 });
    nota(110, 0, 0.8, { tipo: "sawtooth", vol: 0.04, desliz: 330 });
  },
  acierto(rareza) {
    const notas = 1 + rareza;
    for (let i = 0; i < notas; i++) nota(ESCALA[i + Math.max(0, rareza - 2)], i * 0.06, 0.12, { vol: 0.06 });
    if (rareza >= 4) nota(ESCALA[8], notas * 0.06, 0.35, { tipo: "triangle", vol: 0.08 });
  },
  fallo() { nota(196, 0, 0.12, { vol: 0.06, desliz: -80 }); nota(147, 0.1, 0.18, { vol: 0.06, desliz: -60 }); },
  tic() { nota(1760, 0, 0.03, { vol: 0.03 }); },
  sinTiempo() { nota(330, 0, 0.15, { tipo: "triangle", vol: 0.07 }); nota(220, 0.15, 0.3, { tipo: "triangle", vol: 0.07 }); },
  planeta() { [784, 988, 1175].forEach((f, i) => nota(f, i * 0.08, 0.2, { tipo: "triangle", vol: 0.06 })); },
  choque() { ruido(0, 0.35, { vol: 0.1, desde: 3000, hasta: 100 }); nota(98, 0, 0.3, { vol: 0.05, desliz: -40 }); },
  fin() {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => nota(f, i * 0.11, i === 5 ? 0.5 : 0.14, { vol: 0.06 }));
  },
  turno() { nota(659, 0, 0.08, { vol: 0.05 }); nota(988, 0.08, 0.12, { vol: 0.05 }); },
};
