const { ipcMain } = require('electron');
const { esDeLaBiblioteca } = require('../origen.js');

const cola = require('../cola.js');
const {
  getFanfics, getFanficById, deleteFanfic, setOrigen, setEnMiLista,
  setPortadaPreferida, getFondosDe
} = require('../db.js');
const { perfilDeGustos, ordenarPorAfinidad } = require('../afinidad.js');
const { detectScraper } = require('../scrapers/index.js');
const { limpiarFandom } = require('../fondos.js');
const { rutaDeFondo } = require('../db.js');
const { fandomDe } = require('../tareas/fondos.js');

function registrar() {

  ipcMain.handle('get-library', async () => {
    const todos = await getFanfics();
    return todos.filter(esDeLaBiblioteca);
  });

  ipcMain.handle('repeated-works', async (event, id) => {
    const { obrasRepetidas } = require('../obras-repetidas.js');
    const { pares } = obrasRepetidas(await getFanfics());
    return pares.filter(p => p.obras.some(o => o.id === String(id)))
      .map(p => ({ otra: p.obras.find(o => o.id !== String(id)), motivo: p.motivo === 'la misma dirección' ? 'direccion' : 'titulo-autor' }));
  });

  ipcMain.handle('get-discoveries', async () => {
    const todos = await getFanfics();
    const perfil = perfilDeGustos(todos.filter(esDeLaBiblioteca));
    const { preferencias } = await require('../db').getPreferenciasDescubrimientos();
    const { explicarDescubrimiento } = require('../descubrimientos-explicacion.js');
    return require('../descubrimientos-preferencias').ajustarDescubrimientos(
      ordenarPorAfinidad(todos.filter(f => f.origen === 'descubierta'), perfil), todos, preferencias)
      .map(o => ({ ...o, explicacion: explicarDescubrimiento(o, { preferencias, perfil }) }));
  });

  ipcMain.handle('get-discovery-preferences', () => require('../db').getPreferenciasDescubrimientos());
  ipcMain.handle('decidir-descubrimientos', async (event, opciones) => {
    try {
      const resultado = await require('../db').decidirDescubrimientos(opciones);
      require('../ventana').avisar('discoveries-updated', {});
      return resultado;
    } catch (e) { return { status: 'error', message: e.message }; }
  });

  ipcMain.handle('adopt-work', (event, fanficId, opciones = {}) => require('../adoptar.js').adoptarObra(fanficId, opciones));

  ipcMain.handle('get-suggestions', async (event, fanficId) => {
    const id = String(fanficId);
    const todas = (await getFanfics()).filter(f => String(f.id) !== id && f.origen !== 'descartada');

    const perfil = perfilDeGustos(todas.filter(esDeLaBiblioteca));

    const { preferencias } = await require('../db').getPreferenciasDescubrimientos();
    const descubiertas = require('../descubrimientos-preferencias').ajustarDescubrimientos(
      ordenarPorAfinidad(todas.filter(f => f.origen === 'descubierta'), perfil), await getFanfics(), preferencias);
    const sinEmpezar = ordenarPorAfinidad(
      todas.filter(f => f.origen !== 'descubierta' && !f.currentChapter && (f.downloadedChapters || 0) > 0),
      perfil
    );

    return [...descubiertas, ...sinEmpezar].slice(0, 3);
  });

  ipcMain.handle('set-reading-status', async (event, fanficId, estado) => {
    try {
      const hecho = await require('../db.js').setEstadoLectura(String(fanficId), estado ?? null);

      if (hecho) require('../ventana.js').avisar('estado-lectura-cambiado', { id: String(fanficId), estado: estado ?? null });
      return hecho ? { status: 'ok' } : { status: 'error', message: 'Esa obra ya no está.' };
    } catch (e) {
      return { status: 'error', message: e.message };
    }
  });

  ipcMain.handle('set-in-my-list', async (event, fanficId, dentro) => {
    const id = String(fanficId);
    let adoptada = false;

    if (dentro) {
      const fanfic = await getFanficById(id);
      if (fanfic?.origen === 'descubierta') {
        await setOrigen(id, 'propia');
        adoptada = true;
        if (Array.isArray(fanfic.chapterList) && fanfic.chapterList.length > 1) {
          await cola.encolar('descargar-capitulos', { fanficId: id });
        }
      }
    }

    const ok = await setEnMiLista(id, !!dentro);
    return { status: ok ? 'ok' : 'error', enMiLista: !!dentro, adoptada };
  });

  ipcMain.handle('discard-work', async (event, fanficId) => {
    try {
      const r = await require('../db').descartarObra(String(fanficId));
      require('../ventana').avisar('discoveries-updated', {});
      return r;
    } catch (e) { return { status: 'error', message: e.message }; }
  });

  ipcMain.handle('undo-discard', async (event, fanficId) => {
    try {
      const r = await require('../db').deshacerDescarte(String(fanficId));
      require('../ventana').avisar('discoveries-updated', {});
      return r;
    } catch (e) { return { status: 'error', message: e.message }; }
  });

  ipcMain.handle('get-discarded-works', async () => {
    try {
      return await require('../db').descartesRecientes();
    } catch { return []; }
  });

  ipcMain.handle('delete-fanfic', async (event, id) => {
    return await deleteFanfic(id);
  });

  ipcMain.handle('merge-works', async (event, quedaId, sobraId) => {
    try {
      const queda = await getFanficById(String(quedaId));
      const sobra = await getFanficById(String(sobraId));
      if (!queda || !sobra) return { status: 'error', message: 'Una de las dos obras ya no está en la biblioteca.' };

      if ((await cola.pendientes()).some(t => String(t.carga?.fanficId) === String(sobra.id))) {
        return { status: 'error', message: `«${sobra.title}» tiene trabajo en la cola (una descarga o una revisión): fúndelas cuando termine.` };
      }
      const { planDeFundir, reasignarEstado, mismosCapitulos } = require('../fundir-obras.js');
      const plan = planDeFundir(queda, sobra);
      const { conDisco } = require('../barrera-disco.js');
      const hecho = await conDisco(() => require('../db.js').fundirObras(queda.id, sobra.id, plan.cambios));
      let asistente = { movido: [], sinMover: [] };
      await require('./asistente.js').obtener().state.update(s => {
        asistente = reasignarEstado(s, sobra.id, queda.id, { mismos: mismosCapitulos(queda, sobra) });
      });

      require('../ventana.js').avisar('chapters-updated', { fanficId: String(queda.id), fundida: true });
      return {
        status: 'ok', queda: hecho.queda, fundida: hecho.fundida, apartadaEn: hecho.apartadaEn,
        pasado: [...plan.hecho, ...asistente.movido], sinMover: [...plan.sinMover, ...asistente.sinMover],
        message: `«${sobra.title}» fundida en «${queda.title}». La otra copia no se ha borrado: está apartada en «fundidas/».`
      };
    } catch (e) {
      return { status: 'error', message: e.message };
    }
  });

  ipcMain.handle('set-cover-preference', async (event, fanficId, valor) => {
    if (valor !== 'autor' && valor !== 'generada') {
      return { status: 'error', message: 'Valor de portada no válido' };
    }
    await setPortadaPreferida(String(fanficId), valor);
    return { status: 'ok', portadaPreferida: valor };
  });

  ipcMain.handle('get-backdrop', async (event, fanficId) => {
    const obra = await getFanficById(String(fanficId));
    if (!obra) return { ruta: null };

    const fandom = limpiarFandom(fandomDe(obra));
    if (!fandom) return { ruta: null };

    const fondos = await getFondosDe(fandom);
    if (fondos.length === 0) return { ruta: null, fandom };

    let h = 2166136261 >>> 0;
    const id = String(obra.id);
    for (let i = 0; i < id.length; i++) {
      h ^= id.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    const elegido = fondos[h % fondos.length];

    return {

      ruta: `local-file:///${encodeURI(rutaDeFondo(elegido.archivo).replace(/\\/g, '/'))}`,
      fandom,
      ancho: elegido.ancho,
      alto: elegido.alto
    };
  });

  ipcMain.handle('detect-site', async (event, url) => {
    try {
      const { name, tier } = detectScraper(url);
      return { name, tier };
    } catch {
      return { name: 'Desconocido', tier: 3 };
    }
  });

  ipcMain.handle('buscar-en-otros-sitios', async (event, fanficId) => {
    const obra = await getFanficById(String(fanficId));
    if (!obra) return { status: 'error', message: 'No se encuentra esa obra' };
    try {
      const { buscarEnTodos } = require('../buscar-en-todos.js');
      const encontradas = await buscarEnTodos(obra, { excluir: obra.url });
      return { status: 'ok', resultados: encontradas };
    } catch (err) {
      console.warn('[Buscar en otros sitios]', err.message);
      return { status: 'error', message: err.message };
    }
  });

}

module.exports = { registrar };
