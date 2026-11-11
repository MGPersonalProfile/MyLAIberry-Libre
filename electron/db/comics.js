const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { createHash } = require('crypto');
const { carpetaDeObra } = require('./nucleo.js');
const { escribirEntero } = require('../escritura-entera.js');

function carpetaComicCapitulo(fanficId, chapterIndex) {
  return path.join(carpetaDeObra(fanficId), 'comic', `chapter_${chapterIndex}`);
}

async function leerManifiesto(fanficId, chapterIndex) {
  const ruta = path.join(carpetaComicCapitulo(fanficId, chapterIndex), 'manifest.json');
  try {
    const raw = await fsp.readFile(ruta, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function esCapituloCompleto(fanficId, chapterIndex) {
  const ruta = path.join(carpetaComicCapitulo(fanficId, chapterIndex), 'manifest.json');
  try {
    const raw = fs.readFileSync(ruta, 'utf8');
    const data = JSON.parse(raw);
    return data && data.completo === true;
  } catch {
    return false;
  }
}

function generarHtmlCapituloComic(fanficId, chapterIndex, imagenes) {
  const tags = imagenes.map((img, i) => {
    const ruta = path.join(carpetaComicCapitulo(fanficId, chapterIndex), img.archivo);
    const uri = `local-file:///${encodeURI(ruta.replace(/\\/g, '/').replace(/^\//, ''))}`;
    return `<img src="${uri}" data-indice="${i}" alt="Viñeta ${i + 1}" width="${img.ancho || 800}" height="${img.alto || 1280}" class="comic-panel block w-full max-w-3xl mx-auto h-auto">`;
  }).join('\n');

  return `<div class="comic-chapter" data-tipo="comic" data-fanfic="${fanficId}" data-capitulo="${chapterIndex}">\n${tags}\n</div>`;
}

async function escribirImagenesEnTmp(carpetaTmp, imagenes) {
  const meta = [];
  for (let i = 0; i < imagenes.length; i++) {
    const img = imagenes[i];
    const ext = path.extname(img.archivo || '') || (img.mime === 'image/webp' ? '.webp' : '.jpg');
    const nombreArchivo = img.archivo || `${String(i + 1).padStart(4, '0')}${ext}`;
    const rutaImg = path.join(carpetaTmp, nombreArchivo);

    if (img.buffer) {
      await fsp.writeFile(rutaImg, img.buffer);
    }
    const sha256 = img.sha256 || (img.buffer ? createHash('sha256').update(img.buffer).digest('hex') : '');
    const bytes = img.bytes || (img.buffer ? img.buffer.length : 0);

    meta.push({
      archivo: nombreArchivo,
      mime: img.mime || (ext === '.webp' ? 'image/webp' : 'image/jpeg'),
      ancho: img.ancho || 800,
      alto: img.alto || 1280,
      bytes,
      sha256
    });
  }
  return meta;
}

async function guardarCapituloComic(fanficId, chapterIndex, datos) {
  const { titleNo, episodio, url, imagenes = [], totalEsperadas, incompleto = false } = datos;
  const carpetaFinal = carpetaComicCapitulo(fanficId, chapterIndex);
  const carpetaTmp = path.join(carpetaDeObra(fanficId), 'comic', `chapter_${chapterIndex}_tmp`);

  await fsp.mkdir(carpetaTmp, { recursive: true });

  try {
    const imagenesMeta = await escribirImagenesEnTmp(carpetaTmp, imagenes);
    const esperado = totalEsperadas || imagenes.length;
    const completo = !incompleto && imagenesMeta.length >= esperado && imagenesMeta.length > 0;

    const manifiesto = {
      version: 1,
      tipo: 'comic',
      fuente: 'webtoon',
      titleNo: String(titleNo || ''),
      episodio: String(episodio || ''),
      url: url || '',
      imagenes: imagenesMeta,
      completo
    };

    await fsp.writeFile(path.join(carpetaTmp, 'manifest.json'), JSON.stringify(manifiesto, null, 2), 'utf8');
    await fsp.rm(carpetaFinal, { recursive: true, force: true }).catch(() => {});
    await fsp.rename(carpetaTmp, carpetaFinal);

    if (completo) {
      const html = generarHtmlCapituloComic(fanficId, chapterIndex, imagenesMeta);
      await escribirEntero(path.join(carpetaDeObra(fanficId), `chapter_${chapterIndex}.html`), html);
    }

    return manifiesto;
  } catch (err) {
    await fsp.rm(carpetaTmp, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

async function estadoComicObra(fanficId) {
  const carpetaComic = path.join(carpetaDeObra(fanficId), 'comic');
  let bytesTotal = 0;
  const capitulosIncompletos = [];
  const encontrados = new Set();

  try {
    const entradas = await fsp.readdir(carpetaComic, { withFileTypes: true });
    for (const ent of entradas) {
      if (!ent.isDirectory()) continue;
      const m = ent.name.match(/^chapter_(\d+)$/);
      if (!m) continue;
      const indice = Number(m[1]);
      encontrados.add(indice);
      const man = await leerManifiesto(fanficId, indice);
      if (!man) {
        capitulosIncompletos.push({ indice, episodio: String(indice + 1), motivo: 'sin-manifiesto' });
        continue;
      }
      for (const img of (man.imagenes || [])) {
        bytesTotal += Number(img.bytes) || 0;
      }
      if (man.completo !== true) {
        capitulosIncompletos.push({
          indice,
          episodio: String(man.episodio || indice + 1),
          motivo: 'incompleto',
          descargadas: (man.imagenes || []).length,
          totalEsperadas: man.totalEsperadas || (man.imagenes || []).length
        });
      }
    }
  } catch {

  }

  capitulosIncompletos.sort((a, b) => a.indice - b.indice);

  return {
    esComic: bytesTotal > 0 || capitulosIncompletos.length > 0 || encontrados.size > 0,
    bytesTotal,
    capitulosIncompletos,
    totalCapitulosDescargados: encontrados.size
  };
}

module.exports = {
  carpetaComicCapitulo,
  leerManifiesto,
  esCapituloCompleto,
  guardarCapituloComic,
  generarHtmlCapituloComic,
  estadoComicObra
};
