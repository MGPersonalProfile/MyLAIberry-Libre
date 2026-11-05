const MEDIDA = { AO3: 'kudos', 'FanFiction.net': 'favoritos', RoyalRoad: 'seguidores', 'Project Gutenberg': 'descargas' };

const { claveDeObra } = require('./misma-obra');

function porFuente(fuente, obras = [], enBiblioteca = new Set(), filtros) {
  return {
    fuente,

    ...(filtros ? { filtros } : {}),

    obras: obras.slice(0, 8).map(o => ({
      title: o.title,
      author: o.author,
      url: o.url,

      synopsis: String(o.synopsis || '').slice(0, 600),
      totalChapters: o.totalChapters,
      palabras: o.wordCount || undefined,
      popularidad: o.kudos ? `${o.kudos} ${MEDIDA[fuente] || 'kudos'}` : undefined,
      completa: o.completa,
      enBiblioteca: enBiblioteca.has(claveDeObra(o.url)) || undefined,
      tags: (o.tags || []).map(t => t.name || t).slice(0, 10),
      ...(o.sinComprobar ? { sinComprobar: o.sinComprobar } : {})
    }))
  };
}

function fallo(fuente, error) {
  return { fuente, error: String(error?.message || error) };
}

function aplanar(resultados) {
  const lista = Array.isArray(resultados) ? resultados : [];
  const results = [];
  const errors = [];

  for (const bloque of lista) {
    if (bloque?.error) { errors.push(`${bloque.fuente}: ${bloque.error}`); continue; }
    for (const obra of bloque?.obras || []) results.push({ ...obra, fuente: bloque.fuente });
  }

  return { results: results.filter(o => o.url), errors };
}

function filtrarObras(obras, { completa, minPalabras, minCapitulos, sinCrossovers } = {}) {
  return (obras || []).filter(o =>
    !(completa === true && o.completa === false)
    && !(minPalabras && o.wordCount && o.wordCount < minPalabras)
    && !(minCapitulos && o.totalChapters && o.totalChapters < minCapitulos)
    && !(sinCrossovers === true && esCrossover(o)));
}

function filtrarPareja(obras, pareja) {
  if (!pareja) return obras || [];
  const { casaPareja } = require('./asistente-investigar-web');
  return (obras || []).filter(o => (o.tags || []).some(t =>
    t.category === 'relationship' && casaPareja(t.name, pareja)));
}

function esCrossover(o) {

  if (typeof o.crossover === 'boolean') return o.crossover;
  const fandoms = (o.tags || []).filter(t => (t.category || '') === 'fandom').map(t => String(t.name || ''));
  return fandoms.length >= 2 || fandoms.some(f => /\bcrossover\b/i.test(f));
}

module.exports = { porFuente, fallo, aplanar, claveDeObra, filtrarObras, filtrarPareja, esCrossover };
