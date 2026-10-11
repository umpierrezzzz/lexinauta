// Reto de un amigo (enlace ?reto=…): mismas categorías, y al final se comparan los resultados.
import { destinoDelDia } from "../motor.js";
import { $, T, ruta, ir, pantalla, escapar, capital, planeta, cohete, COLORES_JUGADOR } from "../ui.js";
import { estado } from "../estado.js";
import { sonido } from "../sonido.js";

ruta("reto", (reto) => {
  const t = T();
  const datos = estado.datos[estado.idioma];
  const categorias = reto.categorias.filter((id) => datos.porId[id]);
  if (categorias.length === 0) return ir("inicio");
  const suyos = reto.resultados.reduce((s, r) => s + r.puntos, 0);
  const destino = destinoDelDia(suyos).id;
  const nombre = reto.nombre || t.nombrePorDefecto;

  const raiz = pantalla(`<section class="final pantalla estrecha">
    <div class="final-escena" aria-hidden="true">
      ${planeta(destino, 48)}
      ${cohete(COLORES_JUGADOR[1], "", null, "", "clasico")}
    </div>
    <span class="chip rosa">${t.retoDe(escapar(nombre))}</span>
    <h1 class="destino">${capital(t.destinos[destino])}</h1>
    <p class="subtitulo">${t.retoIntro(escapar(nombre), `${capital(t.destinos[destino])} (${suyos} ${t.puntos})`)}</p>
    <ol class="lista-etapas">${categorias.map((id, i) => `<li style="--c:var(--borde-claro);animation-delay:${i * 60}ms">
      <span class="le-icono">${datos.porId[id].icono}</span><div><span>${escapar(datos.porId[id].nombre)}</span></div><span class="le-puntos">?</span></li>`).join("")}</ol>
    <div class="acciones">
      <button class="btn rosa grande" data-aceptar>🚀 ${t.aceptarReto}</button>
      <button class="btn grande" data-volver>${t.volver}</button>
    </div>
  </section>`);

  $("[data-aceptar]", raiz).addEventListener("click", () => {
    sonido.clic();
    ir("rondas", { modo: "reto", categorias, rival: { nombre, resultados: reto.resultados } });
  });
  $("[data-volver]", raiz).addEventListener("click", () => ir("inicio"));
});
