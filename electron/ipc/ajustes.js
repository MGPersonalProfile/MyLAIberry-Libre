const { app, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const {
  getFanfics, getSettingsParaInterfaz, updateSettings, getConfigIA,
  getDataLocation, setDataLocation, getSettings
} = require('../db.js');
const cola = require('../cola.js');
const { esDeLaBiblioteca } = require('../origen.js');
const { listaDeProveedores, queFalta: queFaltaIA } = require('../proveedores-ia.js');
const { resumirConModelo } = require('../resumen-ia.js');
const avisos = require('../avisos.js');
const enlaces = require('../enlaces.js');
const { ventana } = require('../ventana.js');
const { mudarBiblioteca } = require('../mudanza.js');

async function aplicarSiempreAbierta(cambio) {
  const siempre = require('../siempre-abierta.js');
  if ('abrirConWindows' in (cambio || {})) siempre.aplicarInicioConWindows(cambio.abrirConWindows);
  if (cambio?.movilSiempre === true && !require('../servidor-lan.js').estado().encendido) {
    await require('./fuera.js').encenderLan().catch(() => {});
  }
}

function resumenDeLecturas(fics) {
  let terminadas = 0, alDia = 0, enCurso = 0, masLarga = null, maxCaps = 0;
  for (const f of fics) {

    const estado = require('../asistente-obra.js').estadoDeLectura(f);
    if (estado === 'terminada') terminadas++;
    else if (estado === 'al día') alDia++;
    else if (estado === 'a medias') enCurso++;
    const caps = f.chapterList?.length || f.totalChapters || 0;
    if (!masLarga || caps > maxCaps) {
      masLarga = f;
      maxCaps = caps;
    }
  }
  return {
    terminadas,
    alDia,
    enCurso,
    masLarga: masLarga ? { id: String(masLarga.id), titulo: masLarga.title, capitulos: maxCaps } : null
  };
}

function registrar() {

  ipcMain.handle('get-settings', async () => {
    return await getSettingsParaInterfaz();
  });

  ipcMain.handle('update-settings', async (event, settings) => {
    await updateSettings(settings);
    await aplicarSiempreAbierta(settings);
    return await getSettingsParaInterfaz();
  });

  ipcMain.handle('buscar-actualizacion', async () =>
    require('../actualizar.js').buscar({ actual: app.getVersion() }));

  ipcMain.handle('instalar-actualizacion', async () => {
    const { spawn } = require('child_process');
    const r = await require('../actualizar.js').instalar({
      actual: app.getVersion(),

      lanzar: (ruta, args) => new Promise((ok, mal) => {
        const hijo = spawn(ruta, args, { detached: true, stdio: 'ignore' });
        hijo.once('spawn', () => { hijo.unref(); ok(); });
        hijo.once('error', mal);
      })
    });

    if (r.ok) setTimeout(() => app.quit(), 300);
    return r;
  });

  ipcMain.handle('listar-proveedores-ia', async () => listaDeProveedores());

  ipcMain.handle('marcador-navegador', async () => enlaces.marcador());

  ipcMain.handle('avisos-disponibles', async () => avisos.disponible());
  ipcMain.handle('avisos-via', async () => avisos.via());

  ipcMain.handle('abrir-en-navegador', async (event, url) => {
    let destino;
    try {
      destino = new URL(String(url || ''));
    } catch {
      return { ok: false, message: 'Dirección mal formada' };
    }
    if (destino.protocol !== 'https:' && destino.protocol !== 'http:') {
      return { ok: false, message: 'Sólo se abren enlaces http o https' };
    }
    await shell.openExternal(destino.href);
    return { ok: true };
  });

  ipcMain.handle('probar-ia', async () => {
    const config = await getConfigIA();
    const falta = queFaltaIA(config);
    if (falta) return { ok: false, codigo: falta };
    try {
      const texto = await resumirConModelo(
        'Ana abrió la puerta y encontró la casa vacía. Sobre la mesa había una nota con su nombre.',
        (await getSettings())?.lang || 'es',
        config,
        []
      );
      return { ok: true, muestra: texto.slice(0, 160) };
    } catch (err) {
      return { ok: false, codigo: err.codigo || 'fallo', message: err.message };
    }
  });

  ipcMain.handle('probar-clave-deepseek', async () => require('../asistente-proveedor.js').probarClave());

  ipcMain.handle('mostrar-fichero', async (event, ruta) => {
    if (typeof ruta === 'string' && fs.existsSync(ruta)) shell.showItemInFolder(ruta);
    return { ok: true };
  });

  ipcMain.handle('get-stats', async () => {
    const todas = await getFanfics();

    const fics = todas.filter(esDeLaBiblioteca);
    const raiz = path.join(getDataLocation().actual, 'fanfics');

    let capitulosEnDisco = 0, traducidos = 0, bytes = 0;
    const porPlataforma = {};

    for (const f of todas) {
      const propia = esDeLaBiblioteca(f);
      if (propia) porPlataforma[f.source || '—'] = (porPlataforma[f.source || '—'] || 0) + 1;
      const dir = path.join(raiz, String(f.id));
      if (!fs.existsSync(dir)) continue;
      for (const nombre of fs.readdirSync(dir)) {
        const completo = path.join(dir, nombre);
        try { bytes += fs.statSync(completo).size; } catch {  }
        if (!propia) continue;
        if (/^chapter_\d+\.html$/.test(nombre)) capitulosEnDisco++;
        else if (/^chapter_\d+\.[a-z]{2}\.html$/.test(nombre)) traducidos++;
      }
    }

    const lecturas = resumenDeLecturas(fics);

    return {
      fanfics: fics.length,
      descubrimientos: todas.filter(f => f.origen === 'descubierta').length,
      capitulosListados: fics.reduce((s, f) => s + (f.chapterList?.length || 0), 0),
      capitulosEnDisco,
      traducidos,
      capitulosLeidos: fics.reduce((s, f) => s + (f.currentChapter || 0), 0),

      enCurso: lecturas.enCurso,
      terminadas: lecturas.terminadas,
      alDia: lecturas.alDia,
      masLarga: lecturas.masLarga,

      porPlataforma,
      bytes,

      enCola: (await cola.pendientes()).filter(t => t.tipo === 'descargar-capitulos').length
    };
  });

  ipcMain.handle('get-data-location', async () => {
    const loc = getDataLocation();
    let size = 0;
    try {
      const fanficsDir = path.join(loc.actual, 'fanfics');
      const dirs = fs.existsSync(fanficsDir) ? fs.readdirSync(fanficsDir) : [];
      for (const d of dirs) {
        const p = path.join(fanficsDir, d);
        if (!fs.statSync(p).isDirectory()) continue;
        for (const f of fs.readdirSync(p)) size += fs.statSync(path.join(p, f)).size;
      }
    } catch {  }
    return { ...loc, bytes: size };
  });

  ipcMain.handle('listar-copias', async () => {
    try { return { status: 'ok', copias: await require('../db.js').listarCopias() }; }
    catch (e) { return { status: 'error', message: e.message }; }
  });
  ipcMain.handle('listar-recuperables', async () => {
    try { return { status: 'ok', recuperables: await require('../db.js').listarRecuperables() }; }
    catch (e) { return { status: 'error', message: e.message }; }
  });
  ipcMain.handle('recuperar-obra', async (_e, id) => {
    try { return { status: 'ok', ...await require('../db.js').recuperarObra(id) }; }
    catch (e) { return { status: 'error', message: e.message }; }
  });
  ipcMain.handle('recuperar-trabajos', async (_e, seleccion) => {
    try { return { status: 'ok', ...await require('../db.js').recuperarTrabajos(seleccion) }; }
    catch (e) { return { status: 'error', message: e.message }; }
  });
  ipcMain.handle('restaurar-copia', async (_e, archivo) => {
    try { return { status: 'ok', ...await require('../db.js').restaurarCopia(archivo) }; }
    catch (e) { return { status: 'error', message: e.message }; }
  });

  ipcMain.handle('abrir-biblioteca-existente', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(ventana(), {
      title: 'Elige la carpeta de tu biblioteca', properties: ['openDirectory'], buttonLabel: 'Abrir esta'
    });
    if (canceled || filePaths.length === 0) return { status: 'cancelled' };
    try {
      const r = await require('../db.js').apuntarABibliotecaExistente(filePaths[0]);
      return r.ok ? { status: 'ok', ...r } : { status: 'error', message: r.error };
    } catch (e) { return { status: 'error', message: e.message }; }
  });
  ipcMain.handle('reiniciar-app', () => { app.relaunch(); app.exit(0); });

  ipcMain.handle('choose-data-location', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(ventana(), {
      title: 'Elige dónde guardar la biblioteca',
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Guardar aquí'
    });
    if (canceled || filePaths.length === 0) return { status: 'cancelled' };

    try {

      const res = await mudarBiblioteca(filePaths[0], {
        setDataLocation, cola, traduccion: require('../traduccion-anticipada.js'),
        barrera: require('../barrera-disco.js'),
        alMudar: () => require('./fuera.js').reencenderLan()
      });
      if (!res.ok) return { status: 'error', message: res.error };
      return {
        status: res.sinCambios ? 'unchanged' : 'ok',
        ruta: res.ruta,
        origenConservado: res.origenConservado,

        avisoLan: res.avisoLan || null
      };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  });

  ipcMain.handle('open-data-location', async () => {
    await shell.openPath(getDataLocation().actual);
    return { status: 'ok' };
  });

}

module.exports = { registrar, resumenDeLecturas };
