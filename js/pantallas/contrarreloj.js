// Modos contrarreloj de un jugador: Lluvia de meteoritos (una categoría, todas las respuestas que puedas)
// y Maratón orbital (categorías sin parar; las respuestas raras dan tiempo extra).
import { buscar, MODOS, BONUS_MARATON, COSTE_SALTO, PENALIZACION_FALLO, categoriasPractica } from "../motor.js";
import { $, T, ruta, ir, pantalla, escapar, capital, COLOR_RAREZA, COLORES_JUGADOR } from "../ui.js";
import { estado } from "../estado.js";
import { sonido } from "../sonido.js";
import { htmlAltimetro, moverAltimetro, celebrarPlaneta, temporizador, htmlTarjeta, marcarFallo, enfocar, celebrar } from "./comun.js";
import { activarAbandonar } from "./rondas.js";

function htmlContrarreloj(t, cat, { segmentos, pie }) {
  return `<div class="juego-rejilla">
    <aside>${htmlAltimetro([{ color: COLORES_JUGADOR[0] }])}</aside>
    <section class="juego">
      <div class="hud">
        <div class="hud-izq">
          <button class="btn icono chico" data-abandonar aria-label="${t.abandonar}">✕</button>
          <span class="contador"><b data-cuantas>0</b> ${t.respuestas}</span>
        </div>
        <span class="marcador"><b data-marcador>0</b><small>${t.puntos}</small></span>
      </div>
      <div data-zona>${htmlTarjeta(cat, { segmentos, pie })}</div>
    </section>
  </div>`;
}

function subir(marcador, puntos) {
  marcador.textContent = puntos;
  marcador.classList.remove("sube"); void marcador.offsetWidth; marcador.classList.add("sube");
}

// ---------------------------------------------------------------- Lluvia de meteoritos

ruta("lluvia", () => {
  const t = T();
  const datos = estado.datos[estado.idioma];
  const cat = datos.porId[categoriasPractica(datos.ids, 1)[0]];
  const raiz = pantalla(htmlContrarreloj(t, cat, { segmentos: 30, pie: `<ul class="lista-chips lluvia-lista" data-lista></ul>` }), "partida");
  const tarjeta = $(".tarjeta", raiz), input = $("input", tarjeta), lista = $("[data-lista]", raiz);
  const marcador = $("[data-marcador]", raiz), cuantas = $("[data-cuantas]", raiz), msg = $(".mensaje", tarjeta);
  const encontradas = [];
  let puntos = 0, terminado = false;
  activarAbandonar(raiz);
  sonido.despegue();

  const reloj = temporizador({
    segundos: MODOS.lluvia.total, barra: $(".segmentos", tarjeta), numero: $("[data-segundos]", tarjeta),
    alAcabar: () => {
      terminado = true;
      sonido.sinTiempo();
      input.blur();
      setTimeout(() => ir("resultados", { modo: "lluvia", puntos, categoria: cat.id, encontradas, nuevo: true }), 900);
    },
  });

  $("form", tarjeta).addEventListener("submit", (e) => {
    e.preventDefault();
    if (terminado) return;
    const escrito = input.value.trim();
    if (!escrito) return;
    const r = buscar(cat, escrito);
    if (!r) { reloj.quitar(PENALIZACION_FALLO); marcarFallo(tarjeta, `${t.noValida} · −${PENALIZACION_FALLO} s`); return; }
    if (encontradas.includes(r.respuesta)) { marcarFallo(tarjeta, t.yaUsada); return; }
    encontradas.push(r.respuesta);
    puntos += r.respuesta.puntos;
    input.value = "";
    msg.className = "mensaje bien";
    msg.textContent = `${capital(r.respuesta.nombre)} · ${t.rareza[r.respuesta.rareza]}`;
    lista.insertAdjacentHTML("afterbegin",
      `<li style="--c:${COLOR_RAREZA[r.respuesta.rareza]}">${escapar(capital(r.respuesta.nombre))}<small>${r.respuesta.puntos}</small></li>`);
    cuantas.textContent = encontradas.length;
    subir(marcador, puntos);
    celebrar({ respuesta: r.respuesta.nombre, rareza: r.respuesta.rareza, puntos: r.respuesta.puntos }, $(".nombre-cat", tarjeta));
    celebrarPlaneta(moverAltimetro(raiz, [puntos]));
  });
  enfocar(input);
  return () => { terminado = true; reloj.parar(); };
});

// ---------------------------------------------------------------- Maratón orbital

ruta("maraton", () => {
  const t = T();
  const datos = estado.datos[estado.idioma];
  const orden = categoriasPractica(datos.ids, datos.ids.length);
  let indice = 0;
  let cat = datos.porId[orden[0]];
  const pie = `<button type="button" class="btn chico" data-saltar>${t.saltarCoste(COSTE_SALTO)}</button>`;
  const raiz = pantalla(htmlContrarreloj(t, cat, { segmentos: 30, pie }), "partida");
  const tarjeta = $(".tarjeta", raiz), input = $("input", tarjeta), msg = $(".mensaje", tarjeta);
  const marcador = $("[data-marcador]", raiz), cuantas = $("[data-cuantas]", raiz);
  const etapas = [];
  let puntos = 0, terminado = false;
  activarAbandonar(raiz);
  sonido.despegue();

  const total = MODOS.maraton.total;
  const reloj = temporizador({
    segundos: total, total, barra: $(".segmentos", tarjeta), numero: $("[data-segundos]", tarjeta),
    alAcabar: () => {
      terminado = true;
      sonido.sinTiempo();
      input.blur();
      setTimeout(() => ir("resultados", { modo: "maraton", puntos, etapas, nuevo: true }), 900);
    },
  });

  function siguienteCategoria() {
    indice = (indice + 1) % orden.length;
    cat = datos.porId[orden[indice]];
    $("[data-icono]", tarjeta).textContent = cat.icono;
    $("[data-nombre]", tarjeta).textContent = cat.nombre;
    input.value = "";
    tarjeta.classList.remove("entra"); void tarjeta.offsetWidth; tarjeta.classList.add("entra");
    enfocar(input);
  }

  $("form", tarjeta).addEventListener("submit", (e) => {
    e.preventDefault();
    if (terminado) return;
    const escrito = input.value.trim();
    if (!escrito) return;
    const r = buscar(cat, escrito);
    if (!r) { reloj.quitar(PENALIZACION_FALLO); marcarFallo(tarjeta, `${t.noValida} · −${PENALIZACION_FALLO} s`); return; }
    const { nombre, rareza, puntos: p } = r.respuesta;
    etapas.push({ categoria: cat.id, respuesta: nombre, rareza, puntos: p });
    puntos += p;
    const extra = BONUS_MARATON[rareza];
    if (extra) reloj.anadir(extra);
    msg.className = "mensaje bien";
    msg.innerHTML = `${escapar(capital(nombre))} · ${t.rareza[rareza]}${extra ? ` <span class="extra">${t.tiempoExtra(extra)}</span>` : ""}`;
    cuantas.textContent = etapas.length;
    subir(marcador, puntos);
    celebrar({ respuesta: nombre, rareza, puntos: p }, $(".nombre-cat", tarjeta));
    celebrarPlaneta(moverAltimetro(raiz, [puntos]));
    siguienteCategoria();
  });

  $("[data-saltar]", tarjeta).addEventListener("click", () => {
    if (terminado) return;
    reloj.quitar(COSTE_SALTO);
    etapas.push({ categoria: cat.id, respuesta: null, rareza: 0, puntos: 0, saltada: true });
    msg.className = "mensaje";
    msg.textContent = `−${COSTE_SALTO} s`;
    sonido.fallo();
    siguienteCategoria();
  });

  enfocar(input);
  return () => { terminado = true; reloj.parar(); };
});
