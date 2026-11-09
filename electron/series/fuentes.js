const ao3 = require('../scrapers/series-ao3.js');
const royalroad = require('../scrapers/series-royalroad.js');
const ffn = require('../scrapers/series-ffn.js');
const webnovel = require('../scrapers/series-webnovel.js');
const sequential = require('../scrapers/series-sequential.js');

const ADAPTADORES = [
  {
    nombre: 'RoyalRoad',
    patron: /royalroad\.com/i,
    modulo: royalroad
  },
  {
    nombre: 'Archive of Our Own',
    patron: /archiveofourown\.org/i,
    modulo: ao3
  },
  {
    nombre: 'FanFiction.net',
    patron: /fanfiction\.net/i,
    modulo: ffn
  },
  {
    nombre: 'Webnovel',
    patron: /webnovel\.com/i,
    modulo: webnovel
  },
  {
    nombre: 'WeTriedTLs',
    patron: /wetriedtls\.com/i,
    modulo: sequential
  }
];

function selectorDeFuente(urlOFuente) {
  if (!urlOFuente || typeof urlOFuente !== 'string') return 'General';
  for (const a of ADAPTADORES) {
    if (a.patron.test(urlOFuente) || a.nombre.toLowerCase() === urlOFuente.toLowerCase()) {
      return a.nombre;
    }
  }
  return 'General';
}

function obtenerAdaptador(urlOFuente) {
  const nombre = selectorDeFuente(urlOFuente);
  const hallado = ADAPTADORES.find(a => a.nombre === nombre);
  if (hallado) return hallado.modulo;

  return {
    extraerSeriesDeFicha: () => [],
    extraerCatalogoDeSerie: () => ({ nombre: 'Serie', obras: [], ordenConocido: false, siguientePagina: null })
  };
}

module.exports = {
  selectorDeFuente,
  obtenerAdaptador,
  ADAPTADORES
};
