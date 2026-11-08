const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const { getFanfics, getRecordatorio, setRecordatorio, memoriaTerminados, glosarioParaTraducir } = require('../db.js');
const { dirDeFanfic } = require('../rutas.js');
const { recordarLectura } = require('../lector/recordar-lectura.js');
const { ID_VALIDO } = require('../lan/rutas-seguras.js');
const { capituloOriginal } = require('./memoria-lectura.js');

async function recordar(obra, modo, lang = 'es') {
  if (!ID_VALIDO.test(String(obra))) return { status: 'error', message: 'Obra no válida' };
  const fanfic = (await getFanfics()).find(f => String(f.id) === String(obra));
  if (!fanfic) return { status: 'error', message: 'Obra no encontrada' };
  const modoLimpio = modo === 'progreso' ? 'progreso' : 'breve';
  const dir = dirDeFanfic(String(obra));
  const previa = await getRecordatorio(obra, modoLimpio);
  let pendiente = null;
  const r = await recordarLectura({
    fanfic, memoria: await memoriaTerminados(), modo: modoLimpio, lang,
    leerCapitulo: (i) => { const f = path.join(dir, `chapter_${i}.html`); return fs.existsSync(f) ? fs.readFileSync(f, 'utf-8') : null; },

    huellaDeLectura: async (i) => (await capituloOriginal(obra, i))?.huella,
    glosario: await glosarioParaTraducir(obra),
    cache: { leer: () => previa, guardar: (e) => { pendiente = e; } },
    revalidarAutorizacion: async () => (await getFanfics()).find(f => String(f.id) === String(obra))
  });
  if (pendiente && r?.texto) await setRecordatorio(obra, modoLimpio, pendiente);
  return r;
}

function registrar() {
  ipcMain.handle('recordar-lectura', (event, obra, modo, lang) => recordar(obra, modo, lang));
}

module.exports = { registrar, recordar };
