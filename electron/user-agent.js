const PLATAFORMAS = {
  win32: 'Windows NT 10.0; Win64; x64',
  darwin: 'Macintosh; Intel Mac OS X 10_15_7',
  linux: 'X11; Linux x86_64'
};

const AGENTE_ROBOTS = 'MyLAIberry/1.0';

const sinMarcaDeElectron = (ua) => String(ua).replace(/\s*(Electron|mylaiberry|MyLAIberry)\/\S+/g, '');

function agente() {
  const chrome = process.versions.chrome;
  return `Mozilla/5.0 (${PLATAFORMAS[process.platform] || PLATAFORMAS.linux}) AppleWebKit/537.36 (KHTML, like Gecko)`
    + `${chrome ? ` Chrome/${chrome}` : ''} Safari/537.36`;
}

const idiomas = new WeakMap();

function configurarSesion(ses, idioma) {
  if (!ses?.setUserAgent) return ses;
  if (idioma) idiomas.set(ses, idioma);
  if (idiomas.has(ses)) ses.setUserAgent(agente(), idiomas.get(ses)); else ses.setUserAgent(agente());
  return ses;
}

function configurarVentana(win) {
  const wc = win?.webContents;
  if (!wc) return win;
  wc.setUserAgent(agente());
  wc.on?.('did-create-window', (hija) => configurarVentana(hija));
  return win;
}

function crearVentana(opciones = {}) {
  const { BrowserWindow, session } = require('electron');
  const wp = opciones.webPreferences || {};
  configurarSesion(wp.session || (wp.partition ? session.fromPartition(wp.partition) : session.defaultSession));
  return configurarVentana(new BrowserWindow(opciones));
}

function iniciar(app = require('electron').app, session = require('electron').session) {
  app.on('session-created', (ses) => configurarSesion(ses));
  if (app.isReady?.()) configurarSesion(session.defaultSession);
  else app.whenReady().then(() => configurarSesion(session.defaultSession));
}

function cabeceras(extra = {}) {
  const fuera = {};
  for (const [k, v] of (extra instanceof Headers ? extra.entries() : Object.entries(extra))) {
    if (k.toLowerCase() !== 'user-agent') fuera[k] = v;
  }
  return { ...fuera, 'User-Agent': agente() };
}

const conAgente = (opciones = {}) => ({ ...opciones, headers: cabeceras(opciones.headers) });

const fetchWeb = (url, opciones) => fetch(url, conAgente(opciones));

function fetchElectron(url, opciones) {
  const net = require('electron').net;
  return net?.fetch ? net.fetch(url, conAgente(opciones)) : fetch(url, conAgente(opciones));
}

module.exports = { agente, sinMarcaDeElectron, configurarSesion, configurarVentana, crearVentana, iniciar,
  cabeceras, conAgente, fetchWeb, fetchElectron, AGENTE_ROBOTS };
