const cola = require('../cola.js');
const { getFanficById, updateChapterList, marcarRevisado, getSettings } = require('../db.js');
const { scrapeStory, urlDeAutor } = require('../scrapers/index.js');
const avisos = require('../avisos.js');
const { avisar } = require('../ventana.js');
const { esDelDisco } = require('../epub-importar.js');

async function comprobarCapitulos({ fanficId }) {
  const id = String(fanficId);
  const fanfic = await getFanficById(id);
  if (fanfic?.needsChapterSelection) return;

  if (!fanfic?.url || esDelDisco(fanfic.url)) return;

  const fresh = await scrapeStory(fanfic.url);
  if (fresh.needsChapterSelection) return;
  if (!fresh.chapters || fresh.chapters.length === 0) return;

  const res = await updateChapterList(id, fresh.chapters, {
    title: fresh.title,
    author: fresh.author,
    synopsis: fresh.synopsis,
    coverUrl: fresh.coverUrl,

    autorUrl: fresh.autorUrl ? (urlDeAutor(fresh.autorUrl) || fresh.autorUrl) : fresh.autorUrl,
    tags: fresh.tags,

    completa: fresh.completa,
    wordCount: fresh.wordCount,
    kudos: fresh.kudos,

    capitulosDePago: fresh.capitulosDePago,
    capitulosLibres: fresh.capitulosLibres,

    series: fresh.series?.length ? fresh.series : undefined
  });

  await marcarRevisado(id, res?.nuevos || 0);

  if (res?.nuevos > 0) {
    console.log(`[Capítulos] "${fanfic.title}": ${res.nuevos} nuevo(s).`);

    await cola.encolar('descargar-capitulos', { fanficId: id });
    avisar('chapters-updated', { fanficId: id, nuevos: res.nuevos });

    const ajustesAviso = await getSettings();
    if (ajustesAviso?.avisarCapitulos !== false && fanfic.origen !== 'descubierta') {
      avisos.hayCapitulosNuevos({ id, titulo: fanfic.title, nuevos: res.nuevos });
    }
  }
}

module.exports = {
  comprobarCapitulos
};
