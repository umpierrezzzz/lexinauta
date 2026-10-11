// Salas online con PeerJS (WebRTC). El anfitrión es el centro: recibe las respuestas, resuelve los choques
// y reparte los resultados. El servidor público de PeerJS solo se usa para que los navegadores se encuentren;
// el juego viaja directo entre ellos.
import { resolverChoques } from "./motor.js";
import { COLORES_JUGADOR } from "./ui.js";

const PREFIJO = "hasta-pluton-v1-";
const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const MAX_JUGADORES = 6;
export const ID_ANFITRION = "anfitrion";

let cargando = null;
function cargarPeer() {
  if (window.Peer) return Promise.resolve();
  cargando ??= new Promise((ok, mal) => {
    const s = document.createElement("script");
    s.src = "js/vendor/peerjs.min.js";
    s.onload = ok;
    s.onerror = () => { cargando = null; mal(new Error("peerjs")); };
    document.head.appendChild(s);
  });
  return cargando;
}

function codigoAleatorio() {
  return Array.from({ length: 5 }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join("");
}

function conTiempo(promesa, ms, error) {
  return Promise.race([promesa, new Promise((_, mal) => setTimeout(() => mal(new Error(error)), ms))]);
}

/**
 * Sala del anfitrión. `alEvento(msg)` recibe los mismos mensajes que los clientes, así la interfaz es igual para todos.
 */
export async function crearSala(nombre, alEvento) {
  await cargarPeer();
  let peer, codigo;
  for (let intento = 0; intento < 4; intento++) {
    codigo = codigoAleatorio();
    peer = new window.Peer(PREFIJO + codigo);
    try {
      await conTiempo(new Promise((ok, mal) => { peer.on("open", ok); peer.on("error", mal); }), 12000, "tiempo");
      break;
    } catch (e) {
      peer.destroy();
      if (e?.type !== "unavailable-id" || intento === 3) throw e;
    }
  }

  const conexiones = new Map();   // id → conexión
  const sala = {
    rol: "anfitrion", codigo, miId: ID_ANFITRION,
    jugadores: [{ id: ID_ANFITRION, nombre, color: COLORES_JUGADOR[0] }],
    fase: "sala", ronda: -1, rondas: 0, respuestas: {}, puntos: {},
  };

  const difundir = (msg) => {
    for (const c of conexiones.values()) if (c.open) c.send(msg);
    alEvento(msg);
  };
  const mensajeSala = () => ({ tipo: "sala", jugadores: sala.jugadores, codigo });

  function comprobarRonda() {
    if (sala.fase !== "jugando") return;
    const resp = sala.respuestas;
    if (!sala.jugadores.every((j) => resp[j.id])) return;
    const finales = resolverChoques(Object.fromEntries(sala.jugadores.map((j) => [j.id, resp[j.id]])));
    for (const j of sala.jugadores) sala.puntos[j.id] = (sala.puntos[j.id] || 0) + finales[j.id].puntos;
    sala.fase = "resultados";
    difundir({ tipo: "ronda_fin", ronda: sala.ronda, resultados: finales, puntos: { ...sala.puntos } });
  }

  function procesar(id, msg) {
    if (msg.tipo === "respuesta" && sala.fase === "jugando" && msg.ronda === sala.ronda && !sala.respuestas[id]) {
      sala.respuestas[id] = { respuesta: msg.respuesta || null, rareza: Number(msg.rareza) || 0, puntos: Number(msg.puntos) || 0 };
      difundir({ tipo: "progreso", ronda: sala.ronda, respondidos: Object.keys(sala.respuestas) });
      comprobarRonda();
    }
  }

  peer.on("connection", (conn) => {
    conn.on("data", (msg) => {
      if (!msg || typeof msg !== "object") return;
      if (msg.tipo === "hola") {
        if (sala.fase !== "sala") { conn.send({ tipo: "rechazo", motivo: "empezada" }); setTimeout(() => conn.close(), 300); return; }
        if (sala.jugadores.length >= MAX_JUGADORES) { conn.send({ tipo: "rechazo", motivo: "llena" }); setTimeout(() => conn.close(), 300); return; }
        const usados = new Set(sala.jugadores.map((j) => j.color));
        const color = COLORES_JUGADOR.find((c) => !usados.has(c));
        conexiones.set(conn.peer, conn);
        sala.jugadores.push({ id: conn.peer, nombre: String(msg.nombre || "?").slice(0, 16), color });
        conn.send({ tipo: "bienvenida", tuId: conn.peer });
        difundir(mensajeSala());
        return;
      }
      if (conexiones.has(conn.peer)) procesar(conn.peer, msg);
    });
    conn.on("close", () => {
      if (!conexiones.has(conn.peer)) return;
      conexiones.delete(conn.peer);
      sala.jugadores = sala.jugadores.filter((j) => j.id !== conn.peer);
      delete sala.respuestas[conn.peer];
      difundir(mensajeSala());
      comprobarRonda();
    });
  });
  peer.on("disconnected", () => { try { peer.reconnect(); } catch { /* nada */ } });

  Object.assign(sala, {
    enviar(msg) { procesar(ID_ANFITRION, msg); },
    empezar({ idioma, categorias }) {
      sala.fase = "jugando"; sala.ronda = 0; sala.rondas = categorias.length; sala.respuestas = {}; sala.puntos = {};
      difundir({ tipo: "empezar", idioma, categorias, jugadores: sala.jugadores });
    },
    siguiente() {
      if (sala.fase !== "resultados") return;
      if (sala.ronda + 1 >= sala.rondas) {
        sala.fase = "fin";
        difundir({ tipo: "fin", puntos: { ...sala.puntos }, jugadores: sala.jugadores });
        return;
      }
      sala.ronda++; sala.respuestas = {}; sala.fase = "jugando";
      difundir({ tipo: "siguiente", ronda: sala.ronda });
    },
    volverASala() { sala.fase = "sala"; difundir({ ...mensajeSala(), lobby: true }); },
    cerrar() { for (const c of conexiones.values()) try { c.close(); } catch { /* nada */ } peer.destroy(); },
  });
  setTimeout(() => alEvento(mensajeSala()), 0);
  return sala;
}

/** Unirse a la sala `codigo`. Lanza un error con .motivo = "noExiste" | "conexion". */
export async function unirseSala(codigo, nombre, alEvento) {
  await cargarPeer();
  const peer = new window.Peer();
  const fallo = (motivo) => Object.assign(new Error(motivo), { motivo });
  try {
    await conTiempo(new Promise((ok, mal) => { peer.on("open", ok); peer.on("error", mal); }), 12000, "tiempo");
  } catch {
    peer.destroy();
    throw fallo("conexion");
  }
  const conn = peer.connect(PREFIJO + codigo.toUpperCase(), { reliable: true });
  const sala = { rol: "cliente", codigo: codigo.toUpperCase(), miId: peer.id, jugadores: [] };
  let cerradaAdrede = false;

  try {
    await conTiempo(new Promise((ok, mal) => {
      conn.on("open", ok);
      peer.on("error", (e) => mal(fallo(e?.type === "peer-unavailable" ? "noExiste" : "conexion")));
    }), 15000, "tiempo");
  } catch (e) {
    peer.destroy();
    throw e.motivo ? e : fallo("conexion");
  }

  conn.on("data", (msg) => {
    if (!msg || typeof msg !== "object") return;
    if (msg.tipo === "bienvenida") { sala.miId = msg.tuId; return; }
    if (msg.tipo === "sala" || msg.tipo === "empezar") sala.jugadores = msg.jugadores;
    alEvento(msg);
  });
  conn.on("close", () => { if (!cerradaAdrede) alEvento({ tipo: "desconectado" }); });
  conn.send({ tipo: "hola", nombre });

  Object.assign(sala, {
    enviar(msg) { if (conn.open) conn.send(msg); },
    cerrar() { cerradaAdrede = true; try { conn.close(); } catch { /* nada */ } peer.destroy(); },
  });
  return sala;
}
