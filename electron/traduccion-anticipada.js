const fs = require('fs');
const path = require('path');

const { glosarioParaTraducir } = require('./db.js');
const { obtenerCapituloTraducido, tieneTraduccion } = require('./translate.js');
const { avisar } = require('./ventana.js');
const { dirDeFanfic } = require('./rutas.js');

const cola = [];
let traduciendo = false;
let pausadaHasta = 0;
let detenida = false;

function detener() { detenida = true; }
function reanudar() { detenida = false; procesar(); }
function ocupada() { return traduciendo; }

const PAUSA_POR_LIMITE = 10 * 60 * 1000;

const mismoIdioma = new Map();
const CAPITULOS_PARA_CREERLO = 2;

const incompletas = new Map();
const ESPERA_TRAS_INCOMPLETA = 24 * 60 * 60 * 1000;

const enEspera = new Set();

const yaEstaEnTuIdioma = (id) => (mismoIdioma.get(id) || 0) >= CAPITULOS_PARA_CREERLO;

function pausadoHasta() {
  return pausadaHasta;
}

function anotarLimite() {
  pausadaHasta = Date.now() + PAUSA_POR_LIMITE;
  return pausadaHasta;
}

function alLlegarCapitulo(fanficId, indice, idioma) {
  const clave = `${fanficId}|${indice}|${idioma}`;
  if (!enEspera.has(clave)) return false;
  enEspera.delete(clave);
  encolar(fanficId, [indice], idioma);
  return true;
}

async function encolar(fanficId, indices, idioma) {
  if (!idioma) return;
  const id = String(fanficId);
  if (yaEstaEnTuIdioma(id)) return;

  const dir = dirDeFanfic(id);
  for (const i of indices) {
    if (i < 0) continue;
    if (tieneTraduccion(dir, i, idioma)) continue;
    if ((incompletas.get(`${id}|${i}|${idioma}`) || 0) > Date.now()) continue;

    if (!fs.existsSync(path.join(dir, `chapter_${i}.html`))) {
      enEspera.add(`${id}|${i}|${idioma}`);
      continue;
    }
    if (cola.some(t => t.fanficId === id && t.chapterIndex === i && t.idioma === idioma)) continue;
    cola.push({ fanficId: id, chapterIndex: i, idioma });
  }
  procesar();
}

async function procesar() {
  if (detenida || traduciendo || cola.length === 0) return;
  if (Date.now() < pausadaHasta) return;

  traduciendo = true;
  const tarea = cola.shift();
  const dir = dirDeFanfic(tarea.fanficId);

  try {
    if (!tieneTraduccion(dir, tarea.chapterIndex, tarea.idioma)) {
      const r = await obtenerCapituloTraducido(
        dir, tarea.chapterIndex, tarea.idioma, undefined,
        await glosarioParaTraducir(tarea.fanficId)
      );
      if (r.mismoIdioma) {
        const votos = (mismoIdioma.get(tarea.fanficId) || 0) + 1;
        mismoIdioma.set(tarea.fanficId, votos);

        if (votos >= CAPITULOS_PARA_CREERLO) {
          for (let i = cola.length - 1; i >= 0; i--) {
            if (cola[i].fanficId === tarea.fanficId) cola.splice(i, 1);
          }
          console.log(`[Traducción] "${tarea.fanficId}" ya está en ${tarea.idioma}; no se traduce.`);
        } else {
          console.log(`[Traducción] "${tarea.fanficId}" parece estar ya en ${tarea.idioma}; falta confirmarlo.`);
        }
      } else {

        mismoIdioma.delete(tarea.fanficId);
        console.log(`[Traducción] listo capítulo ${tarea.chapterIndex + 1} (${tarea.idioma}); quedan ${cola.length} en cola.`);
        avisar('translate-progress', {
          fanficId: tarea.fanficId, chapterIndex: tarea.chapterIndex, step: 'ready'
        });
      }
    }
  } catch (err) {
    if (/limitando/.test(err.message)) {

      anotarLimite();
      cola.unshift(tarea);
      console.warn('[Traducción] servicio limitando; pausa de 10 minutos.');
    } else {
      if (err.integridad) incompletas.set(`${tarea.fanficId}|${tarea.chapterIndex}|${tarea.idioma}`, Date.now() + ESPERA_TRAS_INCOMPLETA);
      console.warn(`[Traducción] capítulo ${tarea.chapterIndex}: ${err.message}${err.integridad ? ' (de fondo no se vuelve a pedir hasta dentro de 24 h)' : ''}`);
    }
  }

  traduciendo = false;
  if (cola.length > 0) {

    const falta = pausadaHasta - Date.now();
    setTimeout(procesar, falta > 0 ? falta + 100 : 1500);
  }
}

module.exports = {
  encolar,
  detener,
  reanudar,
  ocupada,
  procesar,
  alLlegarCapitulo,
  pausadoHasta,
  anotarLimite,
  yaEstaEnTuIdioma,
  PAUSA_POR_LIMITE
};
