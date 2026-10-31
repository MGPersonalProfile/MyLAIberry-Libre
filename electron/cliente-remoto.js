const { app, BrowserWindow, shell, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

function urlDelServidor() {
  let url = process.env.MYLAIBERRY_SERVIDOR || '';
  if (!url) {
    try { url = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'servidor.json'), 'utf8')).url || ''; }
    catch { return null; }
  }
  try {
    const u = new URL(url);
    const tailnet = u.protocol === 'https:' && u.hostname.endsWith('.ts.net');
    const privada = u.protocol === 'http:' && /^(10|192\.168|172\.(1[6-9]|2\d|3[01])|100)\./.test(u.hostname);
    if (!tailnet && !privada) return null;
    return u.origin + u.pathname.replace(/\/(app\/?)?$/, '');
  } catch { return null; }
}

function activo() { return Boolean(urlDelServidor()); }

function paginaDeError(win, base, desc) {
  const html = `<body style="font-family:system-ui;color:#e5e5e5;background:#141414;height:100vh;margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px">
    <h2>No llego al servidor de MyLAIberry</h2><p style="color:#999">${String(desc).replace(/[<>&]/g, '')}</p>
    <p style="color:#999">¿Está encendido el servidor y Tailscale conectado en este equipo?</p>
    <button onclick="location.href='${base}/app/'" style="padding:8px 18px;border-radius:8px;border:0;background:#e50914;color:#fff;font-size:15px;cursor:pointer">Reintentar</button></body>`;
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html)).catch(() => {});
}

function abrirVentana(base, obra = null) {
  const win = new BrowserWindow({
    width: 1280, height: 800, titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#141414', symbolColor: '#ffffff' }, backgroundColor: '#141414',

    webPreferences: { contextIsolation: true, nodeIntegration: false, partition: 'persist:servidor',
      preload: path.join(__dirname, 'preload-cliente.js') },
  });
  const origen = new URL(base).origin;

  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(origen) && !url.startsWith('data:')) { e.preventDefault(); shell.openExternal(url); }
  });
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    if (code !== -3 && url.startsWith(origen)) paginaDeError(win, base, desc);
  });
  win.loadURL(conObra(base, obra));
  return win;
}

const conObra = (base, obra) => base + '/app/' + (obra ? '?compartido_url=' + encodeURIComponent(obra) : '');

function arrancar() {
  const base = urlDelServidor();
  const enlaces = require('./enlaces.js');

  if (process.argv.includes('--en-bandeja')) { app.quit(); return; }
  if (!app.requestSingleInstanceLock()) { app.quit(); return; }
  let win = null;
  if (!process.defaultApp) app.setAsDefaultProtocolClient(enlaces.ESQUEMA);
  const delArranque = process.argv.map(enlaces.extraerUrl).find(Boolean) || null;
  app.on('second-instance', (_e, argv) => {
    if (!win || win.isDestroyed()) return;
    const obra = argv.map(enlaces.extraerUrl).find(Boolean);
    if (obra) win.loadURL(conObra(base, obra));
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  ipcMain.handle('pc-entrar-en-sitio', async (_e, id) => {
    const sesiones = require('./sesiones.js');
    const r = await sesiones.abrirLogin(id, { particion: 'persist:login-sitios' });
    if (!r || !r.dentro) return { dentro: false };
    return { dentro: true, usuario: r.usuario || '', cookies: await sesiones.cookiesDelSitio(id, 'persist:login-sitios') };
  });

  ipcMain.handle('pc-entrar-en-web', async (_e, url) => {
    try { return { status: 'ok', ...await require('./sesion-libre.js').abrirLoginLibre(String(url), { particion: 'persist:login-sitios' }) }; }
    catch (e) { return { status: 'error', message: e.message }; }
  });
  app.whenReady().then(() => { win = abrirVentana(base, delArranque); });
  app.on('window-all-closed', () => app.quit());
}

module.exports = { activo, arrancar, urlDelServidor };
