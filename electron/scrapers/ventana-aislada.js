const PARTICION = 'persist:mly-comics';

function verificarUrlDeVentana(destino, dominio) {
  const { comprobarForma } = require('../asistente-web-libre.js');
  const u = comprobarForma(destino);
  if (dominio && !dominio.test(u.hostname.toLowerCase())) throw new Error('fuera del sitio');
  return u;
}

function prepararVentana(win, { dominio, resolver } = {}) {
  const libre = require('../asistente-web-libre.js');
  const vigilar = (e, destino, _enSitio, isMainFrame = true) => {
    try {
      const u = libre.comprobarForma(destino);
      if (dominio && isMainFrame !== false && !dominio.test(u.hostname.toLowerCase())) throw new Error('fuera del sitio');
    } catch { e.preventDefault(); }
  };
  const exigirAntesDeCargar = async (destino) => {
    const u = await libre.comprobarDestino(destino, resolver);
    if (dominio && !dominio.test(u.hostname.toLowerCase())) throw new Error('fuera del sitio');
    return u.href;
  };
  if (typeof win.webContents?.loadURL === 'function') {
    const cargarWc = win.webContents.loadURL.bind(win.webContents);
    win.webContents.loadURL = async (destino, ...resto) => cargarWc(await exigirAntesDeCargar(destino), ...resto);
  }
  if (typeof win.loadURL === 'function') {
    const cargarWin = win.loadURL.bind(win);
    win.loadURL = async (destino, ...resto) => cargarWin(await exigirAntesDeCargar(destino), ...resto);
  }
  if (typeof win.webContents?.on === 'function') {
    win.webContents.on('will-navigate', (e, destino) => vigilar(e, destino, false, true));
    win.webContents.on('will-redirect', vigilar);
  }
  if (typeof win.webContents?.setWindowOpenHandler === 'function') {
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  }
  libre.vigilarRed(win, resolver);
  return win;
}

function crearVentanaDeComic(opciones = {}, { dominio, resolver } = {}) {
  const { crearVentana } = require('../user-agent.js');
  const webPreferences = { ...opciones.webPreferences, sandbox: true, nodeIntegration: false, contextIsolation: true, partition: PARTICION };
  return prepararVentana(crearVentana({ ...opciones, webPreferences }), { dominio, resolver });
}

function ventanaVigilada(opciones = {}, { dominio, resolver } = {}) {
  const { crearVentana } = require('../user-agent.js');
  const webPreferences = { ...opciones.webPreferences, sandbox: true, nodeIntegration: false, contextIsolation: true };
  return prepararVentana(crearVentana({ ...opciones, webPreferences }), { dominio, resolver });
}

module.exports = { prepararVentana, crearVentanaDeComic, ventanaVigilada, verificarUrlDeVentana, PARTICION };
