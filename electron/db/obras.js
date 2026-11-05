const path = require('path'), fs = require('fs').promises;
const { leer, releerSiAbierta, writeDB, carpetaDeObra } = require('./nucleo.js');
const { planDeRealineado, moverFicheros, remapearDatos, claveDeCapitulo } = require('../realinear-capitulos.js');
const { mismaObra } = require('../misma-obra.js');
const { escribirEntero } = require('../escritura-entera.js');
const { updateProgress, saveScrollPosition, guardarProgresoRemoto,
  getScrollPosition } = require('./lectura.js');

async function getFanfics() {
  const datos = await leer();
  return datos.fanfics;
}

async function addFanfic(fanfic) {
  const datos = await leer();

  const exists = datos.fanfics.find(f => mismaObra(f.url, fanfic.url));
  if (!exists) {
    if (!fanfic.id) fanfic.id = Date.now().toString();
    fanfic.downloadedChapters = 0;
    fanfic.scrollPositions = {};
    fanfic.addedAt = Date.now();
    fanfic.tags = fanfic.tags || [];
    fanfic.wordCount = fanfic.wordCount || 0;
    fanfic.kudos = fanfic.kudos || 0;

    fanfic.origen = fanfic.origen || 'propia';

    if (!Array.isArray(fanfic.glosario)) {
      const { sembrarDesdeEtiquetas } = require('../glosario.js');
      fanfic.glosario = sembrarDesdeEtiquetas(fanfic.tags);
    }
    datos.fanfics.push(fanfic);
    await writeDB();

    const fanficDir = carpetaDeObra(fanfic.id);
    await fs.mkdir(fanficDir, { recursive: true }).catch(() => {});

    return fanfic;
  }

  const { esDeLaBiblioteca, cambiarOrigen } = require('../origen');
  const nuevo = fanfic.origen || 'propia';
  if (!esDeLaBiblioteca(exists) && esDeLaBiblioteca({ origen: nuevo }) && cambiarOrigen(exists, nuevo)) await writeDB();
  return exists;
}

async function marcarRevisado(id, nuevos) {
  const datos = await leer();
  const fanfic = datos.fanfics.find(f => String(f.id) === String(id));
  if (fanfic) {
    fanfic.revisadoEn = Date.now();
    if (nuevos > 0) fanfic.capitulosNuevos = (fanfic.capitulosNuevos || 0) + nuevos;
    await writeDB();
  }
}

async function saveChapterContent(fanficId, chapterIndex, content) {
  const fanficDir = carpetaDeObra(fanficId);
  await fs.mkdir(fanficDir, { recursive: true }).catch(() => {});

  const { paraGuardar } = require('../capitulo-valido.js');

  await escribirEntero(path.join(fanficDir, `chapter_${chapterIndex}.html`), paraGuardar(content));
}

async function getChapterContent(fanficId, chapterIndex) {
  const chapterFile = path.join(carpetaDeObra(fanficId), `chapter_${chapterIndex}.html`);
  try {
    const content = await fs.readFile(chapterFile, 'utf-8');
    const { limpiarHtml } = require('../limpiar-html.js');
    return limpiarHtml(content);
  } catch (error) {
    return null;
  }
}

async function updateDownloadCount(id, count) {
  const datos = await leer();
  const fanfic = datos.fanfics.find(f => f.id === id || f.id === String(id));
  if (fanfic) {
    fanfic.downloadedChapters = count;
    await writeDB();
  }
}

async function setPortadaPreferida(id, valor) {
  const datos = await leer();
  const fanfic = datos.fanfics.find(f => f.id === id || f.id === String(id));
  if (fanfic) {
    fanfic.portadaPreferida = valor;
    await writeDB();
  }
}

async function setAutorUrl(id, url) {
  const datos = await leer();
  const fanfic = datos.fanfics.find(f => String(f.id) === String(id));
  if (fanfic && url && fanfic.autorUrl !== url) {
    fanfic.autorUrl = url;
    await writeDB();
    return true;
  }
  return false;
}

async function setFuente(id, fuente) {
  const datos = await leer();
  const fanfic = datos.fanfics.find(f => String(f.id) === String(id));
  if (fanfic && fuente && fanfic.source !== fuente) {
    fanfic.source = fuente;
    await writeDB();
    return true;
  }
  return false;
}

async function updateCoverUrl(id, url) {
  const datos = await leer();
  const fanfic = datos.fanfics.find(f => f.id === id || f.id === String(id));
  if (fanfic && fanfic.coverUrl !== url) {
    fanfic.coverUrl = url;
    await writeDB();
    return true;
  }
  return false;
}

function esImagenBinaria(datos) {
  const hex = datos.subarray(0, 8).toString('hex');
  return hex.startsWith('ffd8ff') || hex === '89504e470d0a1a0a'
    || /^GIF8[79]a$/.test(datos.toString('ascii', 0, 6))
    || (datos.toString('ascii', 0, 4) === 'RIFF' && datos.toString('ascii', 8, 12) === 'WEBP')
    || /^ftypavi[fs]$/.test(datos.toString('ascii', 4, 12));
}

async function saveCoverLocally(fanficId, coverUrl) {
  if (!coverUrl) return null;
  let temporal;
  try {
    const url = new URL(coverUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const maximo = 10 * 1024 * 1024;
    const tipo = (response.headers.get('content-type') || '').split(';')[0].trim();
    if (response.status !== 200 || !/^(image\/|(?:application|binary)\/octet-stream$|$)/i.test(tipo)
      || Number(response.headers.get('content-length')) > maximo) {
      await response.body?.cancel(); return null;
    }
    const trozos = []; let bytes = 0;
    for await (const trozo of response.body) {
      bytes += trozo.length;
      if (bytes > maximo) throw new Error('Portada demasiado grande');
      trozos.push(trozo);
    }
    if (!bytes) return null;
    const contenido = Buffer.concat(trozos);
    if (!/^image\//i.test(tipo) && !esImagenBinaria(contenido)) return null;
    const fanficDir = carpetaDeObra(fanficId);
    await fs.mkdir(fanficDir, { recursive: true });
    const ext = path.extname(url.pathname) || '.jpg';
    const coverPath = path.join(fanficDir, `cover${ext}`);
    temporal = coverPath + '.' + require('crypto').randomUUID() + '.tmp';
    await fs.writeFile(temporal, contenido);
    await fs.rename(temporal, coverPath);
    return coverPath;
  } catch (e) {
    console.error('Error descargando portada:', e.message);
    return null;
  } finally { if (temporal) await fs.unlink(temporal).catch(() => {}); }
}

async function updateLocalCoverPath(id, localPath, desdeUrl) {
  const datos = await leer();
  const fanfic = datos.fanfics.find(f => f.id === id || f.id === String(id));
  if (fanfic) {

    fanfic.localCoverPath = localPath ? path.join(carpetaDeObra(fanfic.id), path.basename(localPath)) : localPath;
    if (desdeUrl) fanfic.localCoverUrl = desdeUrl;

    fanfic.localCoverAt = Date.now();
    await writeDB();
  }
}

async function sellarPortada(id, cuando) {
  const datos = await leer();
  const fanfic = datos.fanfics.find(f => f.id === id || f.id === String(id));
  if (fanfic && !fanfic.localCoverAt) {
    fanfic.localCoverAt = cuando;
    await writeDB();
  }
}

async function deleteFanfic(id) {
  const datos = await leer();

  const index = datos.fanfics.findIndex(f => f.id === id || f.id === String(id));
  if (index !== -1) {
    datos.fanfics.splice(index, 1);
    await writeDB();

    const fanficDir = carpetaDeObra(id);
    try {
      await fs.rm(fanficDir, { recursive: true, force: true });
    } catch (e) {
      console.error('Error borrando archivos del fanfic:', e);
    }

    return { success: true };
  }
  return { success: false, message: 'Fanfic no encontrado' };
}

async function countChaptersOnDisk(fanficId) {
  const dir = carpetaDeObra(fanficId);
  try {
    const files = await fs.readdir(dir);
    return files.filter(f => /^chapter_\d+\.html$/.test(f)).length;
  } catch {
    return 0;
  }
}

async function medirPalabras(fanficId, { forzar = false } = {}) {
  const dir = carpetaDeObra(fanficId);
  const enDisco = await countChaptersOnDisk(fanficId);

  let datos = await leer();
  const previa = datos.fanfics.find(f => String(f.id) === String(fanficId));
  if (!previa) return null;
  if (!forzar && enDisco > 0 && previa.capitulosMedidos === enDisco) {
    return { palabras: previa.palabrasMedidas || 0, capitulos: enDisco };
  }

  const { medirCarpeta } = require('../palabras.js');
  const medida = await medirCarpeta(dir);
  if (medida.capitulos === 0) return null;

  datos = await leer();
  const fanfic = datos.fanfics.find(f => String(f.id) === String(fanficId));
  if (!fanfic) return null;
  fanfic.palabrasMedidas = medida.palabras;
  fanfic.capitulosMedidos = medida.capitulos;
  await writeDB();
  return medida;
}

async function firstMissingChapter(fanficId, totalChapters) {
  const dir = carpetaDeObra(fanficId);
  let files;
  try {
    files = await fs.readdir(dir);
  } catch {
    return 0;
  }
  const have = new Set(
    files.filter(f => /^chapter_\d+\.html$/.test(f)).map(f => Number(f.match(/\d+/)[0]))
  );
  for (let i = 0; i < totalChapters; i++) {
    if (!have.has(i)) return i;
  }
  return totalChapters;
}

async function reconcileDownloadCounts() {

  const datos = await releerSiAbierta();
  if (!datos) return [];
  const fixed = [];
  for (const f of datos.fanfics) {
    const real = await countChaptersOnDisk(f.id);
    const stored = f.downloadedChapters || 0;
    if (real !== stored) {
      fixed.push({ title: f.title, before: stored, after: real });
      f.downloadedChapters = real;
    }
  }
  if (fixed.length > 0) await writeDB();
  return fixed;
}

function fusionarEtiquetas(fanfic, tagsNuevas) {
  if (!Array.isArray(tagsNuevas) || tagsNuevas.length === 0) return;
  const actuales = Array.isArray(fanfic.tags) ? fanfic.tags : [];
  const vistas = new Set(actuales.map(t => `${t.category}|${String(t.name).toLowerCase()}`));
  for (const t of tagsNuevas) {
    const clave = `${t.category}|${String(t.name).toLowerCase()}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    actuales.push(t);
  }
  fanfic.tags = actuales;
}

async function updateChapterList(id, chapters, extraMeta = {}) {
  const datos = await leer();
  const fanfic = datos.fanfics.find(f => String(f.id) === String(id));
  if (!fanfic) return null;

  const viejo = Array.isArray(fanfic.chapterList) ? fanfic.chapterList : [];
  const before = viejo.length;

  const conocidos = new Set(viejo.map(ch => claveDeCapitulo(ch.url)));
  const nuevos = chapters.filter(ch => !conocidos.has(claveDeCapitulo(ch.url))).length;

  let realineado = null;
  const plan = before ? planDeRealineado(viejo, chapters) : null;
  if (plan?.cambia) {

    if (plan.mapa.size >= 0.8 * before || plan.mapa.size >= 0.8 * chapters.length) {

      realineado = { ...moverFicheros(carpetaDeObra(id), plan), porTitulo: plan.porTitulo, dudosas: plan.dudosos };
      Object.assign(fanfic, remapearDatos(fanfic, plan.mapa, chapters.length));
      fanfic.downloadedChapters = await countChaptersOnDisk(id);
      console.log(`[Índice] «${fanfic.title}»: ${realineado.movidos} fichero(s) recolocados, ${realineado.apartados} apartados.`);
    } else {

      console.warn(`[Índice] «${fanfic.title}»: sólo ${plan.mapa.size} de ${before} capítulos emparejan con el índice nuevo; se conserva el que había.`);
      return { before, after: before, nuevos: 0, conservado: true };
    }
  }

  fanfic.chapterList = chapters;
  fanfic.totalChapters = chapters.length;

  const { tags: tagsNuevas, ...restoMeta } = extraMeta;
  fusionarEtiquetas(fanfic, tagsNuevas);

  const esRelleno = (clave, valor) => {
    if (valor === undefined || valor === null || valor === '') return true;
    if (typeof valor !== 'string') return false;
    if (valor === 'Autor desconocido' || valor === 'Obra sin título') return true;

    if (clave === 'author' && /^Traducci[oó]n\s*[—-]/i.test(valor)) return true;

    if (clave === 'synopsis' && /^Read\s+.+\son\s+\S/i.test(valor)) return true;
    return false;
  };

  const ESTADO_VIVO = new Set([
    'completa', 'wordCount', 'kudos',

    'capitulosDePago', 'capitulosLibres',

    'series'
  ]);

  for (const [k, v] of Object.entries(restoMeta)) {
    if (v === undefined || v === null || v === '') continue;
    if (ESTADO_VIVO.has(k)) {
      fanfic[k] = v;
    } else if (v && esRelleno(k, fanfic[k])) {
      fanfic[k] = v;
    }
  }

  await writeDB();
  return { before, after: chapters.length, nuevos, realineado, fanfic };
}

async function getFanficById(id) {
  const datos = await leer();
  return datos.fanfics.find(f => String(f.id) === String(id)) || null;
}

async function origenesDeObras() {
  const datos = await leer();
  return Object.fromEntries(datos.fanfics.map(f => [String(f.id), { origen: f.origen || 'propia', source: f.source || '', url: f.url || '' }]));
}

async function elegirCapitulos(id, indices) {
  const datos = await leer();
  const obra = datos.fanfics.find(f => String(f.id) === String(id));
  if (!obra) throw new Error('Obra no encontrada');
  if (obra.needsChapterSelection !== true) throw new Error('Esta obra no necesita selección');
  if (!Array.isArray(indices) || indices.length === 0 || !Array.isArray(obra.chapterList)
    || Array.from(indices).some(i => !Number.isInteger(i) || i < 0 || i >= obra.chapterList.length)) {
    throw new Error('Selecciona al menos un capítulo con índices válidos');
  }
  const elegidos = new Set(indices);
  obra.chapterList = obra.chapterList.filter((_, i) => elegidos.has(i));
  obra.totalChapters = obra.chapterList.length;
  delete obra.needsChapterSelection;
  await writeDB();
  return obra;
}

module.exports = {
  elegirCapitulos,
  origenesDeObras,
  getFanfics,
  getFanficById,
  addFanfic,
  updateProgress,
  marcarRevisado,
  saveChapterContent,
  getChapterContent,
  updateDownloadCount,
  setPortadaPreferida,
  setAutorUrl,
  setFuente,
  updateCoverUrl,
  saveScrollPosition,
  guardarProgresoRemoto,
  getScrollPosition,
  saveCoverLocally,
  updateLocalCoverPath,
  sellarPortada,
  deleteFanfic,
  countChaptersOnDisk,
  medirPalabras,
  firstMissingChapter,
  reconcileDownloadCounts,
  updateChapterList
};
