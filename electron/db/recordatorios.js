const { leer, writeDB } = require('./nucleo.js');

const buscar = (datos, id) => datos.fanfics.find(f => String(f.id) === String(id));

async function getRecordatorio(id, modo) {
  return buscar(await leer(), id)?.recordatorios?.[modo] || null;
}

async function setRecordatorio(id, modo, entrada) {
  const fanfic = buscar(await leer(), id);
  if (!fanfic) return;
  fanfic.recordatorios = { ...(fanfic.recordatorios || {}), [modo]: entrada };
  await writeDB();
}

async function memoriaTerminados() {
  return { terminados: { ...((await leer()).memoriaLectura?.terminados || {}) } };
}

module.exports = { getRecordatorio, setRecordatorio, memoriaTerminados };
