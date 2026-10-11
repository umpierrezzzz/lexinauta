// Base de lanzamiento: misión diaria, modos de vuelo, multijugador y el viaje acumulado.
import { numeroDeDia, categoriasDelDia, categoriasPractica, destinoDelDia, estadoViaje, KM_POR_PUNTO } from "../motor.js";
import { $, T, ruta, ir, pantalla, escapar, capital, numero, planeta, cohete, COLORES_JUGADOR, cuentaAtrasHastaManana } from "../ui.js";
import { estado, partidaDeHoy, estadisticas, record, nombrePiloto, guardarNombre } from "../estado.js";
import { sonido } from "../sonido.js";

function tarjetaModo({ id, icono, titulo, desc, acento, mejor }) {
  return `<button class="caja modo acento-${acento}" data-modo="${id}">
    <span class="modo-icono">${icono}</span>
    <h3>${titulo}</h3>
    <p>${desc}</p>
    ${mejor ? `<span class="modo-record">★ ${T().record}: ${mejor}</span>` : ""}
  </button>`;
}

function htmlDiaria(t, dia, hoy) {
  const ruta7 = ["luna", "marte", "jupiter", "saturno", "neptuno", "pluton"];
  const cabecera = `<div class="diaria-cabecera"><span class="chip">${t.diario} #${dia}</span></div>`;
  if (hoy?.completa) {
    const destino = destinoDelDia(hoy.puntos).id;
    return `<section class="caja destacada diaria">
      ${cabecera}
      <div class="diaria-hecha">
        ${planeta(destino, 24, "", 3)}
        <span class="suave">${t.hoyHasLlegado}</span>
        <b>${capital(t.destinos[destino])} · ${hoy.puntos} ${t.puntos}</b>
      </div>
      <button class="btn grande ancho" data-ver-diario>${t.verResultado}</button>
      <p class="suave" style="margin:0">${t.yaJugado} <span class="cuenta" data-cuenta>${cuentaAtrasHastaManana()}</span></p>
    </section>`;
  }
  return `<section class="caja destacada diaria">
    ${cabecera}
    <div class="diaria-ruta" aria-hidden="true">${planeta("tierra", 12, "", 2)}${ruta7.map((p) => `<span class="tramo"></span>${planeta(p, 12, "", 2)}`).join("")}</div>
    <p class="subtitulo">${t.diarioDesc}</p>
    <button class="btn amarillo grande ancho" data-jugar-diario>🚀 ${hoy ? `${t.despegar} · ${hoy.etapas?.length || 0}/7` : t.despegar}</button>
  </section>`;
}

ruta("inicio", () => {
  const t = T();
  const idioma = estado.idioma;
  const dia = numeroDeDia();
  const hoy = partidaDeHoy(idioma);
  const est = estadisticas(idioma);
  const viaje = estadoViaje(est.totalPuntos);
  const siguiente = viaje.siguiente?.id || "voyager";

  const modos = [
    { id: "lluvia", icono: planeta("asteroides", 20, "", 2), titulo: t.lluvia, desc: t.lluviaDesc, acento: "lluvia", mejor: record("lluvia") },
    { id: "maraton", icono: planeta("sol", 20, "", 2), titulo: t.maraton, desc: t.maratonDesc, acento: "maraton", mejor: record("maraton") },
    { id: "practica", icono: planeta("luna", 20, "", 2), titulo: t.practica, desc: t.practicaDesc, acento: "practica", mejor: record("practica") },
  ];
  const multi = [
    { id: "online", icono: planeta("tierra", 20, "", 2), titulo: t.online, desc: t.onlineDesc, acento: "online" },
    { id: "local", icono: `${cohete(COLORES_JUGADOR[1], "", 2)}${cohete(COLORES_JUGADOR[2], "", 2)}`, titulo: t.local, desc: t.localDesc, acento: "local" },
  ];

  const raiz = pantalla(`<div class="inicio-rejilla">
    <div class="inicio-col">
      <section class="hero">
        <div class="hero-escena" aria-hidden="true">
          ${planeta("saturno", 40)}
          ${planeta("luna", 12, "luna-px", 3)}
          ${cohete(COLORES_JUGADOR[0], "", 3)}
        </div>
        <h1 class="titulo-pixel">${t.titulo}</h1>
        <p class="subtitulo">${t.lema}</p>
      </section>
      ${htmlDiaria(t, dia, hoy)}
      <label class="nombre-piloto caja">
        <span class="etiqueta">${t.tuNombre}</span>
        <span class="campo chico"><input data-nombre maxlength="16" value="${escapar(nombrePiloto())}" placeholder="${t.nombrePorDefecto}"></span>
      </label>
    </div>
    <div class="inicio-col">
      <h2 class="seccion">${t.modos}</h2>
      <div class="rejilla-modos">${modos.map(tarjetaModo).join("")}</div>
      <h2 class="seccion">${t.multijugador}</h2>
      <div class="rejilla-modos">${multi.map(tarjetaModo).join("")}</div>
      <p class="aviso-pie">${t.retoDesc}</p>
      <h2 class="seccion">${t.tuViaje}</h2>
      <section class="caja viaje">
        <div class="viaje-cabecera">
          <span class="viaje-km">${numero(viaje.km)} km <small>${t.recorridos}</small></span>
        </div>
        <div class="viaje-pista">
          ${planeta(viaje.alcanzado.id, 12, "", 2)}
          <div class="pista"><div class="pista-hecha" data-hecha></div><div class="pista-cohete" data-cohete-viaje>${cohete(COLORES_JUGADOR[0], "", 2)}</div></div>
          ${planeta(siguiente, 12, "", 2)}
        </div>
        <div class="viaje-pie"><span>${capital(t.destinoCorto[viaje.alcanzado.id])}</span>
          <span>${viaje.siguiente ? `${t.proximoDestino}: ${t.destinoCorto[siguiente]} · ${numero((viaje.siguiente.km - viaje.km) / KM_POR_PUNTO)} ${t.puntos}` : t.hasLlegado}</span></div>
        <div class="estadisticas">
          <div class="estadistica"><b>${est.partidas}</b><span>${t.partidas}</span></div>
          <div class="estadistica"><b>${est.racha}</b><span>${t.racha}</span></div>
          <div class="estadistica"><b>${est.mejor}</b><span>${t.mejor}</span></div>
        </div>
      </section>
    </div>
  </div>`, "inicio");

  requestAnimationFrame(() => requestAnimationFrame(() => {
    const p = `${Math.round(viaje.progreso * 100)}%`;
    $("[data-hecha]", raiz).style.width = p;
    $("[data-cohete-viaje]", raiz).style.left = p;
  }));

  $("[data-jugar-diario]", raiz)?.addEventListener("click", () => ir("diario"));
  $("[data-ver-diario]", raiz)?.addEventListener("click", () => {
    ir("resultados", { modo: "diario", puntos: hoy.puntos, etapas: hoy.etapas || [], categorias: categoriasDelDia(estado.datos[idioma].ids, dia), dia });
  });
  raiz.querySelectorAll("[data-modo]").forEach((b) => b.addEventListener("click", () => { sonido.clic(); ir(b.dataset.modo); }));
  const nombre = $("[data-nombre]", raiz);
  nombre.addEventListener("change", () => guardarNombre(nombre.value));
  nombre.addEventListener("keydown", (e) => { if (e.key === "Enter") nombre.blur(); });
});

ruta("diario", () => {
  const ids = estado.datos[estado.idioma].ids;
  const hoy = partidaDeHoy(estado.idioma);
  if (hoy?.completa) return ir("inicio");
  ir("rondas", { modo: "diario", categorias: categoriasDelDia(ids, numeroDeDia()) });
});

ruta("practica", () => {
  ir("rondas", { modo: "practica", categorias: categoriasPractica(estado.datos[estado.idioma].ids) });
});
