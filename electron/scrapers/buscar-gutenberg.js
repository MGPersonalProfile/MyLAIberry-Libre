const { resultadosDeBusqueda } = require('./gutenberg-opds.js');
const { pedir } = require('./gutenberg.js');

const BUSCADOR = 'https://www.gutenberg.org/ebooks/search.opds/';

const IDIOMAS = { Spanish: 'es', English: 'en', French: 'fr', German: 'de', Italian: 'it', Portuguese: 'pt', Russian: 'ru', Catalan: 'ca' };

async function buscar({ consulta, url } = {}) {
  const q = String(consulta || '').trim();
  if (!q && !url) return [];
  const r = await pedir(url || `${BUSCADOR}?${new URLSearchParams({ query: q })}`, { signal: AbortSignal.timeout(30000), redirect: 'follow' });
  if (!r.ok) throw new Error(`Gutenberg respondió ${r.status}`);
  return resultadosDeBusqueda(await r.text()).map(({ numero, titulo, autor }) => {
    const idioma = (titulo.match(/\((\w+)\)$/) || [])[1];
    return {
      idOrigen: numero,
      title: titulo,
      author: autor,
      synopsis: '',
      url: `https://www.gutenberg.org/ebooks/${numero}`,
      source: 'Project Gutenberg',
      coverUrl: `https://www.gutenberg.org/cache/epub/${numero}/pg${numero}.cover.medium.jpg`,
      language: IDIOMAS[idioma] || '',
      tags: [],
      completa: true,
      chapterList: []
    };
  });
}

module.exports = { buscar };
