const { ipcMain, dialog } = require('electron');
const fs = require('fs');

const { getFanfics, getSettings, getDataLocation, guardarProgresoRemoto } = require('../db.js');
const { prepararEpub } = require('../epub-obra.js');
const sesiones = require('../sesiones.js');
const { ventana } = require('../ventana.js');
const { codigoDeLan } = require('../lan-acceso.js');

function opcionesDelServidor() {
  const { fuenteDeDisco } = require('../servidor-lan.js');
  return {

    app: { llamar: require('../ipc-registro.js').llamar, raizDatos: () => getDataLocation().actual, epub: prepararEpub,

      comic: { manifiesto: (id, n) => require('../db.js').leerManifiesto(id, n), carpeta: (id, n) => require('../db.js').carpetaComicCapitulo(id, n) },
      audioObra: (id, idioma) => require('../audio-obra.js').paraZip(id, idioma),

      subirLibro: (ruta) => require('./descargas.js').importarLibro(ruta, d => require('../ventana.js').avisar('scrape-progress', d)) },
    fuente: fuenteDeDisco({
      raiz: getDataLocation().actual,

      obras: async () => (await getFanfics())
        .filter(f => f.origen !== 'descubierta' && f.origen !== 'descartada'),

      guardarProgreso: (p) => guardarProgresoRemoto(p),

      idiomaDeLectura: async () => {
        const s = await getSettings();
        return s?.readTranslated ? s.lang || null : null;
      }
    })
  };
}

async function encenderAhora() {
  const { arrancar, PUERTO_POR_DEFECTO } = require('../servidor-lan.js');
  const tailscale = require('../lan/tailscale.js');
  const ts = await tailscale.estadoTailscale();
  if (!ts.conectado) {
    throw new Error(ts.instalado
      ? 'Tailscale está instalado pero sin sesión: inicia sesión en Tailscale y vuelve a probar.'
      : 'Hace falta Tailscale en este PC para leer desde el móvil.');
  }
  const r = await arrancar({
    direcciones: ['127.0.0.1'],
    nombres: [ts.nombre],
    codigo: await codigoDeLan(),
    ...opcionesDelServidor()
  });
  try {
    await tailscale.publicar(r.puerto || PUERTO_POR_DEFECTO);
  } catch (e) {

    await require('../servidor-lan.js').parar();
    throw new Error('Tailscale no dejó publicar la biblioteca: ' + e.message);
  }
  tailscaleEnMarcha = `https://${ts.nombre}`;
  return { ...r, tailscale: ts, urls: [`${tailscaleEnMarcha}${r.base || ''}/app/`] };
}

let tailscaleEnMarcha = null;

async function apagarAhora() {
  const { parar } = require('../servidor-lan.js');
  let error = null;
  if (tailscaleEnMarcha) {
    try { await require('../lan/tailscale.js').retirar(); } catch (e) { error = e.message; }
  }
  tailscaleEnMarcha = null;
  await parar();
  return { ok: !error, error };
}

let enCola = Promise.resolve();
function enSerie(fn) {
  const turno = enCola.then(fn, fn);
  enCola = turno.catch(() => {});
  return turno;
}
const encenderLan = () => enSerie(encenderAhora);
const apagarLan = () => enSerie(apagarAhora);

function reencenderLan() {
  return enSerie(async () => {
    if (!require('../servidor-lan.js').estado().encendido) return;
    await apagarAhora();
    await encenderAhora();
  });
}

function registrar() {

  ipcMain.handle('exportar-epub', async (event, fanficId, opciones = {}) => {
    const hecho = await prepararEpub(fanficId, opciones);
    if (hecho.status === 'error') return hecho;

    const { canceled, filePath } = await dialog.showSaveDialog(ventana(), {
      title: 'Guardar EPUB',
      defaultPath: hecho.nombre,
      filters: [{ name: 'EPUB', extensions: ['epub'] }]
    });
    if (canceled || !filePath) return { status: 'cancelado' };

    fs.writeFileSync(filePath, hecho.libro);
    return { status: 'ok', ruta: filePath, ...hecho.resumen };
  });

  require('../avisos.js').enlaceDeLaApp(() => {
    const e = require('../servidor-lan.js').estado();
    return e.encendido && tailscaleEnMarcha ? `${tailscaleEnMarcha}${e.base || ''}/app/` : null;
  });
  ipcMain.handle('lan-estado', async () => {
    const { estado } = require('../servidor-lan.js');
    const e = estado();

    const urls = e.encendido && tailscaleEnMarcha ? [`${tailscaleEnMarcha}${e.base || ''}/app/`] : [];

    const tailscale = await require('../lan/tailscale.js').estadoTailscale();
    return { ...e, urls, tailscale };
  });

  ipcMain.handle('lan-encender', async () => {
    try {
      return { ok: true, ...await encenderLan() };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  });

  ipcMain.handle('lan-nuevo-codigo', async () => {
    try {
      await codigoDeLan({ nuevo: true });
      await reencenderLan();
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  });

  ipcMain.handle('lan-apagar', async () => apagarLan());

  ipcMain.handle('listar-sesiones', async () => sesiones.listar());
  ipcMain.handle('comprobar-sesiones', async () => sesiones.comprobarTodos());

  ipcMain.handle('cerrar-sesion-sitio', async (event, id) => sesiones.cerrarSesion(id));

  ipcMain.handle('iniciar-sesion-sitio', async (event, id) => {
    return await sesiones.abrirLogin(id);
  });

  ipcMain.handle('importar-sesion-sitio', async (event, id, cookies) => sesiones.importarCookies(id, cookies));

  const libre = () => require('../sesion-libre.js');
  ipcMain.handle('iniciar-sesion-web', async (event, url) => {
    try { return { status: 'ok', ...await libre().abrirLoginLibre(url) }; } catch (e) { return { status: 'error', message: e.message }; }
  });
  ipcMain.handle('importar-sesion-web', async (event, dominio, cookies) => {
    try { return { status: 'ok', ...await libre().importarCookiesLibre(dominio, cookies) }; } catch (e) { return { status: 'error', message: e.message }; }
  });

}

module.exports = { registrar, reencenderLan, apagarLan, encenderLan, opcionesDelServidor };
