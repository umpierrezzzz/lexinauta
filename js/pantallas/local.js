// Multijugador en el mismo dispositivo: de 2 a 4 pilotos por turnos, con choques si coinciden las respuestas.
import { MODOS, categoriasPractica, resolverChoques, destinoDelDia } from "../motor.js";
import { $, T, ruta, ir, pantalla, escapar, capital, planeta, cohete, montarSprites, COLORES_JUGADOR, COLOR_RAREZA } from "../ui.js";
import { estado, nombrePiloto, almacen } from "../estado.js";
import { sonido } from "../sonido.js";
import { moverAltimetro, celebrarPlaneta, jugarEtapa, celebrar, esperarSeguir, pintarEtapas } from "./comun.js";
import { htmlJuego, activarAbandonar } from "./rondas.js";

const MAX = 4;

// ---------------------------------------------------------------- configuración de pilotos

ruta("local", () => {
  const t = T();
  const guardados = almacen.leer("hp_pilotos_local", null);
  const nombres = guardados?.length >= 2 ? guardados : [nombrePiloto() || `${t.nombrePorDefecto} 1`, `${t.nombrePorDefecto} 2`];

  const raiz = pantalla(`<div class="pantalla estrecha">
    <div class="cabecera-pantalla">${cohete(COLORES_JUGADOR[1], "", 2)}<h1>${t.local}</h1></div>
    <p class="subtitulo">${t.localDesc}</p>
    <section class="caja">
      <p class="etiqueta" style="margin-bottom:12px">${t.pilotos}</p>
      <ul class="lista-pilotos" data-lista></ul>
      <button class="btn chico" data-anadir style="margin-top:12px">+ ${t.anadirPiloto}</button>
    </section>
    <button class="btn verde grande ancho" data-empezar>🚀 ${t.empezar}</button>
  </div>`);

  const lista = $("[data-lista]", raiz);
  function pintar() {
    lista.innerHTML = nombres.map((n, i) => `<li>
      ${cohete(COLORES_JUGADOR[i], "", 2)}
      <span class="campo chico"><input data-i="${i}" maxlength="14" value="${escapar(n)}" aria-label="${t.pilotos} ${i + 1}"></span>
      ${nombres.length > 2 ? `<button class="btn icono chico" data-quitar="${i}" aria-label="${t.quitar}">✕</button>` : ""}
    </li>`).join("");
    montarSprites(lista);
    $("[data-anadir]", raiz).hidden = nombres.length >= MAX;
  }
  pintar();
  lista.addEventListener("input", (e) => { if (e.target.dataset.i) nombres[e.target.dataset.i] = e.target.value; });
  lista.addEventListener("click", (e) => {
    const b = e.target.closest("[data-quitar]");
    if (b) { nombres.splice(Number(b.dataset.quitar), 1); pintar(); }
  });
  $("[data-anadir]", raiz).addEventListener("click", () => {
    if (nombres.length < MAX) { nombres.push(`${t.nombrePorDefecto} ${nombres.length + 1}`); pintar(); }
  });
  $("[data-empezar]", raiz).addEventListener("click", () => {
    const limpios = nombres.map((n, i) => n.trim() || `${t.nombrePorDefecto} ${i + 1}`);
    almacen.guardar("hp_pilotos_local", limpios);
    const jugadores = limpios.map((nombre, i) => ({ nombre, color: COLORES_JUGADOR[i] }));
    const rondas = MODOS.local.rondas;
    ir("local-juego", { jugadores, categorias: categoriasPractica(estado.datos[estado.idioma].ids, rondas) });
  });
});

// ---------------------------------------------------------------- tabla de una etapa (compartida con el online)

/** jugadores: [{nombre, color}], resultados: {indice: {respuesta, rareza, puntos, choque}} */
export function htmlTablaEtapa(cat, jugadores, resultados, puntosTotales) {
  const t = T();
  const filas = jugadores.map((j, i) => ({ j, i, r: resultados[i] || { respuesta: null, rareza: 0, puntos: 0 } }))
    .sort((a, b) => b.r.puntos - a.r.puntos);
  return `<article class="caja clara tarjeta entra">
    <p class="etiqueta">${t.resultadosEtapa}</p>
    <h2 class="nombre-cat">${cat.icono} ${escapar(cat.nombre)}</h2>
    <ol class="tabla-etapa">${filas.map(({ j, i, r }, k) => `<li style="--jc:${j.color};--c:${COLOR_RAREZA[r.rareza]};animation-delay:${k * 120}ms">
      ${cohete(j.color, "", 2)}
      <span class="resp">${r.respuesta ? escapar(capital(r.respuesta)) : "—"}
        <small>${escapar(j.nombre)} · ${puntosTotales[i]} ${t.puntos}${r.choque ? ` · <span class="choque">💥 ${t.choqueCorto}</span>` : ""}</small></span>
      <span class="pts">+${r.puntos}</span></li>`).join("")}</ol>
  </article>`;
}

/** Podio final. jugadores: [{nombre, color}], puntos: [n] */
export function htmlPodio(jugadores, puntos) {
  const t = T();
  const orden = jugadores.map((j, i) => ({ ...j, puntos: puntos[i] })).sort((a, b) => b.puntos - a.puntos);
  const empate = orden.length > 1 && orden[0].puntos === orden[1].puntos;
  return `<section class="final pantalla estrecha">
    <div class="final-escena" aria-hidden="true">
      ${planeta(destinoDelDia(orden[0].puntos).id, 48)}
      ${cohete(orden[0].color)}
    </div>
    <p class="etiqueta">${t.clasificacion}</p>
    <h1 class="destino">${empate ? t.empate : t.ganador(escapar(orden[0].nombre))}</h1>
    <ol class="podio">${orden.map((j, k) => `<li style="--jc:${j.color};animation-delay:${k * 150}ms">
      <span class="puesto">${k + 1}</span>
      ${cohete(j.color, "", 2)}
      <span class="nombre">${escapar(j.nombre)}<small>${capital(t.destinos[destinoDelDia(j.puntos).id])}</small></span>
      <span class="pts">${j.puntos}</span></li>`).join("")}</ol>
    <div class="acciones" data-acciones></div>
  </section>`;
}

// ---------------------------------------------------------------- partida

ruta("local-juego", ({ jugadores, categorias }) => {
  const t = T();
  const datos = estado.datos[estado.idioma];
  const rondas = categorias.length;
  let cancelado = false;
  const puntos = jugadores.map(() => 0);
  const rarezas = [];   // la mejor rareza de cada etapa, para las barras de arriba

  function montarJuego() {
    const raiz = pantalla(htmlJuego({ jugadores, rondas }), "partida");
    activarAbandonar(raiz);
    moverAltimetro(raiz, puntos);
    return raiz;
  }

  function turno(j) {
    return new Promise((resolver) => {
      const raiz = pantalla(`<section class="caja clara turno" style="--jc:${j.color}">
        ${cohete(j.color, "", 5)}
        <h1>${t.turnoDe(escapar(j.nombre))}</h1>
        <p class="subtitulo">${t.pasaMovil}</p>
        <button class="btn verde grande ancho" data-seguir>${t.listo}</button>
      </section>`, "partida");
      sonido.turno();
      $("[data-seguir]", raiz).addEventListener("click", () => { sonido.clic(); resolver(); }, { once: true });
    });
  }

  (async () => {
    for (let r = 0; r < rondas; r++) {
      const cat = datos.porId[categorias[r]];
      const respuestas = {};
      for (let i = 0; i < jugadores.length; i++) {
        await turno(jugadores[i]);
        if (cancelado) return;
        const raiz = montarJuego();
        $("[data-etapa]", raiz).textContent = `${t.ronda} ${r + 1} ${t.de} ${rondas}`;
        $("[data-marcador]", raiz).textContent = puntos[i];
        $("[data-marcador]", raiz).style.color = jugadores[i].color;
        pintarEtapas(raiz, r, rarezas);
        const res = await jugarEtapa($("[data-zona]", raiz), cat, { segundos: MODOS.local.segundos, etiqueta: escapar(jugadores[i].nombre) });
        if (cancelado) return;
        respuestas[i] = res;
        if (res.respuesta) sonido.acierto(Math.min(res.rareza, 2));   // sin pistas: el sonido no delata la rareza
      }

      // Resultados de la etapa con choques
      const finales = resolverChoques(respuestas);
      const raiz = montarJuego();   // con los puntos de antes, para que los cohetes suban ahora
      jugadores.forEach((_, i) => { puntos[i] += finales[i].puntos; });
      rarezas.push(Math.max(...Object.values(finales).map((f) => f.rareza)));
      $("[data-etapa]", raiz).textContent = `${t.ronda} ${r + 1} ${t.de} ${rondas}`;
      $("[data-marcador]", raiz).textContent = Math.max(...puntos);
      pintarEtapas(raiz, r + 1, rarezas);
      const zona = $("[data-zona]", raiz);
      const ultima = r === rondas - 1;
      zona.innerHTML = `${htmlTablaEtapa(cat, jugadores, finales, puntos)}
        <button class="btn amarillo grande ancho" data-seguir style="margin-top:14px">${ultima ? t.clasificacion : t.siguiente}</button>`;
      montarSprites(zona);
      const mejor = Object.values(finales).sort((a, b) => b.puntos - a.puntos)[0];
      if (Object.values(finales).some((f) => f.choque)) setTimeout(() => sonido.choque(), 300);
      else celebrar(mejor, $(".tabla-etapa", zona));
      requestAnimationFrame(() => requestAnimationFrame(() => celebrarPlaneta(moverAltimetro(raiz, puntos))));
      await esperarSeguir(zona);
      if (cancelado) return;
    }
    ir("podio", { jugadores, puntos, otra: () => ir("local-juego", { jugadores, categorias: categoriasPractica(datos.ids, rondas) }) });
  })();

  return () => { cancelado = true; };
});

ruta("podio", ({ jugadores, puntos, otra }) => {
  const t = T();
  const raiz = pantalla(htmlPodio(jugadores, puntos));
  sonido.fin();
  estado.fondo?.impulso(60, jugadores[puntos.indexOf(Math.max(...puntos))].color);
  const acciones = $("[data-acciones]", raiz);
  if (otra) acciones.insertAdjacentHTML("beforeend", `<button class="btn amarillo grande" data-otra>${t.otraVez}</button>`);
  acciones.insertAdjacentHTML("beforeend", `<button class="btn grande" data-volver>${t.volver}</button>`);
  $("[data-otra]", raiz)?.addEventListener("click", otra);
  $("[data-volver]", raiz).addEventListener("click", () => ir("inicio"));
});

