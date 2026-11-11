const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { session, dialog } = require('electron');
const { TECHO_DEL_FICHERO } = require('./epub');
const { direccionWeb, tipoLibro } = require('./libro-enlace');
let ventana = null;

async function recibirLibro(item, destino, avisar, importar) {
  const buffer = await fs.promises.readFile(destino);
  const tipo = tipoLibro(buffer);
  const fichero = path.join(path.dirname(destino), `libro.${tipo}`);
  await fs.promises.rename(destino, fichero);
  const resultado = await importar(fichero, p => avisar('scrape-progress', p), { urlOrigen: item.getURL() });
  if (resultado?.status !== 'success') throw new Error(resultado?.message || 'No se pudo importar el libro.');
  avisar('discoveries-updated', {});
  avisar('download-progress', { step: 'complete', fanficId: resultado.data.id, downloaded: resultado.data.totalChapters, total: resultado.data.totalChapters });
  return resultado;
}

function capturarDescarga(item, win, avisar, importar) {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'mylaiberry-web-'));
  const destino = path.join(carpeta, 'descarga');
  item.setSavePath(destino);
  const excedida = () => item.getTotalBytes() > TECHO_DEL_FICHERO || item.getReceivedBytes() > TECHO_DEL_FICHERO;
  item.on('updated', () => { if (excedida()) item.cancel(); });
  item.once('done', async (_event, estado) => {
    try {
      if (estado !== 'completed') throw new Error(excedida() ? 'El libro supera 300 MB.' : 'La descarga no terminó. Puedes volver a intentarlo.');
      const r = await recibirLibro(item, destino, avisar, importar);
      if (!win.isDestroyed()) await dialog.showMessageBox(win, { type: 'info', message: `«${r.data.title}» está en tu biblioteca.`, buttons: ['Continuar'] });
    } catch (e) {
      avisar('scrape-progress', { step: 'error', message: e.message });
      if (!win.isDestroyed()) await dialog.showMessageBox(win, { type: 'error', message: e.message, buttons: ['Continuar'] });
    } finally { await fs.promises.rm(carpeta, { recursive: true, force: true }); }
  });
  if (excedida()) item.cancel();
}

function abrirImportador(url = 'https://www.gutenberg.org/') {
  const direccion = direccionWeb(url);

  if (ventana && !ventana.isDestroyed()) {
    ventana.loadURL(direccion).catch(() => {});
    ventana.show(); ventana.focus();
    return { status: 'ok', abierta: true };
  }
  const sesion = session.fromPartition('persist:mylaiberry-importador');

  sesion.setPermissionRequestHandler((_wc, _permiso, responder) => responder(false));
  sesion.setPermissionCheckHandler(() => false);
  const win = ventana = require('./user-agent.js').crearVentana({ width: 1100, height: 800, title: 'Elige un EPUB, PDF o HTML de AO3: se añadirá a MyLAIberry',
    autoHideMenuBar: true, webPreferences: { session: sesion, nodeIntegration: false, contextIsolation: true, sandbox: true } });
  const permitidas = new Set([win.webContents.id]);
  const preparar = w => {
    const id = w.webContents.id;
    permitidas.add(id);
    w.webContents.setWindowOpenHandler(({ url: u }) => {
      try { direccionWeb(u); return { action: 'allow', overrideBrowserWindowOptions: { webPreferences: { session: sesion, nodeIntegration: false, contextIsolation: true, sandbox: true } } }; }
      catch { return { action: 'deny' }; }
    });
    const soloWeb = (e, u) => { try { direccionWeb(u); } catch { e.preventDefault(); } };
    w.webContents.on('will-navigate', soloWeb);
    w.webContents.on('will-redirect', soloWeb);
    w.webContents.on('did-create-window', preparar);
    w.once('closed', () => permitidas.delete(id));
  };
  preparar(win);
  let descargando = false;
  const descarga = (_event, item, contents) => {
    if (!contents || !permitidas.has(contents.id)) return;
    descargando = true;
    capturarDescarga(item, win, require('./ventana').avisar, require('./ipc/descargas').importarLibro);
  };
  sesion.on('will-download', descarga);
  win.once('closed', () => { sesion.removeListener('will-download', descarga); ventana = null; });
  win.loadURL(direccion).catch(e => { if (!descargando && e.code !== 'ERR_ABORTED' && !win.isDestroyed()) dialog.showMessageBox(win, { type: 'error', message: e.message }); });
  return { status: 'ok', abierta: true, aviso: 'Entra en tu cuenta y pulsa la descarga EPUB, PDF o HTML de AO3. Se importa automáticamente.' };
}

module.exports = { abrirImportador };
