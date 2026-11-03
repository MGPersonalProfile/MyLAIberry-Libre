const fs = require('fs');
const path = require('path');
const { getFanficById } = require('./db.js');
const { estadoDelAudio } = require('./tareas/audio.js');

const limpio = (texto, tope = 80) => String(texto || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
  .replace(/\s+/g, ' ').replace(/^[.\s]+|[.\s]+$/g, '').slice(0, tope).trim();

async function mp3DeLaObra(fanficId, idioma = 'es') {
  const obra = await getFanficById(String(fanficId));
  if (!obra) return { estado: 'error', motivo: 'No se encuentra esa obra.' };
  const capitulos = obra.chapterList || [];
  const total = obra.totalChapters || capitulos.length || 0;
  const cifras = String(Math.max(total, 1)).length;
  const ficheros = [];
  for (let i = 0; i < total; i++) {
    const e = await estadoDelAudio(String(fanficId), i, idioma, obra);
    if (e.estado !== 'listo') continue;
    const titulo = limpio(capitulos[i]?.title, 60);
    ficheros.push({ indice: i, ruta: e.ruta, nombre: `${String(i + 1).padStart(cifras, '0')}${titulo ? ' - ' + titulo : ''}.mp3` });
  }
  return { estado: 'ok', titulo: limpio(obra.title) || 'obra', total, ficheros };
}

async function guardarEnCarpeta(fanficId, idioma, carpeta) {
  const r = await mp3DeLaObra(fanficId, idioma);
  if (r.estado !== 'ok') return { status: 'error', message: r.motivo };
  if (!r.ficheros.length) return { status: 'error', message: 'Todavía no hay ningún capítulo de esta obra en MP3.' };
  const destino = path.join(carpeta, r.titulo);
  fs.mkdirSync(destino, { recursive: true });
  for (const f of r.ficheros) fs.copyFileSync(f.ruta, path.join(destino, f.nombre));
  return { status: 'ok', ruta: destino, capitulos: r.ficheros.length, total: r.total };
}

async function paraZip(fanficId, idioma) {
  const r = await mp3DeLaObra(fanficId, idioma);
  if (r.estado !== 'ok' || !r.ficheros.length) return null;
  const ficheros = r.ficheros.map(f => ({ nombre: `${r.titulo}/${f.nombre}`, bytes: fs.statSync(f.ruta).size,
    leer: () => fs.promises.readFile(f.ruta) }));
  return { nombre: `${r.titulo} (MP3).zip`, capitulos: r.ficheros.length, total: r.total, bytes: tamanoDelZip(ficheros), ficheros };
}

const tamanoDelZip = (ficheros) => ficheros.reduce((s, f) => s + 76 + 2 * Buffer.byteLength(f.nombre, 'utf8') + f.bytes, 0) + 22;

module.exports = { mp3DeLaObra, guardarEnCarpeta, paraZip, tamanoDelZip, limpio };
