const { getFanficById, setOrigen } = require('./db.js');
const cola = require('./cola.js');

async function adoptarObra(fanficId, opciones = {}) {
  const id = String(fanficId);
  const fanfic = await getFanficById(id);
  if (!fanfic) return { status: 'error', message: 'Fanfic no encontrado' };
  if (fanfic.origen !== 'descubierta') return { status: 'ok', yaEra: true };

  await setOrigen(id, 'propia');
  if (Array.isArray(fanfic.chapterList) && fanfic.chapterList.length > 1) {

    await cola.encolar('descargar-capitulos', { fanficId: id },
      { prioritario: opciones?.paraLeer !== false });
  } else if (!fanfic.chapterList?.length) {

    await cola.encolar('comprobar-capitulos', { fanficId: id },
      { prioritario: opciones?.paraLeer !== false });
  }
  return { status: 'ok' };
}

module.exports = { adoptarObra };
