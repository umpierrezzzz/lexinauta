// Cuenta opcional con Google (Supabase Auth) para guardar el progreso en la nube y recuperarlo en otro dispositivo.
// Sin librerías: el flujo OAuth con PKCE y la API REST de Supabase se llaman con fetch.
import { LIGA } from "./config.js";
import { almacen, estado } from "./estado.js";

const conf = () => window.LEXINAUTA_LIGA || LIGA;
const base = () => conf().url.replace(/\/$/, "");
export const cuentasActivas = () => !!(conf().url && conf().clave);

// ---------------------------------------------------------------- qué se sincroniza

// Claves de localStorage que forman el progreso del jugador
const CLAVES = ["hp_historial", "hp_records", "hp_cohete", "hp_nombre", "hp_liga_secreto", "hp_liga_alias", "hp_cohetes_vistos"];

export function progresoLocal() {
  const datos = {};
  for (const k of CLAVES) { const v = almacen.leer(k, null); if (v !== null) datos[k] = v; }
  return datos;
}

/**
 * Mezcla el progreso del navegador con el de la cuenta sin perder nada:
 * historial (por día, la partida terminada o la de más puntos), récords (el máximo), cohetes vistos (la unión).
 * La identidad de la liga de la cuenta manda, para seguir siendo el mismo piloto en todos los dispositivos.
 */
export function mezclarProgreso(local = {}, nube = {}) {
  const r = { ...nube, ...local };
  const h = { ...(nube.hp_historial || {}) };
  for (const [k, p] of Object.entries(local.hp_historial || {})) {
    const q = h[k];
    if (!q || (p.completa && !q.completa) || (p.completa === q.completa && p.puntos > q.puntos)) h[k] = p;
  }
  r.hp_historial = h;
  const rec = { ...(nube.hp_records || {}) };
  for (const [k, v] of Object.entries(local.hp_records || {})) rec[k] = Math.max(rec[k] || 0, v);
  r.hp_records = rec;
  r.hp_cohetes_vistos = [...new Set([...(nube.hp_cohetes_vistos || []), ...(local.hp_cohetes_vistos || [])])];
  if (nube.hp_liga_secreto) { r.hp_liga_secreto = nube.hp_liga_secreto; r.hp_liga_alias = nube.hp_liga_alias ?? local.hp_liga_alias; }
  if (!local.hp_nombre && nube.hp_nombre) r.hp_nombre = nube.hp_nombre;
  if ((!local.hp_cohete || local.hp_cohete === "clasico") && nube.hp_cohete) r.hp_cohete = nube.hp_cohete;
  for (const k of Object.keys(r)) if (r[k] === undefined || r[k] === null) delete r[k];
  return r;
}

function aplicar(datos) {
  const secretoAntes = almacen.leer("hp_liga_secreto", null);
  for (const k of CLAVES) if (k in datos) almacen.guardar(k, datos[k]);
  if (datos.hp_cohete) estado.cohete = datos.hp_cohete;
  if (datos.hp_liga_secreto && datos.hp_liga_secreto !== secretoAntes) {
    // Ahora somos el piloto de la cuenta: lo que se sabía de la liga era del otro
    almacen.guardar("hp_liga_registrado", true);
    almacen.guardar("hp_liga_cache", null);
  }
}

// ---------------------------------------------------------------- sesión (OAuth con PKCE)

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function sesion() { return almacen.leer("hp_sesion", null); }

/** Lleva al jugador a la pantalla de Google; vuelve a esta misma página con ?code=… */
export async function entrarConGoogle() {
  const verificador = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const reto = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verificador))));
  almacen.guardar("hp_pkce", verificador);
  const vuelta = location.origin + location.pathname;
  location.href = `${base()}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(vuelta)}`
    + `&code_challenge=${reto}&code_challenge_method=s256`;
}

async function pedirToken(tipo, cuerpo) {
  const r = await fetch(`${base()}/auth/v1/token?grant_type=${tipo}`, {
    method: "POST", headers: { apikey: conf().clave, "Content-Type": "application/json" }, body: JSON.stringify(cuerpo),
  });
  if (!r.ok) throw new Error(`auth ${r.status}`);
  const d = await r.json();
  const s = { acceso: d.access_token, renovar: d.refresh_token, caduca: Date.now() + (d.expires_in - 60) * 1000,
    id: d.user.id, correo: d.user.email, nombre: d.user.user_metadata?.full_name || "" };
  almacen.guardar("hp_sesion", s);
  return s;
}

/** Al volver de Google: cambia el código por una sesión. */
export async function completarEntrada(codigo) {
  const verificador = almacen.leer("hp_pkce", null);
  almacen.guardar("hp_pkce", null);
  if (!verificador) throw new Error("sin verificador");
  return pedirToken("pkce", { auth_code: codigo, code_verifier: verificador });
}

async function sesionValida() {
  const s = sesion();
  if (!s) return null;
  if (Date.now() < s.caduca) return s;
  try { return await pedirToken("refresh_token", { refresh_token: s.renovar }); } catch (e) {
    if (String(e.message).includes(" 4")) almacen.guardar("hp_sesion", null);   // sesión revocada o caducada
    return null;
  }
}

export async function salir() {
  const s = sesion();
  almacen.guardar("hp_sesion", null);
  if (s) fetch(`${base()}/auth/v1/logout`, { method: "POST", headers: { apikey: conf().clave, Authorization: `Bearer ${s.acceso}` } }).catch(() => {});
}

// ---------------------------------------------------------------- sincronización

async function rest(ruta, opciones = {}) {
  const s = await sesionValida();
  if (!s) throw new Error("sin sesión");
  const r = await fetch(`${base()}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { apikey: conf().clave, Authorization: `Bearer ${s.acceso}`, "Content-Type": "application/json", ...(opciones.headers || {}) },
  });
  if (!r.ok) throw new Error(`progreso ${r.status}`);
  return { s, datos: r.status === 204 ? null : await r.json() };
}

/**
 * Baja el progreso de la cuenta, lo mezcla con el del navegador, lo aplica aquí y sube el resultado.
 * Devuelve true si algo ha cambiado en este dispositivo.
 */
export async function sincronizar() {
  if (!sesion()) return false;
  const { s, datos: filas } = await rest(`progreso?select=datos&usuario=eq.${sesion().id}`);
  const nube = filas[0]?.datos || {};
  const local = progresoLocal();
  const mezcla = mezclarProgreso(local, nube);
  const cambiaAqui = Object.keys(mezcla).some((k) => JSON.stringify(mezcla[k]) !== JSON.stringify(local[k]));
  aplicar(mezcla);
  if (JSON.stringify(mezcla) !== JSON.stringify(nube)) {
    await rest("progreso", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ usuario: s.id, datos: mezcla, actualizado: new Date().toISOString() }),
    });
  }
  return cambiaAqui;
}

/** Sube el progreso tras una partida (sin esperar; si falla, se mezclará en la próxima sincronización). */
export function guardarEnLaNube() {
  if (sesion()) sincronizar().catch(() => {});
}
