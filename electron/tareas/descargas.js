const fs = require('fs');
const path = require('path');

const {
  getFanficById, saveChapterContent, updateDownloadCount, countChaptersOnDisk,
  firstMissingChapter, medirPalabras, getSettings, getChapterContent
} = require('../db.js');
const { exigirCapitulo, textoPlano, huella, paraGuardar } = require('../capitulo-valido.js');
const { detectScraper } = require('../scrapers/index.js');
const { avisar } = require('../ventana.js');
const { dirDeFanfic } = require('../rutas.js');

function elegirDescargador(url) {
  const { scraper, name } = detectScraper(url);
  if (scraper && typeof scraper.downloadChapters === 'function') return scraper;
  console.warn(`[Descarga] ${name} no trae descargador propio: se usa el genérico.`);
  return require('../scrapers/universal');
}

function prepararTramo({ obra, id, desde, hasta, conHuecos }) {
  const tramo = obra.chapterList.slice(desde, hasta);
  if (!conHuecos) return tramo;

  const dir = dirDeFanfic(id);
  return tramo.map((cap, i) => ({
    ...cap,
    yaEnDisco: fs.existsSync(path.join(dir, `chapter_${desde + i}.html`))
  }));
}

function mensajeFinal({ enDisco, total, dePago }) {
  const alcanzable = total - dePago;
  if (dePago > 0 && enDisco >= alcanzable) {
    return `Descargados los ${enDisco} capítulos disponibles (${dePago} son de pago en el sitio).`;
  }
  return enDisco >= total ? 'Descarga completa.' : `Descargados ${enDisco} de ${total}.`;
}

function crearGuardador({ id, total, enDiscoInicial, ajustes, alGuardar }) {
  let enDisco = enDiscoInicial;

  const huellas = new Map();

  async function huellaDelAnterior(fid, indice) {
    if (indice <= 0) return null;
    if (huellas.has(indice - 1)) return huellas.get(indice - 1);
    const texto = textoPlano(await getChapterContent(fid, indice - 1).catch(() => null));
    return texto ? huella(texto) : null;
  }

  return async (fid, indice, crudo) => {

    const contenido = paraGuardar(crudo);

    try {
      huellas.set(indice, exigirCapitulo(contenido, { anterior: await huellaDelAnterior(fid, indice) }));
    } catch (err) {
      if (!err.capituloInvalido) throw err;
      console.warn(`[Descarga] Capítulo ${indice + 1} rechazado: ${err.message}`);
      avisar('download-progress', { fanficId: String(fid), step: 'chapter_rejected', index: indice, message: err.message });
      return false;
    }
    await saveChapterContent(fid, indice, contenido);
    enDisco++;
    await updateDownloadCount(fid, enDisco);
    avisar('download-progress', { fanficId: String(fid), step: 'chapter_saved', downloaded: enDisco, total });
    await alGuardar(fid, indice, ajustes);
  };
}

async function planDeDescarga({ id, hasta, avanzar }) {
  const obra = await getFanficById(id);
  if (!obra || obra.origen === 'descartada') return null;
  if (obra?.needsChapterSelection) return null;
  if (!Array.isArray(obra.chapterList) || obra.chapterList.length === 0) return null;

  const total = obra.chapterList.length;
  const meta = Math.min(total, hasta || total);

  const descargador = elegirDescargador(obra.url);
  const conHuecos = !!descargador.admiteHuecos;
  const desde = conHuecos ? 0 : await firstMissingChapter(id, meta);
  const enDiscoAntes = await countChaptersOnDisk(id);

  if (!conHuecos && desde >= meta) {
    if (meta >= total) {
      await updateDownloadCount(id, total);
      avanzar({ step: 'complete', message: 'Ya estaba completo.', downloaded: total, total });
    }
    return null;
  }

  return { obra, total, meta, descargador, conHuecos, desde, enDiscoAntes };
}

async function descargarFanfic({ fanficId, hasta } = {}, { alGuardarCapitulo } = {}) {
  const id = String(fanficId);
  const avanzar = (datos) => avisar('download-progress', { fanficId: id, ...datos });

  const plan = await planDeDescarga({ id, hasta, avanzar });
  if (!plan) return;
  const { obra, total, meta, descargador, conHuecos, desde, enDiscoAntes } = plan;

  avanzar({
    step: 'downloading_chapters',
    message: desde > 0
      ? `Reanudando en el capítulo ${desde + 1} de ${total}…`
      : `Descargando ${meta} capítulo${meta === 1 ? '' : 's'}…`,
    downloaded: desde,
    total
  });

  const ajustes = await getSettings();
  const guardar = crearGuardador({
    id, total, enDiscoInicial: enDiscoAntes, ajustes,
    alGuardar: alGuardarCapitulo || (async () => {})
  });

  try {
    await descargador.downloadChapters(
      prepararTramo({ obra, id, desde, hasta: meta, conHuecos }),
      id,
      avanzar,

      (fid, i, contenido) => guardar(fid, desde + i, contenido),

      desde
    );
  } catch (err) {
    console.error('[Descarga] Error:', err.message);
    avanzar({ step: 'error', message: err.message });

    throw err;
  }

  const enDisco = await countChaptersOnDisk(id);
  await updateDownloadCount(id, enDisco);

  await medirPalabras(id).catch(() => {});

  avanzar({
    step: 'complete',
    message: mensajeFinal({ enDisco, total, dePago: obra.capitulosDePago || 0 }),
    downloaded: enDisco,
    total,
    nuevos: Math.max(0, enDisco - enDiscoAntes)
  });
}

module.exports = { descargarFanfic, planDeDescarga, elegirDescargador, prepararTramo, mensajeFinal };
