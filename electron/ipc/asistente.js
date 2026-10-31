const { ipcMain } = require('electron');

const db = require('../db.js');
const cola = require('../cola.js');
const { crearAsistente } = require('../asistente.js');
const { traducirTexto } = require('../translate.js');
const { scrapeStory } = require('../scrapers/index.js');
const { avisar } = require('../ventana.js');
const { crearLatido } = require('../asistente-latido.js');
const { fichaDeObra } = require('../asistente-obra.js');
const { esDeLaBiblioteca } = require('../origen.js');
const { porFuente, fallo, claveDeObra, filtrarObras } = require('../asistente-busqueda.js');
const { reglasDe, leerRegla, glosarioDeReglas, traducirConReglas, COMO_ESCRIBIR_UNA_REGLA } = require('../asistente-traduccion.js');

const { valorDeAjuste, CLAVES_DE_AJUSTE, POR_DEFECTO } = require('../asistente-ajustes.js');

async function buscarEnTodos(consulta, orden = 'popularidad', filtros = {}) {

  const columna = { popularidad: 'kudos_count', palabras: 'word_count', recientes: 'revised_at', relevancia: '_score' }[orden] || 'kudos_count';
  let fuentes = [
    ['AO3', () => require('../scrapers/ao3.js').buscar({ consulta, orden: columna, completa: filtros.completa, minPalabras: filtros.minPalabras, sinCrossovers: filtros.sinCrossovers })],
    ['FanFiction.net', () => require('../scrapers/buscar-ffn.js').buscar({ consulta, orden: columna })],
    ['RoyalRoad', () => require('../scrapers/buscar-royalroad.js').buscar({ consulta, orden: columna })],

    ['Project Gutenberg', () => require('../scrapers/buscar-gutenberg.js').buscar({ consulta })],

    ['WeTriedTLs', () => require('../scrapers/buscar-wetriedtls.js').buscar({ consulta, orden: columna })],
    ['Webnovel', () => require('../scrapers/buscar-webnovel.js').buscar({ consulta })]
  ];
  if (filtros.fuente) {
    const fNorm = String(filtros.fuente).toLowerCase();
    fuentes = fuentes.filter(([nombre]) => nombre.toLowerCase().includes(fNorm));
  }

  const enBiblioteca = new Set((await db.getFanfics()).filter(esDeLaBiblioteca).map(f => claveDeObra(f.url)));

  return Promise.all(fuentes.map(async ([nombre, buscar]) => {
    try {
      return porFuente(nombre, filtrarObras(await buscar(), filtros), enBiblioteca);
    } catch (e) {
      return fallo(nombre, e);
    }
  }));
}

async function leerConUnReintento(url, pausa = 20000) {
  const progreso = (p) => avisar('scrape-progress', { ...p, url });
  try {
    return await scrapeStory(url, progreso, { respaldoFicHub: true });
  } catch (e) {

    if (e.noExiste) throw e;
    await new Promise(r => setTimeout(r, pausa));
    try { return await scrapeStory(url, progreso, { respaldoFicHub: true }); }
    catch (otra) { throw new Error(`${otra.message} (reintentado tras ${pausa / 1000} s; la dirección es ${url})`); }
  }
}

async function prepararObra({ url, translate }) {
  if (!/^https?:\/\//i.test(String(url || ''))) throw new Error('Esa no es una dirección válida.');
  if (require('../libro-enlace').esEnlaceLibro(url)) {
    const r = await require('../libro-enlace').importarEnlace(url, p => avisar('scrape-progress', { ...p, url }));
    return { id: r.data.id, title: r.data.title, capitulos: r.data.totalChapters, importadaAhora: !r.yaEstaba, yaLaTenia: !!r.yaEstaba };
  }

  const suya = (await db.getFanfics()).filter(esDeLaBiblioteca).find(f => claveDeObra(f.url) === claveDeObra(url));
  if (suya) {
    return { id: suya.id, title: suya.title, capitulos: suya.totalChapters || 0, yaLaTenia: true,
      aviso: 'Ya estaba en su biblioteca: no se ha importado otra vez. Para traer capítulos nuevos, buscar_capitulos_nuevos.' };
  }

  const datos = await leerConUnReintento(url);
  if (!datos?.chapters?.length) throw new Error('De esa dirección no salió ningún capítulo.');

  const { obraParaGuardar } = require('./descargas.js');
  const guardada = await db.addFanfic(obraParaGuardar(datos));

  if (guardada.needsChapterSelection) {

  } else if (datos.chapterContents?.length) {
    for (let i = 0; i < datos.chapterContents.length; i++) {
      await db.saveChapterContent(guardada.id, i, datos.chapterContents[i]);
    }
    await db.updateDownloadCount(guardada.id, datos.chapterContents.length);
  } else {
    await cola.encolar('descargar-capitulos', { fanficId: String(guardada.id) });
  }

  if (translate) {
    const ajustes = await db.getSettings();
    require('../traduccion-anticipada.js').encolar(guardada.id, [0, 1, 2], ajustes?.lang || 'es');
  }

  return { id: guardada.id, title: guardada.title, capitulos: datos.chapters.length, importadaAhora: true,
    ...(guardada.needsChapterSelection ? { hayQueElegirCapitulos: true, aviso: 'No se descarga nada hasta elegir los capítulos: usa elegir_capitulos o dile que los elija en la ficha.' } : {}),
    ...(datos.chapterContents?.length && !guardada.needsChapterSelection ? { capitulosYaEnDisco: true, aviso: 'Recién importada, y sus capítulos ya están descargados: se puede leer ya. No la tenía antes.' } : {}) };
}

async function cambiarAjuste({ key, value }) {

  const antes = (await db.getSettings())?.[key] ?? POR_DEFECTO[key];
  const valor = valorDeAjuste(key, value, antes);

  await db.updateSettings({ [key]: valor });
  avisar('ajustes-cambiados', { [key]: valor });
  return { ok: true, [key]: valor, ...(antes !== undefined ? { antes } : {}) };
}

async function traducirFragmento(bloque, instruccion, state) {
  const ajustes = await db.getSettings();
  const texto = String(bloque?.text || bloque?.texto || '');
  if (!texto) throw new Error('Ese pasaje no trae texto.');

  const workId = bloque.workId || String(bloque.ref || '').split(':')[0];
  const guardadas = state ? reglasDe(await state.read(), workId) : [];

  const reglas = instruccion ? [...guardadas, { text: instruccion }] : guardadas;
  const glosario = workId ? await db.getGlosario(workId).catch(() => []) : [];

  const salida = await traducirConReglas({
    texto, reglas, glosario: glosario || [],
    traducir: (t) => traducirTexto(t, ajustes?.lang || 'es')
  });

  return { ref: bloque.ref, ...salida, original: salida.original.slice(0, 400), instruccion: instruccion || '' };
}

async function guardarReglaDeTraduccion(regla) {
  const leida = leerRegla(regla.text);
  if (leida.tipo === 'libre') {
    return { ...regla, aplicable: false, aviso: COMO_ESCRIBIR_UNA_REGLA };
  }
  if (regla.workId === 'global') return { ...regla, aplicable: true, alcance: 'todas las obras' };

  const glosario = (await db.getGlosario(String(regla.workId)).catch(() => [])) || [];
  const entrada = glosarioDeReglas([regla])[0];
  const sinEseTermino = glosario.filter(g => g.termino.toLowerCase() !== entrada.termino.toLowerCase());
  await db.setGlosario(String(regla.workId), [...sinEseTermino, entrada]);

  return {
    ...regla, aplicable: true, alcance: 'esta obra', enGlosario: entrada.termino,
    nota: 'Vale para las traducciones nuevas. Los capítulos ya traducidos siguen como estaban hasta rehacer sus traducciones.'
  };
}

async function quitarDelGlosario(workId, termino) {
  const glosario = (await db.getGlosario(String(workId)).catch(() => [])) || [];
  const queda = glosario.filter(g => String(g.termino).toLowerCase() !== String(termino).toLowerCase());
  if (queda.length !== glosario.length) await db.setGlosario(String(workId), queda);
  return glosario.length - queda.length;
}

async function anotarPropuesta(id, state) {
  const s = await state.read();
  const cambio = s.changes.find(c => c.id === id);
  if (!cambio) throw new Error('Esa propuesta no existe.');

  obtenerBuzon().anotar({ tipo: 'encargo', texto: cambio.request, origen: 'autor' });
  await state.update(next => {
    const c = next.changes.find(x => x.id === id);
    if (c) { c.status = 'sent'; c.sentAt = Date.now(); }
  });
  return { ok: true, anotada: true };
}

let asistente = null;

function obtenerBuzon() {
  return require('../buzon.js').crearBuzon(db.raizActual());
}

function obtener() {
  if (asistente) return asistente;

  const services = {

    library: async () => (await db.getFanfics()).filter(esDeLaBiblioteca).map(fichaDeObra),
    descargas: async () => ({ ...require('../asistente-obra.js').descargasDe(await cola.pendientes(), await db.getFanfics()), trabajandoAhora: cola.enCurso() }),
    search: buscarEnTodos,
    crearInvestigador: opciones => require('../asistente-investigar-web').crearInvestigador(opciones),

    recommendations: (consulta, subreddit) => require('../scrapers/reddit.js').recomendaciones({ consulta, subreddit }),
    leerAutor: (url) => require('../scrapers').leerAutor(url),
    prepare: prepararObra,
    settings: cambiarAjuste,

    leerAjustes: async () => { const a = (await db.getSettings()) || {};
      return { ...Object.fromEntries(CLAVES_DE_AJUSTE.filter(k => k in a).map(k => [k, a[k]])), versionDeLaApp: require('electron').app?.getVersion?.() || 'no consta' }; },
    translateFragment: traducirFragmento,
    translationRule: guardarReglaDeTraduccion,
    glosario: async (id) => (await db.getGlosario(String(id)).catch(() => [])) || [],
    quitarDelGlosario,
    revisarTodas: async () => require('../planificador.js').encolarRevisiones(await db.getFanfics(), Date.now(), { todas: true }),
    sendChange: anotarPropuesta,
    buzon: obtenerBuzon,

    llamar: (canal, args) => require('../ipc-registro.js').llamar(canal, args),
    obrasCompletas: () => db.getFanfics()
  };

  asistente = crearAsistente({ db, services });
  return asistente;
}

let latido = null;

function arrancarLatido() {
  if (!latido) latido = crearLatido({ tick: () => obtener().tick() });
  latido.arrancar();
  return latido;
}

function pararLatido() {
  latido?.parar();
}

function registrar() {

  ipcMain.handle('asistente-chat', async (event, peticion) => {
    const inicio = Date.now();
    const { avisarSiTardo } = require('../aviso-asistente.js');
    try {

      const requestId = String(peticion?.requestId || '').slice(0, 80);
      const onProgress = datos => avisar('asistente-investigacion-progreso', { ...datos, requestId });
      const r = await obtener().chat({ ...(peticion || {}), onProgress, desdeElMovil: !!event?.desdeElMovil });

      avisarSiTardo({ inicio, desdeElMovil: !!event?.desdeElMovil, texto: r?.answer?.text });
      return { status: 'ok', ...r };
    } catch (e) {

      if (!/cancelad/i.test(e.message)) avisarSiTardo({ inicio, desdeElMovil: !!event?.desdeElMovil, texto: e.message, error: true });
      return { status: 'error', message: e.message, ...(e.threadId ? { threadId: e.threadId } : {}) };
    }
  });

  ipcMain.handle('asistente-ver', async (event, point, opciones) => {
    try {
      return { status: 'ok', vista: await obtener().view(point || null, opciones || {}) };
    } catch (e) {
      return { status: 'error', message: e.message };
    }
  });

  ipcMain.handle('asistente-accion', async (event, peticion) => {
    try {
      const { action, args = {}, point = null } = peticion || {};
      return { status: 'ok', resultado: await obtener().command({ action, args, point, desdeElMovil: !!event?.desdeElMovil }) };
    } catch (e) {
      return { status: 'error', message: e.message };
    }
  });

  ipcMain.handle('asistente-leido', async (event, point) => {
    try {
      return { status: 'ok', ...await obtener().state.receipt(point) };
    } catch (e) {
      return { status: 'error', message: e.message };
    }
  });
}

module.exports = { registrar, obtener, buscarEnTodos, cambiarAjuste, arrancarLatido, pararLatido };
