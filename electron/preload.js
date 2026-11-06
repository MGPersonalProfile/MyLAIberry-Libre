const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {

  getLibrary: () => ipcRenderer.invoke('get-library'),
  updateProgress: (id, currentChapter) => ipcRenderer.invoke('update-progress', id, currentChapter),

  getChapterContent: (id, chapterIndex) => ipcRenderer.invoke('get-chapter-content', id, chapterIndex),

  hasTranslation: (id, chapterIndex, lang) => ipcRenderer.invoke('has-translation', id, chapterIndex, lang),
  translateChapter: (id, chapterIndex, lang) => ipcRenderer.invoke('translate-chapter', id, chapterIndex, lang),

  buscarEnLaObra: (id, texto, hasta, idioma) => ipcRenderer.invoke('search-in-work', id, texto, hasta, idioma),

  revisarCapitulosRepetidos: (id, total) => ipcRenderer.invoke('check-repeated-chapters', id, total),
  repararObra: (id) => ipcRenderer.invoke('repair-work', id),

  fundirObras: (quedaId, sobraId) => ipcRenderer.invoke('merge-works', quedaId, sobraId),
  copiasDeLaObra: (id) => ipcRenderer.invoke('repeated-works', id),

  onTranslateProgress: (callback) => {
    const oyente = (event, data) => callback(data);
    ipcRenderer.removeAllListeners('translate-progress');
    ipcRenderer.on('translate-progress', oyente);
    return () => ipcRenderer.removeListener('translate-progress', oyente);
  },

  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings),

  listarProveedoresIA: () => ipcRenderer.invoke('listar-proveedores-ia'),
  probarIA: () => ipcRenderer.invoke('probar-ia'),
  probarClaveDeepSeek: () => ipcRenderer.invoke('probar-clave-deepseek'),
  abrirEnNavegador: (url) => ipcRenderer.invoke('abrir-en-navegador', url),

  exportarEpub: (id, opciones) => ipcRenderer.invoke('exportar-epub', id, opciones),
  mostrarFichero: (ruta) => ipcRenderer.invoke('mostrar-fichero', ruta),

  audioCapitulo: (id, indice, opciones) => ipcRenderer.invoke('audio-capitulo', id, indice, opciones),
  guardarAudioCapitulo: (id, indice, opciones) => ipcRenderer.invoke('guardar-audio-capitulo', id, indice, opciones),
  audioObra: (id, opciones) => ipcRenderer.invoke('audio-obra', id, opciones),
  guardarAudioObra: (id, opciones) => ipcRenderer.invoke('guardar-audio-obra', id, opciones),
  estadoVoces: () => ipcRenderer.invoke('estado-voces'),
  instalarVoces: () => ipcRenderer.invoke('instalar-voces'),
  onVocesProgreso: (callback) => {
    const oyente = (_event, datos) => callback(datos);
    ipcRenderer.on('voces-progreso', oyente);
    return () => ipcRenderer.removeListener('voces-progreso', oyente);
  },

  alLlegarEnlace: (cb) => {
    ipcRenderer.removeAllListeners('importar-enlace');
    const fn = (_e, datos) => cb(datos);
    ipcRenderer.on('importar-enlace', fn);
    return () => ipcRenderer.removeListener('importar-enlace', fn);
  },
  marcadorDeNavegador: () => ipcRenderer.invoke('marcador-navegador'),

  buscarEnOtrosSitios: (id) => ipcRenderer.invoke('buscar-en-otros-sitios', id),

  alPedirAbrirObra: (cb) => {
    ipcRenderer.removeAllListeners('abrir-obra');
    const fn = (_e, datos) => cb(datos);
    ipcRenderer.on('abrir-obra', fn);
    return () => ipcRenderer.removeListener('abrir-obra', fn);
  },
  avisosDisponibles: () => ipcRenderer.invoke('avisos-disponibles'),

  lanEstado: () => ipcRenderer.invoke('lan-estado'),
  avisosVia: () => ipcRenderer.invoke('avisos-via'),
  lanEncender: () => ipcRenderer.invoke('lan-encender'),
  lanApagar: () => ipcRenderer.invoke('lan-apagar'),
  lanNuevoCodigo: () => ipcRenderer.invoke('lan-nuevo-codigo'),

  listarSesiones: () => ipcRenderer.invoke('listar-sesiones'),
  comprobarSesiones: () => ipcRenderer.invoke('comprobar-sesiones'),
  iniciarSesionSitio: (id) => ipcRenderer.invoke('iniciar-sesion-sitio', id),
  importarSesionSitio: (id, cookies) => ipcRenderer.invoke('importar-sesion-sitio', id, cookies),
  iniciarSesionWeb: (url) => ipcRenderer.invoke('iniciar-sesion-web', url),
  importarSesionWeb: (dominio, cookies) => ipcRenderer.invoke('importar-sesion-web', dominio, cookies),
  cerrarSesionSitio: (id) => ipcRenderer.invoke('cerrar-sesion-sitio', id),

  deleteFanfic: (id) => ipcRenderer.invoke('delete-fanfic', id),

  setCoverPreference: (id, valor) => ipcRenderer.invoke('set-cover-preference', id, valor),

  translateSynopsis: (id, idioma) => ipcRenderer.invoke('translate-synopsis', id, idioma),

  getDiscoveries: () => ipcRenderer.invoke('get-discoveries'),
  getDiscoveryPreferences: () => ipcRenderer.invoke('get-discovery-preferences'),
  decidirDescubrimientos: (opciones) => ipcRenderer.invoke('decidir-descubrimientos', opciones),

  adoptWork: (id, opciones) => ipcRenderer.invoke('adopt-work', id, opciones),
  discardWork: (id) => ipcRenderer.invoke('discard-work', id),

  getBackdrop: (id) => ipcRenderer.invoke('get-backdrop', id),

  getSuggestions: (fanficId) => ipcRenderer.invoke('get-suggestions', fanficId),

  logReading: (id, chapterIndex, ms) => ipcRenderer.invoke('log-reading', id, chapterIndex, ms),
  registrarSesionLectura: (sesion) => ipcRenderer.invoke('registrar-sesion-lectura', sesion),
  estadisticasLectura: (zona) => ipcRenderer.invoke('estadisticas-lectura', zona),
  exportarLectura: (formato) => ipcRenderer.invoke('exportar-lectura', formato),
  getReadingPace: (id) => ipcRenderer.invoke('get-reading-pace', id),

  getRecap: (id, chapterIndex, opciones) => ipcRenderer.invoke('get-recap', id, chapterIndex, opciones),
  getChapterTitles: (id) => ipcRenderer.invoke('get-chapter-titles', id),
  setInMyList: (id, dentro) => ipcRenderer.invoke('set-in-my-list', id, dentro),
  setReadingStatus: (id, estado) => ipcRenderer.invoke('set-reading-status', id, estado),
  decidirGenero: (id, nombre, aceptar) => ipcRenderer.invoke('decidir-genero', id, nombre, aceptar),

  getGlossary: (id) => ipcRenderer.invoke('get-glossary', id),
  setGlossary: (id, glosario) => ipcRenderer.invoke('set-glossary', id, glosario),

  redoTranslations: (id) => ipcRenderer.invoke('redo-translations', id),

  redoTranslationsMany: (ids) => ipcRenderer.invoke('redo-translations-many', ids),

  onSyncConflict: (callback) => {
    const oyente = (event, data) => callback(data);
    ipcRenderer.removeAllListeners('sync-conflict');
    ipcRenderer.on('sync-conflict', oyente);
    return () => ipcRenderer.removeListener('sync-conflict', oyente);
  },

  importBookmarks: (url) => ipcRenderer.invoke('import-bookmarks', url),

  getSubscriptions: () => ipcRenderer.invoke('get-subscriptions'),
  addSubscription: (consulta, umbral) => ipcRenderer.invoke('add-subscription', consulta, umbral),
  removeSubscription: (id) => ipcRenderer.invoke('remove-subscription', id),

  getFollowedAuthors: () => ipcRenderer.invoke('get-followed-authors'),
  followAuthor: (fanficId) => ipcRenderer.invoke('follow-author', fanficId),
  unfollowAuthor: (url) => ipcRenderer.invoke('unfollow-author', url),

  onDiscoveriesUpdated: (callback) => {
    const oyente = (event, data) => callback(data);
    ipcRenderer.removeAllListeners('discoveries-updated');
    ipcRenderer.on('discoveries-updated', oyente);
    return () => ipcRenderer.removeListener('discoveries-updated', oyente);
  },

  alActualizarCapitulos: (callback) => {
    const oyente = (event, data) => callback(data);
    ipcRenderer.removeAllListeners('chapters-updated');
    ipcRenderer.on('chapters-updated', oyente);
    return () => ipcRenderer.removeListener('chapters-updated', oyente);
  },

  onGenerosActualizados: (callback) => {
    const oyente = (event, data) => callback(data);
    ipcRenderer.removeAllListeners('generos-actualizados');
    ipcRenderer.on('generos-actualizados', oyente);
    return () => ipcRenderer.removeListener('generos-actualizados', oyente);
  },

  alCambiarEstadoLectura: (callback) => {
    const oyente = (event, data) => callback(data);
    ipcRenderer.on('estado-lectura-cambiado', oyente);
    return () => ipcRenderer.removeListener('estado-lectura-cambiado', oyente);
  },

  alCambiarAjustes: (callback) => {
    const oyente = (event, data) => callback(data);
    ipcRenderer.on('ajustes-cambiados', oyente);
    return () => ipcRenderer.removeListener('ajustes-cambiados', oyente);
  },

  saveScrollPosition: (id, chapterIndex, position, meta) => ipcRenderer.invoke('save-scroll-position', id, chapterIndex, position, meta),
  listarSubrayados: (id, desde, capitulo) => ipcRenderer.invoke('listar-subrayados', id, desde, capitulo),
  operarSubrayado: (id, operacion) => ipcRenderer.invoke('operar-subrayado', id, operacion),
  getScrollPosition: (id, chapterIndex) => ipcRenderer.invoke('get-scroll-position', id, chapterIndex),

  resumeDownload: (fanficId) => ipcRenderer.invoke('resume-download', fanficId),

  estadoDeLaCola: () => ipcRenderer.invoke('queue-status'),
  pausarLaCola: (pausar) => ipcRenderer.invoke('queue-pause', pausar),

  refreshChapters: (fanficId) => ipcRenderer.invoke('refresh-chapters', fanficId),

  refreshChaptersAll: () => ipcRenderer.invoke('refresh-chapters-all'),
  onDownloadProgress: (callback) => {
    const oyente = (event, data) => callback(data);
    ipcRenderer.removeAllListeners('download-progress');
    ipcRenderer.on('download-progress', oyente);
    return () => ipcRenderer.removeListener('download-progress', oyente);
  },

  getStats: () => ipcRenderer.invoke('get-stats'),

  getDataLocation: () => ipcRenderer.invoke('get-data-location'),
  chooseDataLocation: () => ipcRenderer.invoke('choose-data-location'),
  listarCopias: () => ipcRenderer.invoke('listar-copias'),
  restaurarCopia: (archivo) => ipcRenderer.invoke('restaurar-copia', archivo),
  abrirBibliotecaExistente: () => ipcRenderer.invoke('abrir-biblioteca-existente'),
  reiniciarApp: () => ipcRenderer.invoke('reiniciar-app'),
  openDataLocation: () => ipcRenderer.invoke('open-data-location'),

  detectSite: (url) => ipcRenderer.invoke('detect-site', url),

  scrapeStory: (url) => ipcRenderer.invoke('scrape-story', url),
  elegirCapitulos: (fanficId, indices) => ipcRenderer.invoke('elegir-capitulos', fanficId, indices),

  importarLibro: () => ipcRenderer.invoke('importar-libro'),
  importarEnlaceLibro: (url) => ipcRenderer.invoke('importar-enlace-libro', url),
  abrirImportadorWeb: (url) => ipcRenderer.invoke('abrir-importador-web', url),

  buscarActualizacion: () => ipcRenderer.invoke('buscar-actualizacion'),
  instalarActualizacion: () => ipcRenderer.invoke('instalar-actualizacion'),
  onScrapeProgress: (callback) => {
    const oyente = (event, data) => callback(data);
    ipcRenderer.removeAllListeners('scrape-progress');
    ipcRenderer.on('scrape-progress', oyente);
    return () => ipcRenderer.removeListener('scrape-progress', oyente);
  },

  asistenteChat: (peticion) => ipcRenderer.invoke('asistente-chat', peticion),
  onAsistenteInvestigacionProgreso: (callback) => {
    const oyente = (_event, data) => callback(data);
    ipcRenderer.on('asistente-investigacion-progreso', oyente);
    return () => ipcRenderer.removeListener('asistente-investigacion-progreso', oyente);
  },
  onAsistenteEstadoPeticion: (callback) => {
    const oyente = (_event, data) => callback(data);
    ipcRenderer.on('asistente-estado-peticion', oyente);
    return () => ipcRenderer.removeListener('asistente-estado-peticion', oyente);
  },
  asistenteVer: (punto, opciones) => ipcRenderer.invoke('asistente-ver', punto, opciones),

  asistenteAccion: (peticion) => ipcRenderer.invoke('asistente-accion', peticion),

  asistenteLeido: (punto) => ipcRenderer.invoke('asistente-leido', punto)
});
