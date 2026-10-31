const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

const { getFanficById, getFanfics, getSettings, getDataLocation, guardarProgresoRemoto } = require('../db.js');
const { tieneTraduccion, rutaTraduccion } = require('../translate.js');
const sesiones = require('../sesiones.js');
const { ventana } = require('../ventana.js');
const { dirDeFanfic } = require('../rutas.js');
const { codigoDeLan } = require('../lan-acceso.js');

function opcionesDelServidor() {
  const { fuenteDeDisco } = require('../servidor-lan.js');
  return {

    app: { llamar: require('../ipc-registro.js').llamar, raizDatos: () => getDataLocation().actual },
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

function capitulosParaElLibro(obra, dir, { enTraducido, idioma, total }) {
  const capitulos = [];

  for (let i = 0; i < total; i++) {
    const traducido = enTraducido && tieneTraduccion(dir, i, idioma);
    const archivo = traducido
      ? rutaTraduccion(dir, i, idioma)
      : path.join(dir, `chapter_${i}.html`);
    if (!fs.existsSync(archivo)) continue;

    capitulos.push({
      titulo: obra.chapterList?.[i]?.title || `Capítulo ${i + 1}`,
      html: fs.readFileSync(archivo, 'utf-8'),
      traducido
    });
  }

  return capitulos;
}

function portadaDelLibro(obra) {
  if (!obra.localCoverPath || !fs.existsSync(obra.localCoverPath)) return null;

  const ext = path.extname(obra.localCoverPath).toLowerCase();
  return {
    datos: fs.readFileSync(obra.localCoverPath),
    tipo: ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
  };
}

function registrar() {

  ipcMain.handle('exportar-epub', async (event, fanficId, opciones = {}) => {
    const id = String(fanficId);
    const obra = await getFanficById(id);
    if (!obra) return { status: 'error', message: 'No se encuentra esa obra' };

    const dir = dirDeFanfic(id);
    const ajustes = await getSettings();
    const idioma = ajustes?.lang || 'es';
    const enTraducido = opciones?.traducido ?? !!ajustes?.readTranslated;
    const total = obra.totalChapters || (obra.chapterList || []).length || 0;

    const capitulos = capitulosParaElLibro(obra, dir, { enTraducido, idioma, total });
    if (capitulos.length === 0) {
      return { status: 'error', message: 'No hay ningún capítulo descargado todavía' };
    }

    const { crearEpub, nombreSugerido } = require('../epub-escribir.js');
    const capitulosTraducidos = capitulos.filter(c => c.traducido).length;
    const libro = crearEpub({
      titulo: obra.title,
      autor: obra.author,
      idioma: enTraducido && capitulosTraducidos ? idioma : (obra.idiomaOriginal || 'und'),
      sinopsis: obra.synopsis,
      portada: portadaDelLibro(obra),
      capitulos,
      url: obra.url,
      etiquetas: (obra.tags || []).map(t => t.name).filter(Boolean).slice(0, 20)
    });

    const { canceled, filePath } = await dialog.showSaveDialog(ventana(), {
      title: 'Guardar EPUB',
      defaultPath: nombreSugerido({ titulo: obra.title, autor: obra.author }),
      filters: [{ name: 'EPUB', extensions: ['epub'] }]
    });
    if (canceled || !filePath) return { status: 'cancelado' };

    fs.writeFileSync(filePath, libro);
    return {
      status: 'ok',
      ruta: filePath,
      capitulos: capitulos.length,
      total,
      traducido: enTraducido,
      idiomaOriginal: obra.idiomaOriginal || 'no consta',
      idiomaSolicitado: enTraducido ? idioma : null,

      ...(enTraducido ? { capitulosTraducidos } : {})
    };
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
