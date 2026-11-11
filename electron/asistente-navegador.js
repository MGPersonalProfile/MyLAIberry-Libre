const { BrowserWindow, powerMonitor: monitorElectron } = require('electron');
const { cargarPagina, mientrasAvance, ejecutarAunqueNavegue, muestraDePagina, exigirQueNoSeaUnReto } = require('./scrapers/navegar');
const { conPlazo: conPlazoDeReto, planDeReto, nombreDeSitio, detectarReto } = require('./asistente-reto');
const { esCaidoOLimitado, errorCaido, exigirDisponible } = require('./ao3-caido');

const SITIOS = new Set(['archiveofourown.org', 'www.fanfiction.net', 'www.royalroad.com', 'www.wattpad.com']);
const MAX_PAGINAS = 64;
const PAUSA = 1200;
const MAX_VENTANAS = 2;
let ventanasAbiertas = 0;
const dormir = ms => new Promise(resolve => setTimeout(resolve, ms));

function permitido(direccion, sitios = SITIOS) {
  const u = new URL(direccion);
  const localDePrueba = u.protocol === 'http:' && u.hostname === '127.0.0.1' && sitios.has('127.0.0.1');
  if ((u.protocol !== 'https:' && !localDePrueba) || u.username || u.password || !sitios.has(u.hostname)) {
    throw new Error('La investigación sólo abre páginas públicas de los sitios admitidos.');
  }
  return u;
}

function reglasDeRobots(texto) {
  const grupos = [];
  let actual = { agentes: [], reglas: [], pausa: 0 };
  for (const linea of texto.split(/\r?\n/)) {
    const m = linea.replace(/#.*/, '').match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);
    if (!m) continue;
    const clave = m[1].toLowerCase(), valor = m[2];
    if (clave === 'user-agent') {
      if (actual.reglas.length || actual.pausa) { grupos.push(actual); actual = { agentes: [], reglas: [], pausa: 0 }; }
      actual.agentes.push(valor.toLowerCase());
    } else if (['allow', 'disallow'].includes(clave) && actual.agentes.length) {
      actual.reglas.push({ tipo: clave, patron: valor });
    } else if (clave === 'crawl-delay' && actual.agentes.length) {
      actual.pausa = Math.max(0, Number(valor) || 0) * 1000;
    }
  }
  grupos.push(actual);
  return grupos;
}

function gruposAplicables(texto) {
  const grupos = reglasDeRobots(texto);
  const propios = grupos.filter(g => g.agentes.includes('mylaiberry'));
  return propios.length ? propios : grupos.filter(g => g.agentes.includes('*'));
}

function robotsPermite(texto, ruta) {
  const reglas = gruposAplicables(texto).flatMap(g => g.reglas);
  const escapado = s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const coinciden = reglas.filter(r => r.patron && new RegExp('^' + escapado(r.patron).replace(/\$$/, '$')).test(ruta));
  coinciden.sort((a, b) => b.patron.length - a.patron.length || (a.tipo === 'allow' ? -1 : 1));
  return !coinciden.length || coinciden[0].tipo === 'allow';
}

function crearNavegador(opciones = {}) {
  const { signal, progreso = () => {}, sitios = SITIOS, maxPaginas = MAX_PAGINAS,
  fetchRobots = fetch, pausa = PAUSA, origen, entorno = process.env, plataforma = process.platform, plazos = {},
  powerMonitor = monitorElectron, pendientes = null, cargar = cargarPagina, crearVentana = opciones => new BrowserWindow(opciones) } = opciones;

  const robots = new Map();
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

  async function comprobarRobots(u, hasta) {
    if (!robots.has(u.origin)) {
      const respuesta = await fetchRobots(`${u.origin}/robots.txt`, { signal: AbortSignal.timeout(Math.max(1, Math.min(8000, fechaLimite(hasta) - Date.now()))), redirect: 'manual',
        headers: { 'user-agent': 'MyLAIberry/1.0' } });

      const texto = await respuesta.text().catch(() => '');

      const paginaHtml = /<(?:!doctype|html|body)\b/i.test(texto);
      const sinPagina = respuesta.status === 404 || (respuesta.ok && !paginaHtml);

      if (respuesta.status === 418 || esCaidoOLimitado(0, sinPagina ? '' : texto)) throw errorCaido(u.origin, respuesta.status);
      if (!respuesta.ok && respuesta.status !== 404) throw Object.assign(new Error(`No se pudo consultar robots.txt de ${u.hostname} (${respuesta.status}).`), { codigoHttp: respuesta.status, noConsultado: true, robotsNoConsultado: true });
      robots.set(u.origin, respuesta.status === 404 ? '' : texto);
    }
    if (!robotsPermite(robots.get(u.origin), u.pathname + u.search)) throw Object.assign(new Error(`robots.txt no permite visitar ${u.pathname}.`), { robotsProhibe: true });
    const espera = Math.max(0, ...gruposAplicables(robots.get(u.origin)).map(g => g.pausa));
    if (espera > 30000) throw new Error('El ritmo exigido por robots.txt supera el límite de esta investigación.');
    return espera;
  }

  const planActual = () => planDeReto({ origen, env: entorno, plataforma,
    ventanaMostrable: !win || !win.isDestroyed() && typeof win.showInactive === 'function', powerMonitor, bloqueada, plazos });

  function conPlazo(promesa, direccion, hasta = Infinity) {
    const sitio = nombreDeSitio(direccion);
    const avisar = datos => progreso({ paginas, maxPaginas, url: win && !win.isDestroyed() ? win.webContents.getURL() : direccion, ...datos });
    return conPlazoDeReto({ promesa, ventana: () => win, plan: planActual, presupuestoHasta: () => fechaLimite(hasta),
      sitio, progreso: avisar, mientrasAvance,
      cerrar: cerrarVentana, muestraDePagina, exigirQueNoSeaUnReto,
      alAbandonarReto: info => pendientes?.gestor.registrar({ requestId: pendientes.requestId, origen, ...info,
        reanudar: () => comprobarAcceso(info.url) }),
      ...(pendientes?.esperaDirectorMs > 0 ? { esperarDirector: esperarAlDirector, esperaDirectorMs: pendientes.esperaDirectorMs,
        alTerminarEspera: ms => { prorroga += ms; } } : {}) });
  }

  async function esperarAlDirector({ win: ventana, sitio, url }) {
    if (directorAusente) return 'ausente';
    const g = pendientes.gestor;
    const reto = g.registrar({ requestId: pendientes.requestId, sitio, url, origen, ventana: () => ventana, reanudar: () => comprobarAcceso(url) });
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
    const robotsPausa = await comprobarRobots(u, hasta);
    comprobarTiempo(hasta);
    if (signal?.aborted) throw new Error('Investigación cancelada.');
    const demora = Math.max(0, Math.max(pausa, robotsPausa) - (Date.now() - anterior));
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
      win.webContents.on('will-navigate', (event, target) => {
        try { permitido(target, sitios); } catch { event.preventDefault(); }
      });
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

module.exports = { crearNavegador, permitido, robotsPermite, MAX_PAGINAS };
