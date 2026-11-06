const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { registrarSesionLectura, estadisticasLectura, exportarLectura } = require('../db.js');
const { aTextoPlano } = require('../recap.js');
const { dirDeFanfic } = require('../rutas.js');
const { ID_VALIDO } = require('../lan/rutas-seguras.js');

async function capituloOriginal(obra, indice) {
  if (!ID_VALIDO.test(String(obra))) return null;
  const archivo = path.join(dirDeFanfic(String(obra)), `chapter_${Number(indice)}.html`);
  if (!fs.existsSync(archivo)) return null;
  const texto = aTextoPlano(fs.readFileSync(archivo, 'utf-8'));
  return { palabras: texto.split(/\s+/).filter(Boolean).length,
    huella: crypto.createHash('sha256').update(texto).digest('hex').slice(0, 16) };
}

function registrar() {
  ipcMain.handle('registrar-sesion-lectura', (event, sesion) => registrarSesionLectura(sesion, capituloOriginal));
  ipcMain.handle('estadisticas-lectura', (event, zona) => estadisticasLectura(zona));
  ipcMain.handle('exportar-lectura', (event, formato) => exportarLectura(formato === 'csv' ? 'csv' : 'json'));
}

module.exports = { registrar, capituloOriginal };
