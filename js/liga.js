// Cliente de la liga online: identidad anónima, envío de las misiones diarias y clasificación del grupo.
// Habla con las funciones de servidor/liga.sql a través de la API REST de Supabase.
import { LIGA } from "./config.js";
import { almacen } from "./estado.js";

const conf = () => window.LEXINAUTA_LIGA || LIGA;   // las pruebas pueden apuntar a un servidor local
export const ligaActiva = () => !!(conf().url && conf().clave);

async function rpc(funcion, args) {
  const { url, clave } = conf();
  const r = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/${funcion}`, {
    method: "POST",
    // Las claves antiguas (anon, un JWT «eyJ…») van también como Bearer; las nuevas (sb_publishable_…) solo en apikey
    headers: { apikey: clave, ...(clave.startsWith("eyJ") ? { Authorization: `Bearer ${clave}` } : {}), "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`liga ${funcion}: ${r.status}`);
  return r.json();
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** El secreto que identifica a este jugador (se crea la primera vez). */
function secreto() {
  let s = almacen.leer("hp_liga_secreto", null);
  if (!s) { s = uuid(); almacen.guardar("hp_liga_secreto", s); }
  return s;
}

/** Última clasificación conocida (para pintar al instante, aunque no haya conexión). */
export function ligaGuardada() { return almacen.leer("hp_liga_cache", null); }
function guardar(estado) { if (estado) almacen.guardar("hp_liga_cache", { ...estado, recibido: Date.now() }); return estado; }

export async function registrar(alias, modelo) {
  const e = await rpc("liga_registrar", { p_secreto: secreto(), p_alias: alias, p_modelo: modelo });
  almacen.guardar("hp_liga_registrado", true);
  return guardar(e);
}

/** Estado de la liga; si el servidor no conoce a este jugador, lo da de alta. */
export async function estadoLiga(alias, modelo) {
  const e = await rpc("liga_estado", { p_secreto: secreto() });
  return e ? guardar(e) : registrar(alias, modelo);
}

/**
 * Envía la misión diaria. Si no hay conexión, se queda en cola y se reintenta en el siguiente envío
 * o al abrir la liga (el servidor acepta hasta un día de retraso).
 */
export async function enviarPartida({ fecha, puntos, alias, modelo }) {
  const cola = almacen.leer("hp_liga_pendientes", []).filter((p) => p.fecha !== fecha);
  cola.push({ fecha, puntos });
  almacen.guardar("hp_liga_pendientes", cola);
  return reintentarPendientes(alias, modelo);
}

export async function reintentarPendientes(alias, modelo) {
  let cola = almacen.leer("hp_liga_pendientes", []);
  if (!cola.length) return estadoLiga(alias, modelo);
  if (!almacen.leer("hp_liga_registrado", false)) await registrar(alias, modelo);
  let ultimo = null;
  for (const p of cola) {
    try {
      ultimo = await rpc("liga_enviar", { p_secreto: secreto(), p_fecha: p.fecha, p_puntos: p.puntos, p_modelo: modelo });
      cola = cola.filter((x) => x !== p);
    } catch (e) {
      // Fuera de plazo (más de un día): se descarta; sin conexión: se queda para la próxima
      if (String(e.message).includes(": 4")) cola = cola.filter((x) => x !== p);
      else { almacen.guardar("hp_liga_pendientes", cola); throw e; }
    }
  }
  almacen.guardar("hp_liga_pendientes", cola);
  return guardar(ultimo) || estadoLiga(alias, modelo);
}
