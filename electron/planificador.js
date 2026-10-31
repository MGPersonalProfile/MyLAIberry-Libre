const cola = require('./cola.js');
const {
  getFanfics, getAutores, getSuscripciones, getQueue, dequeueDownload, getSettings
} = require('./db.js');
const traduccion = require('./traduccion-anticipada.js');
const { esDelDisco } = require('./epub-importar.js');

const { HORAS_ENTRE_COMPROBACIONES, TOPE_REVISION } = require('./ritmo-de-fondo.js');

const TOPE_CLASIFICACION = 25;

const tocaMirar = (cuando, ahora) =>
  ahora - (cuando || 0) > HORAS_ENTRE_COMPROBACIONES * 3600 * 1000;

async function migrarColaVieja() {
  const viejas = await getQueue();
  if (viejas.length === 0) return 0;

  await cola.encolarVarias('descargar-capitulos', viejas.map(j => ({ fanficId: String(j.fanficId) })));
  for (const j of viejas) await dequeueDownload(j.fanficId);

  console.log(`[Migración] ${viejas.length} descarga(s) pasadas a la cola de trabajos.`);
  return viejas.length;
}

async function encolarAutores(ahora) {
  const autores = (await getAutores()).filter(a => tocaMirar(a.comprobadoEn, ahora));
  return cola.encolarVarias('comprobar-autor', autores.map(a => ({ url: a.url })));
}

async function encolarBusquedas(ahora) {
  const subs = (await getSuscripciones()).filter(s => tocaMirar(s.comprobadoEn, ahora));
  return cola.encolarVarias('comprobar-busqueda', subs.map(s => ({ id: s.id })));
}

async function encolarRevisiones(obras, ahora, { todas = false } = {}) {
  const pendientes = obras

    .filter(f => f.origen !== 'descubierta' && f.origen !== 'descartada' && f.url && !esDelDisco(f.url))
    .filter(f => todas || tocaMirar(f.revisadoEn, ahora))
    .sort((a, b) => (a.revisadoEn || 0) - (b.revisadoEn || 0))
    .slice(0, todas ? Infinity : TOPE_REVISION);

  const puestas = await cola.encolarVarias(
    'comprobar-capitulos', pendientes.map(f => ({ fanficId: String(f.id) }))
  );
  if (puestas > 0) console.log(`[Capítulos] ${puestas} obra(s) en cola para revisar el índice.`);
  return puestas;
}

async function encolarClasificaciones(obras) {
  const sinClasificar = obras
    .filter(f => f.origen !== 'descartada')
    .filter(f => !Array.isArray(f.generosCrudos) || !f.generosCrudos.length)
    .filter(f => (f.downloadedChapters || 0) > 0)
    .slice(0, TOPE_CLASIFICACION);

  const puestas = await cola.encolarVarias(
    'clasificar-genero', sinClasificar.map(f => ({ fanficId: String(f.id) })), { prioritario: true }
  );
  if (puestas > 0) console.log(`[Género] ${puestas} obra(s) en cola para clasificar.`);
  return puestas;
}

async function adelantarTraducciones(obras) {
  const ajustes = await getSettings();
  if (ajustes?.autoTranslate === false || !ajustes?.lang) return 0;

  let encoladas = 0;
  for (const f of obras) {
    const n = f.currentChapter || 0;
    if (n > 0 || (f.downloadedChapters || 0) > 0) {
      traduccion.encolar(f.id, [n, n + 1], ajustes.lang);
      encoladas++;
    }
  }
  return encoladas;
}

async function planificar({ completarFandomsQueFaltan, encolarFondosPendientes, encolarSinopsisPendientes }) {
  const ahora = Date.now();
  const obras = await getFanfics();

  await migrarColaVieja();
  await encolarAutores(ahora);
  await encolarRevisiones(obras, ahora);
  await encolarClasificaciones(obras);
  await encolarBusquedas(ahora);

  await completarFandomsQueFaltan();
  await encolarFondosPendientes();

  await encolarSinopsisPendientes();

  await adelantarTraducciones(obras);
}

const CADA_HORA = 3600 * 1000;
function replanificarCadaHora(dependencias, { cada = CADA_HORA, planificarFn = planificar } = {}) {
  let enMarcha = false;
  const reloj = setInterval(async () => {
    if (enMarcha) return;
    enMarcha = true;
    try { await planificarFn(dependencias); } catch (e) { console.warn(`[Planificador] ${e.message}`); } finally { enMarcha = false; }
  }, cada);
  return () => clearInterval(reloj);
}

async function arrancarCola() {
  await cola.arrancar();
}

module.exports = {
  planificar,
  replanificarCadaHora,
  arrancarCola,
  migrarColaVieja,
  encolarAutores,
  encolarBusquedas,
  encolarRevisiones,
  encolarClasificaciones,
  adelantarTraducciones,
  HORAS_ENTRE_COMPROBACIONES,
  TOPE_REVISION,
  TOPE_CLASIFICACION
};
