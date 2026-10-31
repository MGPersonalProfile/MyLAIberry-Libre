const { BrowserWindow } = require('electron');
const { cargarPagina } = require('./scrapers/navegar');

const SITIOS = new Set(['archiveofourown.org', 'www.fanfiction.net', 'www.royalroad.com', 'www.wattpad.com']);
const MAX_PAGINAS = 12;
const ESPERA_PAGINA = 30000;
const ESPERA_RETO = 120000;
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

function crearNavegador({ signal, progreso = () => {}, sitios = SITIOS, maxPaginas = MAX_PAGINAS,
  fetchRobots = fetch, pausa = PAUSA, timeout = ESPERA_PAGINA } = {}) {

  const robots = new Map();
  let win = null, paginas = 0, anterior = 0;
  const cerrar = () => { if (win && !win.isDestroyed()) win.destroy(); win = null; };
  signal?.addEventListener('abort', cerrar, { once: true });

  async function comprobarRobots(u) {
    if (!robots.has(u.origin)) {
      const respuesta = await fetchRobots(`${u.origin}/robots.txt`, { signal: AbortSignal.timeout(8000), redirect: 'manual',
        headers: { 'user-agent': 'MyLAIberry/1.0' } });
      if (!respuesta.ok && respuesta.status !== 404) throw new Error(`No se pudo consultar robots.txt de ${u.hostname}.`);
      robots.set(u.origin, respuesta.status === 404 ? '' : await respuesta.text());
    }
    if (!robotsPermite(robots.get(u.origin), u.pathname + u.search)) throw new Error(`robots.txt no permite visitar ${u.pathname}.`);
    const espera = Math.max(0, ...gruposAplicables(robots.get(u.origin)).map(g => g.pausa));
    if (espera > 30000) throw new Error('El ritmo exigido por robots.txt supera el límite de esta investigación.');
    return espera;
  }

  function mostrarReto() {
    if (!win || win.isDestroyed()) return;
    const patron = /just a moment|verify you are human|attention required|cf-chl|checking your browser|enable javascript and cookies/i;
    const titulo = win.webContents.getTitle();
    if (patron.test(titulo) && !win.isVisible()) {
      win.setTitle('MyLAIberry — comprobación del sitio');
      win.showInactive();
      progreso({ paginas, maxPaginas, url: win.webContents.getURL(), estado: 'comprobacion' });
    }
  }

  async function conPlazo(promesa) {
    let reloj;
    const inicio = Date.now();
    const vencimiento = new Promise((_, reject) => {
      reloj = setInterval(() => {
        mostrarReto();
        const limite = win?.isVisible() ? ESPERA_RETO : timeout;
        if (Date.now() - inicio >= limite) {
          reject(new Error(`La página no respondió en ${limite / 1000} s.`));
          cerrar();
        }
      }, 500);
    });
    try { return await Promise.race([promesa, vencimiento]); }
    finally { clearInterval(reloj); if (win && !win.isDestroyed() && win.isVisible()) win.hide(); }
  }

  async function abrir(direccion) {
    if (signal?.aborted) throw new Error('Investigación cancelada.');
    const u = permitido(direccion, sitios);
    if (paginas >= maxPaginas) throw new Error(`Investigación limitada a ${maxPaginas} páginas.`);
    const robotsPausa = await comprobarRobots(u);
    if (signal?.aborted) throw new Error('Investigación cancelada.');
    const demora = Math.max(0, Math.max(pausa, robotsPausa) - (Date.now() - anterior));
    if (demora) await dormir(demora);
    if (signal?.aborted) throw new Error('Investigación cancelada.');
    if (!win || win.isDestroyed()) {
      if (ventanasAbiertas >= MAX_VENTANAS) throw new Error('Ya hay dos navegadores de investigación abiertos.');
      win = new BrowserWindow({ width: 1200, height: 900, show: false,
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
    await conPlazo(cargarPagina(win, u.toString(), { intentos: 1 }));
    const final = permitido(win.webContents.getURL(), sitios);
    if (final.origin !== u.origin) throw new Error('La página redirigió fuera del sitio.');
    anterior = Date.now();
    progreso({ paginas, maxPaginas, url: final.toString(), estado: 'leida' });
    return win;
  }

  async function ejecutar(guion) {
    if (!win || win.isDestroyed()) throw new Error('No hay una página abierta.');
    return conPlazo(win.webContents.executeJavaScript(guion));
  }

  return { abrir, ejecutar, cerrar, get paginas() { return paginas; }, maxPaginas };
}

module.exports = { crearNavegador, permitido, robotsPermite, MAX_PAGINAS };
