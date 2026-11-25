const { powerMonitor: monitorElectron } = require('electron');
const { cargarPagina, mientrasAvance, ejecutarAunqueNavegue, muestraDePagina, exigirQueNoSeaUnReto } = require('./scrapers/navegar');
const { conPlazo: conPlazoDeReto, planDeReto, nombreDeSitio, detectarReto } = require('./asistente-reto');
const { esCaidoOLimitado, errorCaido, exigirDisponible } = require('./ao3-caido');
const { operacionDe } = require('./asistente-retos-reanudadores.js');

const SITIOS = new Set(['archiveofourown.org', 'www.fanfiction.net', 'www.royalroad.com', 'www.wattpad.com']);
const MAX_PAGINAS = 64;
const PAUSA = 1200;
const MAX_VENTANAS = 2;
let ventanasAbiertas = 0;
const dormir = ms => new Promise(resolve => setTimeout(resolve, ms));

function permitido(direccion, sitios = SITIOS) {
  const u = new URL(direccion);
  const localDePrueba = u.protocol === 'http:' && u.hostname === '127.0.0.1' && sitios.has('127.0.0.1');
  const lista = 'AO3, FanFiction.net, RoyalRoad y Wattpad';
  if (sitios.has(u.hostname) && u.protocol !== 'https:' && !localDePrueba) {
    throw Object.assign(new Error(`La investigación sólo abre páginas https de los sitios admitidos (${lista}); ${u.hostname} llegó por ${u.protocol} y no vale: usa su dirección https.`), { noConsultado: true });
  }
  if (sitios.has(u.hostname) && (u.username || u.password)) {
    throw Object.assign(new Error(`La investigación sólo abre páginas públicas de los sitios admitidos (${lista}), sin usuario ni contraseña en la dirección.`), { noConsultado: true });
  }
  if ((u.protocol !== 'https:' && !localDePrueba) || u.username || u.password || !sitios.has(u.hostname)) {
    throw Object.assign(new Error(`La investigación sólo abre páginas públicas de los sitios admitidos (${lista}); ${u.hostname} no es uno de ellos. ` +
      'Para leerla sin importarla usa navegar_web; para importar una obra de otro sitio (Webnovel, Webtoon, cómics…) usa preparar_obra con su dirección.'), { noConsultado: true });
  }
  return u;
}

function crearNavegador(opciones = {}) {
  const { signal, progreso = () => {}, sitios = SITIOS, maxPaginas = MAX_PAGINAS,
  fetchRobots = fetch, pausa = PAUSA, origen, entorno = process.env, plataforma = process.platform, plazos = {},
  powerMonitor = monitorElectron, pendientes = null, cargar = cargarPagina, crearVentana = opciones => require('./user-agent.js').crearVentana(opciones) } = opciones;

  const sondeados = new Set();
  let win = null, paginas = 0, anterior = 0, bloqueada = false, monitorActivo = false, presupuestoHasta = Infinity, directorAusente = false;
  const alBloquear = () => { bloqueada = true; };
  const alDesbloquear = () => { bloqueada = false; };
  const activarMonitor = () => { if (monitorActivo || !powerMonitor?.on) return;
    powerMonitor.on('lock-screen', alBloquear); powerMonitor.on('unlock-screen', alDesbloquear); monitorActivo = true; };
  const cerrarVentana = () => { if (win && !win.isDestroyed()) win.destroy(); win = null; };
  const cerrar = () => { cerrarVentana();
    if (monitorActivo) { powerMonitor.removeListener('lock-screen', alBloquear); powerMonitor.removeListener('unlock-screen', alDesbloquear); monitorActivo = false; } };
  activarMonitor();
  signal?.addEventListener('abort', cerrar, { once: true });

  let prorroga = 0;
  const fechaLimite = hasta => (typeof hasta === 'function' ? hasta() : hasta) + prorroga;
  const comprobarTiempo = hasta => { if (Date.now() >= fechaLimite(hasta)) throw Object.assign(
    new Error('Límite de tiempo de la investigación agotado.'), { tiempoAgotado: true, noConsultado: true }); };

  async function sondearSitio(u, hasta) {
    if (sondeados.has(u.origin)) return;

    const respuesta = await fetchRobots(`${u.origin}/robots.txt`, { signal: AbortSignal.timeout(Math.max(1, Math.min(8000, fechaLimite(hasta) - Date.now()))), redirect: 'manual',
      headers: { 'user-agent': require('./user-agent.js').AGENTE_ROBOTS } }).catch(() => null);
    if (!respuesta) return;

    const texto = await respuesta.text().catch(() => '');

    const paginaHtml = /<(?:!doctype|html|body)\b/i.test(texto);
    const sinPagina = respuesta.status === 404 || (respuesta.ok && !paginaHtml);

    if (respuesta.status === 418 || esCaidoOLimitado(0, sinPagina ? '' : texto)) throw errorCaido(u.origin, respuesta.status);
    sondeados.add(u.origin);
  }

  const planActual = () => planDeReto({ origen, env: entorno, plataforma,
    ventanaMostrable: !win || !win.isDestroyed() && typeof win.showInactive === 'function', powerMonitor, bloqueada, plazos });

  function conPlazo(promesa, direccion, hasta = Infinity) {
    const sitio = nombreDeSitio(direccion);
    const avisar = datos => progreso({ paginas, maxPaginas, url: win && !win.isDestroyed() ? win.webContents.getURL() : direccion, ...datos });

    const operacion = pendientes ? operacionDe('investigacion.leer.v1', { requestId: pendientes.requestId, url: direccion }) : undefined;
    return conPlazoDeReto({ promesa, ventana: () => win, plan: planActual, presupuestoHasta: () => fechaLimite(hasta),
      sitio, progreso: avisar, mientrasAvance,
      cerrar: cerrarVentana, muestraDePagina, exigirQueNoSeaUnReto,
      alAbandonarReto: info => pendientes?.gestor.registrar({ requestId: pendientes.requestId, origen, ...info, operacion,
        reanudar: () => comprobarAcceso(info.url) }),
      ...(pendientes?.esperaDirectorMs > 0 ? { esperarDirector: info => esperarAlDirector({ ...info, operacion }), esperaDirectorMs: pendientes.esperaDirectorMs,
        alTerminarEspera: ms => { prorroga += ms; } } : {}) });
  }

  async function esperarAlDirector({ win: ventana, sitio, url, operacion }) {
    if (directorAusente) return 'ausente';
    const g = pendientes.gestor;
    const reto = g.registrar({ requestId: pendientes.requestId, sitio, url, origen, ventana: () => ventana, reanudar: () => comprobarAcceso(url), operacion });
    progreso({ paginas, maxPaginas, url, estado: 'comprobacion', mensaje: `${sitio} pide una comprobación humana: pásala desde la PWA del móvil.` });
    const hayReto = async () => { if (ventana.isDestroyed()) throw new Error('ventana cerrada'); const m = await muestraDePagina(ventana); return detectarReto({ ...m, titulo: `${ventana.webContents.getTitle()} ${m.titulo || ''}` }); };
    const fin = await g.esperarDirector(reto.id, { hayReto, signal, hastaMs: pendientes.esperaDirectorMs, paso: Math.max(200, Math.min(1000, pendientes.esperaDirectorMs / 20)) });
    if (fin === 'agotado') { directorAusente = true; g.soltar?.(reto.id); }
    return fin;
  }

  async function comprobarAcceso(direccion) {
    const otro = crearNavegador({ ...opciones, signal: undefined, pendientes: null });
    try {
      const w = await otro.abrir(direccion);
      const lectura = await muestraDePagina(w);
      if (detectarReto({ ...lectura, titulo: `${w.webContents.getTitle()} ${lectura.titulo || ''}` })) return { ok: false, motivo: 'comprobacion-humana' };
      return { ok: true, titulo: w.webContents.getTitle(), paginas: otro.paginas };
    }
    catch (e) { if (e.reto) return { ok: false, motivo: 'comprobacion-humana' }; throw e; }
    finally { otro.cerrar(); }
  }

  async function abrir(direccion) {
    activarMonitor();
    const hasta = presupuestoHasta;
    comprobarTiempo(hasta);
    if (signal?.aborted) throw new Error('Investigación cancelada.');
    const u = permitido(direccion, sitios);
    exigirDisponible(u.href);
    if (paginas >= maxPaginas) throw new Error(`Investigación limitada a ${maxPaginas} páginas.`);
    await sondearSitio(u, hasta);
    comprobarTiempo(hasta);
    if (signal?.aborted) throw new Error('Investigación cancelada.');
    const demora = Math.max(0, pausa - (Date.now() - anterior));
    if (demora) await dormir(demora);
    comprobarTiempo(hasta);
    if (signal?.aborted) throw new Error('Investigación cancelada.');
    if (!win || win.isDestroyed()) {
      if (ventanasAbiertas >= MAX_VENTANAS) throw new Error('Ya hay dos navegadores de investigación abiertos.');
      win = crearVentana({ width: 1200, height: 900, show: false,
        webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true,
          webSecurity: true, javascript: true } });
      ventanasAbiertas++;
      const creada = win;
      creada.on('closed', () => { ventanasAbiertas--; if (win === creada) win = null; });

      win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      const libre = require('./asistente-web-libre.js');
      win.webContents.on('will-navigate', (event, target) => {
        try { permitido(target, sitios); } catch { event.preventDefault(); }
      });
      win.webContents.on('will-redirect', (event, target, _enSitio, isMainFrame = true) => {
        try {
          libre.comprobarForma(target);
          if (isMainFrame !== false) permitido(target, sitios);
        } catch { event.preventDefault(); }
      });

      if (!sitios.has('127.0.0.1')) libre.vigilarRed(win);
    }
    paginas++;
    progreso({ paginas, maxPaginas, url: u.toString(), estado: 'cargando' });
    await conPlazo(cargar(win, u.toString(), { intentos: 1, presupuestoHasta: hasta }), u.toString(), hasta);
    comprobarTiempo(hasta);
    const final = permitido(win.webContents.getURL(), sitios);
    if (final.origin !== u.origin) throw new Error('La página redirigió fuera del sitio.');
    anterior = Date.now();
    progreso({ paginas, maxPaginas, url: final.toString(), estado: 'leida' });
    return win;
  }

  async function ejecutar(guion) {
    if (!win || win.isDestroyed()) throw new Error('No hay una página abierta.');
    const hasta = presupuestoHasta;
    comprobarTiempo(hasta);
    return conPlazo(ejecutarAunqueNavegue(win, guion), win.webContents.getURL(), hasta);
  }

  return { abrir, ejecutar, cerrar, fijarPresupuesto: hasta => { presupuestoHasta = hasta ?? Infinity; },
    puedeResolverReto: () => planActual().puedeResolverReto,
    get paginas() { return paginas; }, maxPaginas };
}

module.exports = { crearNavegador, permitido, MAX_PAGINAS };
