const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const {
  getFanficById, getGlosario, glosarioParaTraducir, setGlosario, getSettings, setSinopsisTraducida
} = require('../db.js');
const { obtenerCapituloTraducido, tieneTraduccion, traducirSinopsis } = require('../translate.js');
const { limpiarHtml } = require('../limpiar-html.js');
const traduccion = require('../traduccion-anticipada.js');
const { avisar } = require('../ventana.js');
const { dirDeFanfic } = require('../rutas.js');
const { enLaCarpeta } = require('../barrera-disco.js');

function registrar() {

  ipcMain.handle('has-translation', async (event, id, chapterIndex, idioma) => {
    const dir = dirDeFanfic(id);
    return tieneTraduccion(dir, chapterIndex, idioma);
  });

  ipcMain.handle('translate-chapter', enLaCarpeta(async (event, id, chapterIndex, idioma) => {
    const dir = dirDeFanfic(id);

    const avanzar = (datos) => avisar('translate-progress', {
      fanficId: String(id), chapterIndex, ...datos
    });

    try {
      const r = await obtenerCapituloTraducido(
        dir, chapterIndex, idioma,
        (p) => avanzar({ step: 'traduciendo', ...p }),
        await glosarioParaTraducir(id)
      );
      avanzar({ step: 'complete', cacheado: r.cacheado });

      return {
        status: 'ok',

        html: limpiarHtml(r.html),
        cacheado: r.cacheado,
        mismoIdioma: !!r.mismoIdioma,
        idiomaOriginal: r.idiomaOriginal || null
      };
    } catch (err) {
      console.error('[Traducción]', err.message);
      avanzar({ step: 'error', message: err.message });
      return { status: 'error', message: err.message };
    }
  }));

  ipcMain.handle('translate-synopsis', async (event, id, idioma) => {
    if (!idioma) return { status: 'error', message: 'Falta el idioma' };

    const fanfic = await getFanficById(String(id));
    if (!fanfic) return { status: 'error', message: 'Fanfic no encontrado' };

    const guardada = fanfic.sinopsisTraducida?.[idioma];
    if (guardada) return { status: 'ok', texto: guardada, cacheado: true };

    const original = (fanfic.synopsis || '').trim();
    if (!original) return { status: 'ok', texto: '', cacheado: true };

    if (Date.now() < traduccion.pausadoHasta()) {
      const minutos = Math.max(1, Math.ceil((traduccion.pausadoHasta() - Date.now()) / 60000));
      return {

        status: 'error',
        codigo: 'ritmo',
        message: `El traductor está limitando las peticiones. Se reintenta solo en ${minutos} min.`,
        reintentaEn: traduccion.pausadoHasta()
      };
    }

    try {

      const texto = (await traducirSinopsis(original, idioma, await glosarioParaTraducir(String(id)))).trim();

      const resultado = texto || original;
      await setSinopsisTraducida(String(id), idioma, resultado);
      return { status: 'ok', texto: resultado, cacheado: false };
    } catch (err) {

      const limitando = /limitando/i.test(err.message || '');

      if (limitando) traduccion.anotarLimite();
      console.warn('[Sinopsis]', err.message);
      return { status: 'error', codigo: limitando ? 'ritmo' : 'fallo', message: err.message };
    }
  });

  ipcMain.handle('redo-translations', enLaCarpeta(async (event, fanficId) => rehacer(fanficId)));

  ipcMain.handle('redo-translations-many', enLaCarpeta(async (event, ids) => {
    let borradas = 0, obras = 0;
    for (const id of (Array.isArray(ids) ? ids : []).slice(0, 1000)) {
      const r = await rehacer(id, { soloSiHabia: true });
      if (r.status !== 'ok') return { ...r, obras, borradas };
      if (r.borradas) obras++;
      borradas += r.borradas;
    }
    return { status: 'ok', obras, borradas };
  }));

  async function rehacer(fanficId, { soloSiHabia = false } = {}) {
    const id = String(fanficId);
    const ajustes = await getSettings();
    const idioma = ajustes?.lang;
    if (!idioma) return { status: 'error', message: 'No hay idioma configurado' };

    const dir = dirDeFanfic(id);
    if (!fs.existsSync(dir)) return { status: 'ok', borradas: 0 };

    let borradas = 0;
    for (const nombre of fs.readdirSync(dir)) {
      if (nombre.endsWith(`.${idioma}.html`)) {
        fs.unlinkSync(path.join(dir, nombre));
        borradas++;
      }
    }

    if (soloSiHabia && !borradas) return { status: 'ok', borradas: 0 };

    const fanfic = await getFanficById(id);
    const n = fanfic?.currentChapter || 0;
    await traduccion.encolar(id, [n, n + 1, n + 2], idioma);

    console.log(`[Glosario] "${fanfic?.title}": ${borradas} traducción(es) borradas para rehacerse.`);
    return { status: 'ok', borradas };
  }

  ipcMain.handle('get-glossary', async (event, fanficId) => await getGlosario(String(fanficId)));

  ipcMain.handle('set-glossary', async (event, fanficId, glosario) => {
    if (!Array.isArray(glosario)) return { status: 'error', message: 'Glosario no válido' };
    await setGlosario(String(fanficId), glosario);
    return { status: 'ok' };
  });

}

module.exports = { registrar };
