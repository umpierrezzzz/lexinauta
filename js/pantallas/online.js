// Multijugador online: crear o unirse a una sala, sala de espera, etapas simultáneas con choques y podio.
import { MODOS, categoriasPractica } from "../motor.js";
import { $, T, ruta, ir, pantalla, escapar, cohete, planeta, montarSprites, aviso, copiar } from "../ui.js";
import { estado, nombrePiloto, guardarNombre, cargarDatos, cambiarIdioma } from "../estado.js";
import { sonido } from "../sonido.js";
import { crearSala, unirseSala, MAX_JUGADORES } from "../red.js";
import { moverAltimetro, celebrarPlaneta, jugarEtapa, celebrar, pintarEtapas } from "./comun.js";
import { htmlJuego, activarAbandonar } from "./rondas.js";
import { htmlTablaEtapa, htmlPodio } from "./local.js";

function htmlJugadores(jugadores, miId, respondidos = null) {
  return `<div class="jugadores">${jugadores.map((j) => `<span class="jugador${j.id === miId ? " yo" : ""}" style="--jc:${j.color}">
    ${cohete(j.color, "", 2, "", j.id === miId ? "propio" : j.modelo)}<b>${escapar(j.nombre)}</b>${respondidos?.includes(j.id) ? ` <span class="listo">✓</span>` : ""}</span>`).join("")}</div>`;
}

ruta("online", ({ unirse = "" } = {}) => {
  const t = T();
  let sala = null;
  let jugadores = [];
  let partida = null;   // { categorias, ronda, puntos: {id: n}, rarezas: [], respondidos: [], raiz }
  let cerrada = false;
  let enPodio = false;

  // ------------------------------------------------------------ entrada: crear o unirse

  function pintarEntrada(error = "") {
    const raiz = pantalla(`<div class="pantalla estrecha">
      <div class="cabecera-pantalla">${planeta("tierra", 16, "", 3)}<h1>${t.online}</h1></div>
      <p class="subtitulo">${t.onlineDesc}</p>
      <label class="nombre-piloto caja">
        <span class="etiqueta">${t.tuNombreSala}</span>
        <span class="campo chico"><input data-nombre maxlength="16" value="${escapar(nombrePiloto())}" placeholder="${t.nombrePorDefecto}"></span>
      </label>
      <button class="btn verde grande ancho" data-crear>🛰 ${t.crearSala}</button>
      <section class="caja" style="display:grid;gap:12px">
        <p class="etiqueta">${t.codigoSala}</p>
        <form class="fila" data-unirse>
          <span class="campo codigo"><input data-codigo maxlength="5" value="${escapar(unirse)}" placeholder="ABCDE" autocapitalize="characters" autocomplete="off"></span>
          <button class="btn cian grande" type="submit">${t.unirse}</button>
        </form>
        ${error ? `<p class="mensaje error">${error}</p>` : ""}
      </section>
      <p class="aviso-pie">${t.avisoOnline}</p>
    </div>`);
    const nombre = () => { const n = $("[data-nombre]", raiz).value.trim(); guardarNombre(n); return n || t.nombrePorDefecto; };
    $("[data-crear]", raiz).addEventListener("click", async (e) => {
      e.currentTarget.disabled = true;
      e.currentTarget.textContent = t.conectando;
      try {
        sala = await crearSala(nombre(), alEvento, estado.cohete);
        if (cerrada) sala.cerrar();
      } catch {
        if (!cerrada) pintarEntrada(t.errorConexion);
      }
    });
    $("[data-unirse]", raiz).addEventListener("submit", async (e) => {
      e.preventDefault();
      const codigo = $("[data-codigo]", raiz).value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (codigo.length < 4) return;
      const boton = $("button[type=submit]", raiz);
      boton.disabled = true; boton.textContent = t.conectando;
      try {
        sala = await unirseSala(codigo, nombre(), alEvento, estado.cohete);
        if (cerrada) { sala.cerrar(); return; }
        if (!partida) pintarSala();
      } catch (err) {
        if (!cerrada) { unirse = codigo; pintarEntrada(err.motivo === "noExiste" ? t.salaNoExiste : t.errorConexion); }
      }
    });
  }

  // ------------------------------------------------------------ sala de espera

  function enlaceSala() { return `${location.origin}${location.pathname}?sala=${sala.codigo}`; }

  function pintarSala() {
    const t2 = T();
    const anfitrion = sala.rol === "anfitrion";
    const raiz = pantalla(`<div class="pantalla estrecha">
      <div class="cabecera-pantalla">${planeta("tierra", 16, "", 3)}<h1>${anfitrion ? t2.tuSala : t2.online}</h1></div>
      <section class="caja destacada" style="display:grid;gap:12px;text-align:center">
        <p class="etiqueta">${t2.codigoSala}</p>
        <div class="codigo-sala" data-codigo-sala>${sala.codigo}</div>
        ${anfitrion ? `<p class="subtitulo">${t2.compartirSala}</p><button class="btn cian ancho" data-copiar>🔗 ${t2.copiarEnlace}</button>` : ""}
      </section>
      <section class="caja" style="display:grid;gap:12px">
        <p class="etiqueta">${t2.pilotos} · ${jugadores.length}/${MAX_JUGADORES}</p>
        ${htmlJugadores(jugadores, sala.miId)}
        <p class="suave" style="margin:0">${anfitrion ? (jugadores.length < 2 ? t2.esperandoJugadores : "") : t2.esperandoAnfitrion}</p>
      </section>
      ${anfitrion ? `<button class="btn verde grande ancho" data-empezar ${jugadores.length < 2 ? "disabled" : ""}>🚀 ${t2.empezar}</button>` : ""}
      <button class="btn ancho" data-salir>${t2.salir}</button>
    </div>`, "sala");
    $("[data-copiar]", raiz)?.addEventListener("click", async () => {
      if (await copiar(enlaceSala())) aviso(t2.enlaceSalaCopiado); else prompt("", enlaceSala());
    });
    $("[data-empezar]", raiz)?.addEventListener("click", () => {
      if (jugadores.length < 2) { aviso(t2.minimoDos, "error"); return; }
      sala.empezar({ idioma: estado.idioma, categorias: categoriasPractica(estado.datos[estado.idioma].ids, MODOS.online.rondas) });
    });
    $("[data-salir]", raiz).addEventListener("click", () => ir("inicio"));
  }

  // ------------------------------------------------------------ partida

  const indice = (id) => jugadores.findIndex((j) => j.id === id);
  const puntosLista = () => jugadores.map((j) => partida.puntos[j.id] || 0);

  async function empezarRonda(r) {
    const t2 = T();
    partida.ronda = r;
    partida.respondidos = [];
    const cat = estado.datos[estado.idioma].porId[partida.categorias[r]];
    const raiz = pantalla(htmlJuego({ jugadores, rondas: partida.categorias.length }), "partida");
    partida.raiz = raiz;
    activarAbandonar(raiz);
    moverAltimetro(raiz, puntosLista());
    $("[data-etapa]", raiz).textContent = `${t2.ronda} ${r + 1} ${t2.de} ${partida.categorias.length}`;
    $("[data-marcador]", raiz).textContent = partida.puntos[sala.miId] || 0;
    pintarEtapas(raiz, r, partida.rarezas);
    const zona = $("[data-zona]", raiz);
    const res = await jugarEtapa(zona, cat, { segundos: MODOS.online.segundos });
    if (cerrada || partida?.raiz !== raiz) return;
    if (res.respuesta) sonido.acierto(Math.min(res.rareza, 2));
    zona.innerHTML = `<article class="caja clara tarjeta entra">
      <div class="icono-cat">${cat.icono}</div>
      <p class="etiqueta">${t2.esperandoOtros}</p>
      <div data-respondidos>${htmlJugadores(jugadores, sala.miId, partida.respondidos)}</div>
    </article>`;
    montarSprites(zona);
    sala.enviar({ tipo: "respuesta", ronda: r, ...res });   // al final: al anfitrión le puede llegar ya el fin de etapa
  }

  function finRonda(msg) {
    const t2 = T();
    const raiz = partida.raiz;
    const cat = estado.datos[estado.idioma].porId[partida.categorias[msg.ronda]];
    const porIndice = {};
    for (const [id, r] of Object.entries(msg.resultados)) if (indice(id) >= 0) porIndice[indice(id)] = r;
    partida.puntos = msg.puntos;
    partida.rarezas.push(Math.max(0, ...Object.values(msg.resultados).map((r) => r.rareza)));
    const zona = $("[data-zona]", raiz);
    const ultima = msg.ronda === partida.categorias.length - 1;
    const anfitrion = sala.rol === "anfitrion";
    zona.innerHTML = `${htmlTablaEtapa(cat, jugadores, porIndice, puntosLista())}
      ${anfitrion ? `<button class="btn amarillo grande ancho" data-seguir style="margin-top:14px">${ultima ? t2.clasificacion : t2.siguiente}</button>`
        : `<p class="suave" style="text-align:center">${t2.esperandoSiguiente}</p>`}`;
    montarSprites(zona);
    $("[data-etapa]", raiz).textContent = `${t2.ronda} ${msg.ronda + 1} ${t2.de} ${partida.categorias.length}`;
    $("[data-marcador]", raiz).textContent = partida.puntos[sala.miId] || 0;
    pintarEtapas(raiz, msg.ronda + 1, partida.rarezas);
    const mio = msg.resultados[sala.miId];
    if (Object.values(msg.resultados).some((f) => f.choque)) setTimeout(() => sonido.choque(), 300);
    else if (mio) celebrar(mio, $(".tabla-etapa", zona));
    requestAnimationFrame(() => celebrarPlaneta(moverAltimetro(raiz, puntosLista())));
    $("[data-seguir]", zona)?.addEventListener("click", () => { sonido.clic(); sala.siguiente(); }, { once: true });
  }

  function pintarPodio(msg) {
    const t2 = T();
    jugadores = msg.jugadores;
    partida = null;
    enPodio = true;
    const raiz = pantalla(htmlPodio(jugadores, jugadores.map((j) => msg.puntos[j.id] || 0)));
    sonido.fin();
    const acciones = $("[data-acciones]", raiz);
    if (sala.rol === "anfitrion") acciones.insertAdjacentHTML("beforeend", `<button class="btn amarillo grande" data-otra>${t2.otraVez}</button>`);
    acciones.insertAdjacentHTML("beforeend", `<button class="btn grande" data-volver>${t2.salir}</button>`);
    $("[data-otra]", raiz)?.addEventListener("click", () => sala.volverASala());
    $("[data-volver]", raiz).addEventListener("click", () => ir("inicio"));
  }

  // ------------------------------------------------------------ mensajes de la sala

  async function alEvento(msg) {
    if (cerrada) return;
    switch (msg.tipo) {
      case "sala":
        jugadores = msg.jugadores;
        if ((partida || enPodio) && !msg.lobby) break;   // alguien se ha ido a mitad de partida: se sigue jugando
        partida = null; enPodio = false;
        if (sala) pintarSala();
        break;
      case "rechazo":
        sala?.cerrar(); sala = null;
        pintarEntrada(msg.motivo === "llena" ? t.salaLlena : t.salaNoExiste);
        break;
      case "empezar":
        jugadores = msg.jugadores;
        if (msg.idioma !== estado.idioma) { cambiarIdioma(msg.idioma); await cargarDatos(); }
        partida = { categorias: msg.categorias, ronda: 0, puntos: {}, rarezas: [], respondidos: [], raiz: null };
        sonido.despegue();
        empezarRonda(0);
        break;
      case "progreso": {
        if (!partida || msg.ronda !== partida.ronda) break;
        partida.respondidos = msg.respondidos;
        const cont = partida.raiz && $("[data-respondidos]", partida.raiz);
        if (cont) { cont.innerHTML = htmlJugadores(jugadores, sala.miId, msg.respondidos); montarSprites(cont); }
        const rotulo = partida.raiz && $("[data-etapa]", partida.raiz);
        if (rotulo) rotulo.textContent = `${T().ronda} ${partida.ronda + 1} ${T().de} ${partida.categorias.length} · ${msg.respondidos.length}/${jugadores.length} ✓`;
        break;
      }
      case "ronda_fin":
        if (partida) finRonda(msg);
        break;
      case "siguiente":
        if (partida) empezarRonda(msg.ronda);
        break;
      case "fin":
        pintarPodio(msg);
        break;
      case "desconectado":
        aviso(T().desconectado, "error");
        ir("inicio");
        break;
    }
  }

  pintarEntrada();
  return () => { cerrada = true; try { sala?.cerrar(); } catch { /* nada */ } };
});
