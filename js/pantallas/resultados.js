// Pantalla final de las partidas de un jugador: destino alcanzado, etapas, récords, compartir y retar.
import { destinoDelDia, textoCompartir, codificarReto, ejemplos } from "../motor.js";
import { $, T, ruta, ir, pantalla, escapar, capital, planeta, cohete, contar, compartirTexto, COLOR_RAREZA,
  COLORES_JUGADOR, cuentaAtrasHastaManana } from "../ui.js";
import { estado, nombrePiloto, registrarRecord, record, sumarAlViaje } from "../estado.js";
import { sonido } from "../sonido.js";
import { htmlRespuestas } from "./comun.js";

const CUADROS = ["⬛", "🟦", "🟩", "🟨", "🟧", "🟥"];

/** Enlace de reto con las categorías y los resultados de esta partida. */
export function enlaceReto(categorias, etapas) {
  const codigo = codificarReto({
    idioma: estado.idioma, categorias, nombre: nombrePiloto() || T().nombrePorDefecto,
    resultados: etapas.map((e) => ({ respuesta: e.respuesta, rareza: e.rareza, puntos: e.puntos })),
  });
  return `${location.origin}${location.pathname}?reto=${codigo}`;
}

/**
 * opciones: { modo, puntos, etapas?, categorias?, rival?, dia?, nuevo?, encontradas?, categoria? (lluvia) }
 * `nuevo`: la partida acaba de terminar (cuenta para récords y viaje); si es false, solo se vuelve a mostrar.
 */
ruta("resultados", (o) => {
  const t = T();
  const datos = estado.datos[estado.idioma];
  const destino = destinoDelDia(o.puntos).id;

  let esRecord = false;
  if (o.nuevo) {
    if (o.modo !== "diario") sumarAlViaje(o.puntos);
    if (["lluvia", "maraton", "practica"].includes(o.modo)) esRecord = registrarRecord(o.modo, o.puntos);
    sonido.fin();
  }

  // Comparación con el reto
  let veredicto = "";
  if (o.rival) {
    const suyo = o.rival.resultados.reduce((s, r) => s + r.puntos, 0);
    veredicto = o.puntos > suyo ? t.ganaste : o.puntos < suyo ? `${t.perdiste} ${escapar(o.rival.nombre)}` : t.empate;
    veredicto += ` <span class="suave">${o.puntos} – ${suyo}</span>`;
  }

  const filas = (o.etapas || []).map((e, i) => {
    const cat = datos.porId[e.categoria];
    const r = o.rival?.resultados[i];
    return `<li style="--c:${COLOR_RAREZA[e.rareza]};animation-delay:${i * 70}ms">
      <span class="le-icono">${cat?.icono || "·"}</span>
      <div><small>${escapar(cat?.nombre || "")}</small>
        <span>${e.respuesta ? escapar(capital(e.respuesta)) : e.saltada ? "⤼" : "—"}</span>
        ${r ? `<span class="le-rival">${escapar(o.rival.nombre)}: ${r.respuesta ? escapar(capital(r.respuesta)) : "—"} · ${r.puntos}</span>` : ""}
      </div>
      <span class="le-puntos">+${e.puntos}</span></li>`;
  }).join("");

  // Lluvia: lo que encontraste y lo que se escapó
  let lluvia = "";
  if (o.modo === "lluvia") {
    const cat = datos.porId[o.categoria];
    const nombres = new Set(o.encontradas.map((r) => r.nombre));
    const faltan = ejemplos(cat, 40).filter((r) => !nombres.has(r.nombre)).slice(0, 8);
    lluvia = `<div class="caja" style="width:100%;text-align:left">
      <p class="etiqueta">${cat.icono} ${escapar(cat.nombre)} · ${t.totalRespuestas(o.encontradas.length)}</p>
      <div style="margin:10px 0 14px">${htmlRespuestas([...o.encontradas].sort((a, b) => b.rareza - a.rareza))}</div>
      <p class="etiqueta">${t.respuestasLejanas}</p>
      <div style="margin-top:10px">${htmlRespuestas(faltan)}</div>
    </div>`;
  }

  const titulos = { diario: `${t.diario} #${o.dia}`, practica: t.practica, reto: o.rival ? t.retoDe(escapar(o.rival.nombre)) : "",
    lluvia: t.lluvia, maraton: t.maraton };
  const puedeRetar = ["diario", "practica", "reto"].includes(o.modo) && o.categorias;
  const repetible = ["practica", "lluvia", "maraton"].includes(o.modo);
  const mejor = record(o.modo);

  const raiz = pantalla(`<section class="final pantalla estrecha">
    <div class="final-escena" aria-hidden="true">
      ${planeta(destino === "kuiper" ? "kuiper" : destino, 48)}
      ${cohete(COLORES_JUGADOR[0])}
    </div>
    <p class="etiqueta">${titulos[o.modo] || ""}</p>
    <p class="suave" style="margin:0">${t.hoyHasLlegado}</p>
    <h1 class="destino">${capital(t.destinos[destino])}</h1>
    <p class="final-puntos"><b data-total>0</b> ${t.puntos}</p>
    ${esRecord ? `<p class="veredicto nuevo-record">★ ${t.nuevoRecord} ★</p>` : mejor && repetible ? `<p class="suave" style="margin:0">${t.record}: ${mejor}</p>` : ""}
    ${veredicto ? `<p class="veredicto">${veredicto}</p>` : ""}
    ${filas ? `<ol class="lista-etapas">${filas}</ol>` : ""}
    ${lluvia}
    <div class="acciones">
      ${o.modo === "diario" ? `<button class="btn cian grande" data-compartir>${t.compartir}</button>` : ""}
      ${puedeRetar ? `<button class="btn rosa grande" data-retar>${t.retar}</button>` : ""}
      ${repetible ? `<button class="btn amarillo grande" data-otra>${t.otraVez}</button>` : ""}
      <button class="btn grande" data-volver>${t.volver}</button>
    </div>
    ${o.modo === "diario" ? `<p class="suave">${t.yaJugado} <span class="cuenta" data-cuenta>${cuentaAtrasHastaManana()}</span></p>` : ""}
  </section>`, "final-pantalla");

  contar($("[data-total]", raiz), o.puntos);
  estado.fondo?.impulso(Math.min(85, o.puntos / 6), "#ffd23f");

  $("[data-volver]", raiz).addEventListener("click", () => ir("inicio"));
  $("[data-otra]", raiz)?.addEventListener("click", () => ir(o.modo === "practica" ? "practica" : o.modo));
  $("[data-compartir]", raiz)?.addEventListener("click", () => {
    const texto = textoCompartir({
      titulo: t.titulo, dia: o.dia, puntos: o.puntos, destino: capital(t.destinos[destino]),
      rarezas: o.etapas.map((e) => e.rareza),
    });
    compartirTexto(`${texto}\n${location.origin}${location.pathname}`, t.copiado);
  });
  $("[data-retar]", raiz)?.addEventListener("click", () => {
    const enlace = enlaceReto(o.categorias, o.etapas);
    const cuadros = o.etapas.map((e) => CUADROS[e.rareza]).join("");
    compartirTexto(`🚀 ${t.titulo} · ${t.retoDe(nombrePiloto() || t.nombrePorDefecto)}\n${capital(t.destinos[destino])} · ${o.puntos}\n${cuadros}\n${enlace}`, t.enlaceCopiado);
  });
});
