const { palabrasDeLaObra } = require('./palabras.js');

const MEDIDAS_MINIMAS = 3;

const MAXIMO_RAZONABLE_MS = 2 * 3600 * 1000;
const MINIMO_RAZONABLE_MS = 10 * 1000;

const PPM_MAXIMO = 1200;
const PPM_MINIMO = 50;
const esLectura = (palabras, ms) => { const ppm = palabras / (ms / 60000); return ppm >= PPM_MINIMO && ppm <= PPM_MAXIMO; };

function anotarLectura(medidas = [], palabras, ms) {
  if (!palabras || palabras < 100) return medidas;
  if (ms < MINIMO_RAZONABLE_MS || ms > MAXIMO_RAZONABLE_MS) return medidas;
  if (!esLectura(palabras, ms)) return medidas;

  return [...medidas, { palabras, ms }].slice(-20);
}

function palabrasPorMinuto(medidas = []) {

  medidas = medidas.filter(m => m && esLectura(m.palabras, m.ms));
  if (medidas.length < MEDIDAS_MINIMAS) return null;

  const ritmos = medidas
    .map(m => m.palabras / (m.ms / 60000))
    .sort((a, b) => a - b);

  const medio = Math.floor(ritmos.length / 2);
  const mediana = ritmos.length % 2
    ? ritmos[medio]
    : (ritmos[medio - 1] + ritmos[medio]) / 2;

  return Math.round(mediana);
}

function minutosRestantes(obra, medidas = []) {
  const ppm = palabrasPorMinuto(medidas);
  if (!ppm) return null;

  const total = obra.totalChapters || (obra.chapterList || []).length || 0;
  const leidos = obra.currentChapter || 0;
  if (!total || leidos >= total) return 0;

  const palabrasTotales = palabrasDeLaObra(obra);
  if (!palabrasTotales) return null;

  const porCapitulo = palabrasTotales / total;
  return Math.round((porCapitulo * (total - leidos)) / ppm);
}

module.exports = {
  anotarLectura,
  palabrasPorMinuto,
  minutosRestantes,
  MEDIDAS_MINIMAS
};
