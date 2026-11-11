const { enfriar, sitioDe, exigirQueNoEnfrie } = require('./scrapers/navegar');
const { nombreDeSitio } = require('./asistente-reto');

const CODIGOS_LIMITADOS = new Set([418, 429, 503]);
const PATRON_MANTENIMIENTO = /request temporarily denied|down for maintenance|under maintenance|maintenance is in progress/i;

function esCaidoOLimitado(codigo, texto = '') {
  return CODIGOS_LIMITADOS.has(Number(codigo)) || PATRON_MANTENIMIENTO.test(String(texto));
}

function errorCaido(url, codigo = 418) {
  const nom = nombreDeSitio(url);
  const cod = CODIGOS_LIMITADOS.has(Number(codigo)) ? Number(codigo) : 418;
  enfriar(url);
  return Object.assign(
    new Error(`${nom} no responde ahora (${cod}: caído o limitándonos)`),
    { limitado: true, codigoHttp: cod, sitio: sitioDe(url), noConsultado: true, caido: true }
  );
}

function exigirDisponible(url, ahora = Date.now()) {
  exigirQueNoEnfrie(url, ahora);
}

const PROHIBE = 'robots.txt de AO3 prohíbe esta ruta';
const NO_CONSULTADO = 'No se pudo consultar robots.txt de AO3 (AO3 caído o limitándonos)';
function causaDe(errAO3, codigo) {
  if (errAO3?.robotsProhibe) return PROHIBE;
  if (errAO3?.robotsNoConsultado) return NO_CONSULTADO;
  return errAO3?.message ? errAO3.message.replace(/\.$/, '') : `AO3 no responde ahora (${codigo}: caído o limitándonos)`;
}

async function fichaDesdeFicHub(url, errAO3, paginasVisitadas = 0) {
  const fichub = require('./scrapers/fichub');
  let copia;
  try {
    copia = await fichub.copiaDeAO3(url);
  } catch (errFicHub) {
    const detalle = errFicHub.message.replace(/^FicHub no tiene copia:\s*/, '');
    const codigo = errAO3?.codigoHttp || 418;
    const causa = causaDe(errAO3, codigo);
    throw new Error(`${causa} y FicHub tampoco tiene copia de esta obra (${detalle}).`);
  }
  const meta = copia.meta || {};
  const obra = {
    title: copia.title || meta.title || 'Historia sin título',
    author: copia.author || meta.author || 'Autor desconocido',
    url,
    source: 'AO3',
    deCopia: 'FicHub',
    origenDatos: 'FicHub',
    synopsis: copia.synopsis || meta.description || '',
    wordCount: Number(meta.words) || copia.wordCount || 0,
    totalChapters: Number(meta.chapters) || copia.chapters?.length || 1,
    completa: meta.status === 'complete' ? true : (meta.status === 'ongoing' ? false : copia.completa),
    autorUrl: meta.authorUrl ? `https://archiveofourown.org${meta.authorUrl}` : (copia.autorUrl || ''),
    tags: [],
    avisos: [errAO3?.robotsProhibe || errAO3?.robotsNoConsultado
      ? `${causaDe(errAO3)}; los datos de la ficha proceden de la copia de FicHub.`
      : 'AO3 no responde; los datos de la ficha proceden de la copia de FicHub.'],
    etiquetasCompletas: false
  };
  const { fichaVerificada } = require('./asistente-investigar-web');
  return { ...fichaVerificada(obra), deCopia: 'FicHub', origenDatos: 'FicHub', enlaces: [], paginasVisitadas };
}

module.exports = {
  esCaidoOLimitado,
  errorCaido,
  exigirDisponible,
  fichaDesdeFicHub
};
