const path = require('path');
const { BrowserWindow } = require('electron');

const INACTIVIDAD_MS = 3 * 60 * 1000;

let ventana = null;
let cargando = null;
let temporizador = null;

function rutaDePagina() {
  return path.join(__dirname, '../frontend/dist/clasificador.html');
}

function posponerCierre() {
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(cerrar, INACTIVIDAD_MS);
}

async function abrir() {
  if (ventana && !ventana.isDestroyed()) { posponerCierre(); return ventana; }
  if (cargando) return cargando;

  cargando = (async () => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false }
    });
    await win.loadFile(rutaDePagina());

    await win.webContents.executeJavaScript('window.calentarModelo()');
    ventana = win;
    posponerCierre();
    return win;
  })();

  try {
    return await cargando;
  } finally {
    cargando = null;
  }
}

function cerrar() {
  if (temporizador) { clearTimeout(temporizador); temporizador = null; }
  if (ventana && !ventana.isDestroyed()) ventana.destroy();
  ventana = null;
}

async function vectorizar(textos) {
  if (!Array.isArray(textos) || textos.length === 0) return [];
  const win = await abrir();
  const vectores = await win.webContents.executeJavaScript(
    `window.vectorizar(${JSON.stringify(textos)})`
  );
  posponerCierre();
  return vectores;
}

module.exports = { vectorizar, abrir, cerrar };
