const { urlHttp } = require('./comic.js');

const MEDIDA = '24-11-2026';
const SITIOS = [
  { host: 'qimanga.com', motivo: 'la serie lista sus capítulos, pero la página de un capítulo sólo monta unas pocas viñetas a la vez (lector con carga diferida) y ninguna fuente las recorre' },
  { host: 'reaperscans.com', motivo: 'su servidor no respondía (Cloudflare 522 «Connection timed out», tanto a Node como a una ventana)' },
  { host: 'toonkotsu.com', motivo: 'Cloudflare da 403 a Node y sólo entra una ventana, y cada capítulo es un lector paginado que ninguna fuente recorre' }
];

const sitioDe = url => {
  const u = urlHttp(url);
  return u && SITIOS.find(s => u.hostname === s.host || u.hostname === `www.${s.host}`);
};
const esUrlDeComicSinSoporte = url => !!sitioDe(url);

async function scrape(url) {
  const sitio = sitioDe(url);
  throw Object.assign(new Error(`${sitio?.host || 'Este sitio'} es un sitio de cómics que MyLAIberry no soporta (medido el ${MEDIDA}: ${sitio?.motivo}). ` +
    'Sólo importa cómics de Webtoon, Flame Comics, MangaDex y Asura Scans.'), { noSoportado: true, noConsultado: true });
}

const downloadChapters = async (chapters) => scrape(chapters?.[0]?.url);

module.exports = { esUrlDeComicSinSoporte, scrape, downloadChapters, SITIOS };
