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
const { porFuente, fallo, claveDeObra } = require('../asistente-busqueda.js');
const { reglasDe, leerRegla, glosarioDeReglas, traducirConReglas, COMO_ESCRIBIR_UNA_REGLA } = require('../asistente-traduccion.js');
const { crearRegistro } = require('../asistente-peticiones.js');
const peticiones = crearRegistro(avisar);

const { valorDeAjuste, CLAVES_DE_AJUSTE, POR_DEFECTO } = require('../asistente-ajustes.js');

async function buscarEnTodos(consulta, orden = 'popularidad', filtros = {}) {

  const { FUENTES, resumen } = require('../filtros/index.js');
  const { buscarEnSitio } = require('../filtros/buscar.js');
  const pedido = { ...filtros, consulta, orden: orden || 'popularidad' };
  let fuentes = FUENTES;
  if (filtros.fuente) {
    const fNorm = String(filtros.fuente).toLowerCase();
    fuentes = fuentes.filter(nombre => nombre.toLowerCase().includes(fNorm));
  }

  const enBiblioteca = new Set((await db.getFanfics()).filter(esDeLaBiblioteca).map(f => claveDeObra(f.url)));

  return Promise.all(fuentes.map(async (nombre) => {
    try {
      const { plan, obras, aviso } = await buscarEnSitio(nombre, { ...pedido, pagina: undefined }, { pagina: filtros.pagina || 1 });

      require('../filtros/recientes.js').recordar(nombre, obras.slice(0, 8), resumen(plan));
      return { ...porFuente(nombre, obras, enBiblioteca, resumen(plan)), ...(aviso ? { aviso } : {}) };
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

    proponer: (args) => require('../propuestas.js').proponer(args),
    primerCapitulo: (args) => require('../propuestas.js').primerCapitulo(args),

    novedades: async (args) => { const r = require('../novedades.js').queHayDeNuevo(args, { vista: (await db.getSettings())?.ultimaNovedadVista,
      version: require('electron').app?.getVersion?.() }); if (r.marcar) await db.updateSettings({ ultimaNovedadVista: r.marcar }); return r; },
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

function registrar({ obtenerAsistente = obtener } = {}) {

  ipcMain.handle('asistente-chat', async (event, peticion) => {
    const inicio = Date.now();
    const { avisarSiTardo } = require('../aviso-asistente.js');
    const requestId = String(peticion?.requestId || require('node:crypto').randomUUID()).slice(0, 80);
    const scope = peticion?.point?.workId || 'library';
    let threadId = null;
    let sinLeer = false;
    peticiones.iniciar({ requestId, scope, threadId: peticion?.threadId || null, texto: String(peticion?.text || '') });
    try {

      const onProgress = datos => {
        peticiones.progreso(requestId, datos);
        avisar('asistente-investigacion-progreso', { ...datos, requestId });
      };
      const r = await obtenerAsistente().chat({ ...(peticion || {}), requestId, onProgress,
        onThread: id => { threadId = id; peticiones.hilo(requestId, id); }, desdeElMovil: !!event?.desdeElMovil });
      threadId = r.threadId || threadId;
      sinLeer = true;

      avisarSiTardo({ inicio, desdeElMovil: !!event?.desdeElMovil, texto: r?.answer?.text });
      return { status: 'ok', ...r };
    } catch (e) {
      threadId = e.threadId || threadId;
      sinLeer = !!threadId && !/cancelad/i.test(e.message);

      if (!/cancelad/i.test(e.message)) avisarSiTardo({ inicio, desdeElMovil: !!event?.desdeElMovil, texto: e.message, error: true });
      return { status: 'error', message: e.message, ...(e.threadId ? { threadId: e.threadId } : {}) };
    } finally {
      if (sinLeer && threadId) {
        try { await db.updateAssistantState(s => {
          const hilo = s?.threads?.find(t => t.id === threadId && t.scope === scope);
          if (hilo) hilo.unreadAt = Date.now();
          return s;
        }); } catch (e) { console.error('No se pudo marcar la respuesta sin leer:', e); }
      }
      peticiones.terminar(requestId, { sinLeer });
    }
  });

  ipcMain.handle('asistente-ver', async (event, point, opciones) => {
    try {
      const scope = point?.workId || 'library';
      const vista = await obtenerAsistente().view(point || null, opciones || {});
      return { status: 'ok', vista: { ...vista, enCurso: peticiones.ver(scope),
        sinLeer: (vista.threads || (await db.getAssistantState())?.threads || [])
          .filter(t => t.scope === scope && t.unreadAt).map(t => t.id) } };
    } catch (e) {
      return { status: 'error', message: e.message };
    }
  });

  ipcMain.handle('asistente-accion', async (event, peticion) => {
    try {
      const { action, args = {}, point = null } = peticion || {};
      const resultado = await obtenerAsistente().command({ action, args, point, desdeElMovil: !!event?.desdeElMovil });
      if (action === 'markRead') avisar('asistente-estado-peticion', { fase: 'leido', threadId: args.id, scope: point?.workId || 'library' });
      return { status: 'ok', resultado };
    } catch (e) {
      return { status: 'error', message: e.message };
    }
  });

  ipcMain.handle('asistente-leido', async (event, point) => {
    try {
      return { status: 'ok', ...await obtenerAsistente().state.receipt(point) };
    } catch (e) {
      return { status: 'error', message: e.message };
    }
  });
}

module.exports = { registrar, obtener, buscarEnTodos, cambiarAjuste, arrancarLatido, pararLatido };
