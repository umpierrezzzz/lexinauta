// Partida clásica de un jugador por etapas: misión diaria, entrenamiento y retos de amigos.
import { MODOS, numeroDeDia } from "../motor.js";
import { $, T, ruta, ir, pantalla, COLORES_JUGADOR } from "../ui.js";
import { estado, guardarPartidaDiaria, partidaDeHoy } from "../estado.js";
import { sonido } from "../sonido.js";
import { htmlAltimetro, moverAltimetro, celebrarPlaneta, jugarEtapa, celebrar, htmlResultadoEtapa, esperarSeguir,
  htmlEtapas, pintarEtapas } from "./comun.js";

export function htmlJuego({ jugadores, rondas }) {
  const t = T();
  return `<div class="juego-rejilla">
    <aside>${htmlAltimetro(jugadores)}</aside>
    <section class="juego">
      <div class="hud">
        <div class="hud-izq">
          <button class="btn icono chico" data-abandonar aria-label="${t.abandonar}">✕</button>
          <span class="etiqueta" data-etapa></span>
        </div>
        <span class="marcador"><b data-marcador>0</b><small>${t.puntos}</small></span>
      </div>
      ${htmlEtapas(rondas)}
      <div data-zona></div>
    </section>
  </div>`;
}

/** Botón de abandonar: pide confirmación y vuelve a la base. */
export function activarAbandonar(raiz, alAbandonar = () => ir("inicio")) {
  $("[data-abandonar]", raiz).addEventListener("click", () => {
    if (confirm(T().seguroAbandonar)) alAbandonar();
  });
}

/**
 * opciones: { modo: "diario"|"practica"|"reto", categorias: [ids], rival?: {nombre, resultados} }
 */
ruta("rondas", ({ modo, categorias, rival = null }) => {
  const t = T();
  const idioma = estado.idioma;
  const datos = estado.datos[idioma];
  const { rondas, segundos } = MODOS[modo];
  const raiz = pantalla(htmlJuego({ jugadores: [{ color: COLORES_JUGADOR[0] }], rondas }), "partida");
  const zona = $("[data-zona]", raiz), marcador = $("[data-marcador]", raiz), rotulo = $("[data-etapa]", raiz);
  let cancelado = false;
  activarAbandonar(raiz);

  // La misión diaria se guarda etapa a etapa: si se cierra la app a medias, se retoma donde iba.
  const dia = numeroDeDia();
  const previa = modo === "diario" ? partidaDeHoy(idioma) : null;
  const etapas = previa && !previa.completa ? [...previa.etapas] : [];
  let puntos = etapas.reduce((s, e) => s + e.puntos, 0);
  marcador.textContent = puntos;
  moverAltimetro(raiz, [puntos]);
  sonido.despegue();
  estado.fondo?.impulso(30, "#ffd23f");

  (async () => {
    for (let i = etapas.length; i < Math.min(rondas, categorias.length); i++) {
      const cat = datos.porId[categorias[i]];
      rotulo.textContent = `${t.ronda} ${i + 1} ${t.de} ${rondas}`;
      pintarEtapas(raiz, i, etapas.map((e) => e.rareza));
      const res = await jugarEtapa(zona, cat, { segundos });
      if (cancelado) return;

      etapas.push({ categoria: cat.id, ...res });
      puntos += res.puntos;
      if (modo === "diario") guardarPartidaDiaria(idioma, { dia, etapas, puntos, completa: false });

      const ultima = i === rondas - 1;
      const r = rival?.resultados[i];
      zona.innerHTML = htmlResultadoEtapa(cat, res, {
        boton: ultima ? t.verDestino : t.siguiente,
        rival: r ? { nombre: rival.nombre, ...r } : null,
      });
      celebrar(res, $(".puntos-etapa", zona));
      pintarEtapas(raiz, i + 1, etapas.map((e) => e.rareza));
      marcador.textContent = puntos;
      if (res.puntos) { marcador.classList.remove("sube"); void marcador.offsetWidth; marcador.classList.add("sube"); }
      celebrarPlaneta(moverAltimetro(raiz, [puntos]));
      await esperarSeguir(zona);
      if (cancelado) return;
    }
    if (modo === "diario") guardarPartidaDiaria(idioma, { dia, etapas, puntos, completa: true });
    ir("resultados", { modo, puntos, etapas, categorias, rival, dia, nuevo: true });
  })();

  return () => { cancelado = true; };
});
