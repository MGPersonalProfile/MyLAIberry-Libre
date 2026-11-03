const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const cola = require('../cola.js');
const { getFanficById } = require('../db.js');
const { estadoDelAudio, estadoDeLaObra } = require('../tareas/audio.js');
const vocesInstalar = require('../voces-instalar.js');
const { avisar } = require('../ventana.js');

let instalacion = null;

const uriDe = ruta => `local-file:///${encodeURI(ruta.replace(/\\/g, '/').replace(/^\//, ''))}`;

function indiceValido(indice) {
  return Number.isInteger(indice) && indice >= 0;
}

function registrar() {
  ipcMain.handle('estado-voces', async () => ({ ...await vocesInstalar.estado(), disponible: process.platform === 'win32' }));
  ipcMain.handle('instalar-voces', () => {

    if (!instalacion) instalacion = vocesInstalar.instalar({ progreso: datos => avisar('voces-progreso', datos) })
      .catch(e => ({ ok: false, motivo: e.message }))
      .finally(() => { instalacion = null; });
    return instalacion;
  });

  ipcMain.handle('audio-capitulo', async (event, fanficId, indice, { idioma = 'es', pedir = false } = {}) => {
    const i = Number(indice);
    if (!indiceValido(i)) return { estado: 'error', motivo: 'Capítulo no válido.' };
    const estado = await estadoDelAudio(String(fanficId), i, idioma);
    if (estado.estado === 'listo') {
      const { ruta, ...resto } = estado;
      return { ...resto, uri: uriDe(ruta), nombre: path.basename(ruta) };
    }
    if (estado.estado === 'falta' && pedir) {
      await cola.encolar('audio-capitulo', { fanficId: String(fanficId), indice: i, idioma }, { prioritario: true });
      return { ...estado, estado: 'preparando' };
    }
    if (estado.estado === 'falta') {
      const enCola = (await cola.pendientes()).some(t => t.tipo === 'audio-capitulo' &&
        String(t.carga?.fanficId) === String(fanficId) && t.carga?.indice === i);
      return { ...estado, estado: enCola ? 'preparando' : 'falta' };
    }
    return estado;
  });

  ipcMain.handle('audio-obra', async (event, fanficId, { idioma = 'es', pedir = false } = {}) => {
    const obra = await estadoDeLaObra(String(fanficId), idioma);
    if (obra.estado !== 'ok') return obra;
    const enCola = new Set((await cola.pendientes())
      .filter(t => t.tipo === 'audio-capitulo' && String(t.carga?.fanficId) === String(fanficId))
      .map(t => t.carga.indice));
    const faltan = obra.capitulos.filter(c => c.estado === 'falta' && !enCola.has(c.indice));
    if (pedir && faltan.length) {
      await cola.encolarVarias('audio-capitulo', faltan.map(c => ({ fanficId: String(fanficId), indice: c.indice, idioma })));
      for (const c of faltan) enCola.add(c.indice);
    }
    const listos = obra.capitulos.filter(c => c.estado === 'listo').length;
    return { estado: 'ok', total: obra.capitulos.length, listos, preparando: enCola.size,
      faltan: Math.max(0, obra.capitulos.length - listos - enCola.size) };
  });

  ipcMain.handle('guardar-audio-obra', async (event, fanficId, { idioma = 'es' } = {}) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
      title: 'Guardar los MP3 de la obra', properties: ['openDirectory', 'createDirectory']
    });
    if (canceled || !filePaths?.[0]) return { status: 'cancelado' };
    return require('../audio-obra.js').guardarEnCarpeta(String(fanficId), idioma, filePaths[0]);
  });

  ipcMain.handle('guardar-audio-capitulo', async (event, fanficId, indice, { idioma = 'es' } = {}) => {
    const i = Number(indice);
    if (!indiceValido(i)) return { status: 'error', message: 'Capítulo no válido.' };
    const estado = await estadoDelAudio(String(fanficId), i, idioma);
    if (estado.estado !== 'listo') return { status: 'error', message: 'Ese MP3 todavía no está.' };
    const obra = await getFanficById(String(fanficId));
    const limpio = String(obra?.title || 'capitulo').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80);
    const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow(), {
      title: 'Guardar MP3',
      defaultPath: `${limpio} - ${i + 1}.mp3`,
      filters: [{ name: 'MP3', extensions: ['mp3'] }]
    });
    if (canceled || !filePath) return { status: 'cancelado' };
    fs.copyFileSync(estado.ruta, filePath);
    return { status: 'ok', ruta: filePath };
  });
}

module.exports = { registrar };
