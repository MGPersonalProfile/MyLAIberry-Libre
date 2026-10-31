const path = require('path');
const { app, BrowserWindow, protocol, net, session, shell } = require('electron');

const avisos = require('./avisos.js');
const enlaces = require('./enlaces.js');

let mainWindow = null;

function enDesarrollo() {
  return !app.isPackaged && process.env.MYLAIBERRY_LOCAL !== '1';
}

function ventana() {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
}

function avisar(canal, datos) {

  require('./lan/eventos.js').emitir(canal, datos);
  const v = ventana();
  if (!v) return false;
  v.webContents.send(canal, datos);
  return true;
}

function traerAlFrente() {
  const v = ventana();
  if (!v) return false;
  if (v.isMinimized()) v.restore();
  v.focus();
  return true;
}

function createWindow() {

  avisos.quitarDeBandeja();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#141414',
      symbolColor: '#ffffff'
    },

    backgroundColor: '#141414',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const isDev = enDesarrollo();

  if (isDev) {
    mainWindow.loadURL('http://localhost:6173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  quedarseEnLaApp(mainWindow.webContents);

  mainWindow.webContents.once('did-finish-load', () => {
    const pendiente = enlaces.recogerPendiente();
    if (pendiente) avisar('importar-enlace', { url: pendiente });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`[Ventana] No se pudo cargar ${url} — ${desc} (${code})`);
    if (!isDev) {
      mainWindow.webContents.executeJavaScript(`
        document.body.innerHTML = '<div style="font-family:system-ui;color:#e5e5e5;background:#141414;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px"><h2>No se pudo cargar la interfaz</h2><p style="color:#999">${desc}</p></div>';
      `).catch(() => {  });
    }
  });
}

function quedarseEnLaApp(contenidos) {
  const esDeLaApp = (url) => url.startsWith('file://') || url.startsWith('http://localhost:6173');
  const fuera = (url) => { try { if (/^https?:$/.test(new URL(url).protocol)) shell.openExternal(url); } catch {  } };
  contenidos.on('will-navigate', (e, url) => { if (!esDeLaApp(url)) { e.preventDefault(); fuera(url); } });
  contenidos.setWindowOpenHandler(({ url }) => { fuera(url); return { action: 'deny' }; });
}

function esRespuestaDeLaApp(url) {
  let u;
  try { u = new URL(url); } catch { return true; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return true;
  return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
}

function aplicarPoliticaDeContenido() {
  session.defaultSession.webRequest.onHeadersReceived((detalles, seguir) => {
    if (!esRespuestaDeLaApp(detalles.url)) { seguir({}); return; }
    const suelta = enDesarrollo();
    const politica = [
      "default-src 'self'",

      suelta
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:"
        : "script-src 'self' 'wasm-unsafe-eval' blob:",
      "style-src 'self' 'unsafe-inline'",

      "img-src 'self' data: blob: local-file: https: http:",
      "font-src 'self' data:",

      suelta ? "connect-src 'self' ws: http://localhost:*" : "connect-src 'self'",
      "object-src 'none'",
      "frame-src 'none'",
      "base-uri 'none'",
      "form-action 'none'"
    ].join('; ');

    seguir({
      responseHeaders: {
        ...detalles.responseHeaders,
        'Content-Security-Policy': [politica]
      }
    });
  });

}

function registrarProtocoloLocal() {
  protocol.handle('local-file', (request) => {

    const filePath = decodeURIComponent(
      request.url.replace(/^local-file:\/\/\/?/, '').replace(/\?.*$/, '')
    );
    return net.fetch('file:///' + filePath);
  });

}

module.exports = {
  createWindow,
  ventana,
  avisar,
  traerAlFrente,
  enDesarrollo,
  aplicarPoliticaDeContenido,
  esRespuestaDeLaApp,
  registrarProtocoloLocal
};
