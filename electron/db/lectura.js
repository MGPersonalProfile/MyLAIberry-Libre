const { leer, writeDB } = require('./nucleo.js');
const { enSeriePorObra, aplicarLectura, sellar } = require('../lector/revisiones.js');

async function updateProgress(id, currentChapter) {
  return enSeriePorObra(id, async () => {
    const datos = await leer();
    const fanfic = datos.fanfics.find(f => String(f.id) === String(id));
    if (!fanfic) return null;
    if (fanfic.currentChapter !== currentChapter) sellar(fanfic, currentChapter, undefined, Date.now());
    fanfic.lastReadAt = Date.now();
    fanfic.progresoEn = fanfic.lastReadAt;
    if (fanfic.capitulosNuevos) fanfic.capitulosNuevos = 0;
    await writeDB();
    return fanfic;
  });
}

async function saveScrollPosition(id, chapterIndex, position, meta) {
  return enSeriePorObra(id, async () => {
    const datos = await leer();
    const fanfic = datos.fanfics.find(f => String(f.id) === String(id));
    if (!fanfic) return { status: 'error', message: 'Obra no encontrada' };
    if (meta) {
      const resultado = aplicarLectura(fanfic, { ...meta, capitulo: chapterIndex, posicion: position },
        Date.now(), { moverCapitulo: false });
      if (resultado.aceptada && resultado.revision === fanfic.lecturaRevision) await writeDB();
      return { status: resultado.aceptada ? 'ok' : 'conflict', ...resultado };
    }
    const resultado = sellar(fanfic, chapterIndex, position, Date.now(), { moverCapitulo: false });
    await writeDB();
    return { status: 'ok', ...resultado };
  });
}

async function guardarProgresoRemoto({ obra, capitulo, ancla, en, deviceId, mutationId, baseRevision, posicion }) {
  return enSeriePorObra(obra, async () => {
    const datos = await leer();
    const fanfic = datos.fanfics.find(f => String(f.id) === String(obra));
    if (!fanfic) return false;
    const capitulos = Math.max((fanfic.chapterList || []).length, Number(fanfic.totalChapters) || 0);
    if (capitulos && capitulo >= capitulos) return false;
    if (deviceId && mutationId && Number.isInteger(baseRevision)) {
      const resultado = aplicarLectura(fanfic, { deviceId, mutationId, baseRevision,
        capitulo, posicion: posicion ?? { px: 0, ancla: ancla || null } });
      if (resultado.aceptada && resultado.revision === fanfic.lecturaRevision) await writeDB();
      return resultado;
    }
    if (en <= (Number(fanfic.progresoEn || fanfic.lastReadAt) || 0)) return false;

    if (fanfic.lecturaRevision > 0) {
      sellar(fanfic, capitulo, { px: 0, ancla: ancla || null }, en);
      await writeDB();
      return true;
    }
    fanfic.currentChapter = capitulo;
    fanfic.lastReadAt = en;
    fanfic.progresoEn = en;
    fanfic.scrollPositions ||= {};
    fanfic.scrollPositions[capitulo] = { px: 0, ancla: ancla || null };
    if (fanfic.capitulosNuevos) fanfic.capitulosNuevos = 0;
    await writeDB();
    return true;
  });
}

async function getScrollPosition(id, chapterIndex) {
  const datos = await leer();
  const fanfic = datos.fanfics.find(f => String(f.id) === String(id));
  return fanfic?.scrollPositions?.[chapterIndex] || 0;
}

module.exports = { updateProgress, saveScrollPosition, guardarProgresoRemoto, getScrollPosition };
