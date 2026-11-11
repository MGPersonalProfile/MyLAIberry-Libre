const { ipcMain } = require('electron');
const { CatalogoSeries } = require('../series/catalogo.js');
const { clasificarObrasDeSerie, importarObrasSerie } = require('../series/importacion.js');
const { getFanfics, addFanfic } = require('../db.js');
const { esDeLaBiblioteca } = require('../origen.js');
const { comprobarDestino } = require('../asistente-web-libre.js');

const { fetchElectron } = require('../user-agent.js');
const MAX_BYTES_SERIE = 2 * 1024 * 1024;

async function leerTextoConTope(res, maxBytes = MAX_BYTES_SERIE) {
  const cl = res.headers?.get?.('content-length');
  if (cl && parseInt(cl, 10) > maxBytes) {
    throw new Error(`Respuesta excede el tamaño máximo (${cl} bytes)`);
  }
  if (res.body && typeof res.body[Symbol.asyncIterator] === 'function') {
    let total = 0;
    const trozos = [];
    for await (const chunk of res.body) {
      total += chunk.length;
      if (total > maxBytes) throw new Error(`Respuesta excede el tamaño máximo`);
      trozos.push(chunk);
    }
    return Buffer.concat(trozos).toString('utf-8');
  }
  const txt = await res.text();
  if (Buffer.byteLength(txt, 'utf-8') > maxBytes) {
    throw new Error(`Respuesta excede el tamaño máximo`);
  }
  return txt;
}

async function fetchSerie(url) {
  await comprobarDestino(url);
  const res = await fetchElectron(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await leerTextoConTope(res);
}

async function procesarImportacionSerie(obras, opciones = {}, deps = {}) {
  const getFanficsFn = deps.getFanfics || getFanfics;
  const addFanficFn = deps.addFanfic || addFanfic;
  const esDeLaBibFn = deps.esDeLaBiblioteca || esDeLaBiblioteca;

  const todos = await getFanficsFn();
  const biblioteca = todos.filter(esDeLaBibFn);
  const serie = opciones && typeof opciones === 'object' ? opciones.serie : undefined;
  return await importarObrasSerie(obras, { serie, addFanfic: addFanficFn, biblioteca });
}

function registrar() {
  ipcMain.handle('obtener-catalogo-serie', async (_event, serieUrl, opciones = {}) => {
    const fetcher = opciones.fetcher || fetchSerie;
    const motor = new CatalogoSeries({ fetcher });
    const serie = await motor.obtenerCatalogoConRespaldo(serieUrl, opciones.seriePrevia);
    const todos = await getFanfics();
    const biblioteca = todos.filter(esDeLaBiblioteca);
    const clasificacion = clasificarObrasDeSerie(serie.obras || [], biblioteca);
    return {
      ...serie,
      clasificacion
    };
  });

  ipcMain.handle('importar-obras-serie', async (_event, obras = [], opciones = {}) => {
    return await procesarImportacionSerie(obras, opciones);
  });
}

module.exports = { registrar, fetchSerie, procesarImportacionSerie };
