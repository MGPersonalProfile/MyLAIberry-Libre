const { sitioDe } = require('./scrapers/navegar.js');

const DE_SITIO = new Set(['descargar-capitulos', 'comprobar-capitulos', 'comprobar-autor', 'importar-marcadores']);
const FUENTES = { AO3: 'archiveofourown.org', FFN: 'fanfiction.net', 'FanFiction.net': 'fanfiction.net',
  RoyalRoad: 'royalroad.com', Wattpad: 'wattpad.com', Webnovel: 'webnovel.com', WeTriedTLs: 'wetriedtls.com' };

function sitioDeTarea(tarea, obras = {}) {
  if (!DE_SITIO.has(tarea.tipo)) return '';
  const carga = tarea.carga || {};
  if (carga.url) return sitioDe(carga.url);
  const obra = obras[String(carga.fanficId)];
  if (!obra || typeof obra !== 'object') return '';
  return sitioDe(obra.url) || FUENTES[obra.source] || '';
}

function pausasDe(lista, ahora = Date.now()) {
  const pausas = new Map();
  for (const tarea of lista) {
    const { sitio, hasta } = tarea.pausaSitio || {};
    if (sitio && Number(hasta) > ahora) pausas.set(sitio, Math.max(pausas.get(sitio) || 0, Number(hasta)));
  }
  return pausas;
}

module.exports = { sitioDeTarea, pausasDe };
