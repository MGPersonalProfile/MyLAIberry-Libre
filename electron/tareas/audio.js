const fs = require('fs');
const path = require('path');
const { getFanficById } = require('../db.js');
const { dirDeFanfic } = require('../rutas.js');
const { tieneTraduccion, rutaTraduccion } = require('../translate.js');
const vozMp3 = require('../voz-mp3.js');

function queLeer(obra, dir, indice, idioma) {
  if (idioma && tieneTraduccion(dir, indice, idioma)) {
    return { fichero: rutaTraduccion(dir, indice, idioma), idiomaDelTexto: idioma, traducido: idioma };
  }
  const original = String(obra?.idiomaOriginal || '').slice(0, 2).toLowerCase();
  return { fichero: path.join(dir, `chapter_${indice}.html`), idiomaDelTexto: original, traducido: null };
}

async function estadoDelAudio(fanficId, indice, idioma, obraLeida = null) {
  const obra = obraLeida || await getFanficById(String(fanficId));
  if (!obra) return { estado: 'error', motivo: 'No se encuentra esa obra.' };
  const dir = dirDeFanfic(String(fanficId));
  const lectura = queLeer(obra, dir, indice, idioma);
  if (!fs.existsSync(lectura.fichero)) return { estado: 'error', motivo: 'Ese capítulo no está descargado.' };
  const ruta = vozMp3.rutaDelAudio(dir, indice, lectura.traducido);
  if (fs.existsSync(ruta)) {
    return { estado: 'listo', ruta, bytes: fs.statSync(ruta).size, traducido: Boolean(lectura.traducido),

      marcas: vozMp3.leerMarcas(ruta) };
  }
  if (fs.existsSync(sinTextoDe(ruta))) return { estado: 'sin-texto', motivo: 'Este capítulo no tiene texto que leer.' };
  const m = vozMp3.motor(lectura.idiomaDelTexto || 'es');
  if (!m.ok) return { estado: 'sin-motor', motivo: m.motivo };
  return { estado: 'falta', traducido: Boolean(lectura.traducido) };
}

const sinTextoDe = (rutaMp3) => rutaMp3.replace(/\.mp3$/, '.sin-texto');

async function generarAudioCapitulo({ fanficId, indice, idioma }) {
  const obra = await getFanficById(String(fanficId));
  if (!obra) return;
  const dir = dirDeFanfic(String(fanficId));
  const lectura = queLeer(obra, dir, indice, idioma);
  const salida = vozMp3.rutaDelAudio(dir, indice, lectura.traducido);
  if (fs.existsSync(salida)) return;
  const m = vozMp3.motor(lectura.idiomaDelTexto || 'es');
  if (!m.ok) throw new Error(m.motivo);
  const html = fs.readFileSync(lectura.fichero, 'utf-8');
  const plan = await vozMp3.planDelCapitulo(html);
  if (!plan.length) {
    fs.mkdirSync(path.dirname(salida), { recursive: true });
    fs.writeFileSync(sinTextoDe(salida), '');
    return;
  }
  const inicio = Date.now();
  const hecho = await vozMp3.sintetizar(plan, {
    motor: m, salida, titulo: `${obra.title || 'Obra'} — capítulo ${Number(indice) + 1}`
  });
  console.log(`[Audio] "${obra.title}" cap. ${Number(indice) + 1}: ${hecho.trozos} trozos, ${hecho.voces} voces, ${Math.round((Date.now() - inicio) / 1000)} s`);
}

async function estadoDeLaObra(fanficId, idioma) {
  const obra = await getFanficById(String(fanficId));
  if (!obra) return { estado: 'error', motivo: 'No se encuentra esa obra.' };
  const total = obra.totalChapters || (obra.chapterList || []).length || 0;
  const capitulos = [];
  for (let i = 0; i < total; i++) {
    const e = await estadoDelAudio(fanficId, i, idioma, obra);
    if (e.estado === 'sin-motor') return e;
    if (e.estado !== 'error' && e.estado !== 'sin-texto') capitulos.push({ indice: i, estado: e.estado });
  }
  return { estado: 'ok', capitulos };
}

module.exports = { generarAudioCapitulo, estadoDelAudio, estadoDeLaObra, queLeer };
