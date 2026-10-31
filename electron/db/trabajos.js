const { leer, writeDB } = require('./nucleo.js');

async function getTrabajos() {
  const datos = await leer();
  return datos.trabajos || [];
}

async function setTrabajos(lista) {
  const datos = await leer();
  datos.trabajos = lista;
  await writeDB();
}

async function getQueue() {
  const datos = await leer();
  return datos.downloadQueue || [];
}

async function enqueueDownload(fanficId) {
  const datos = await leer();
  if (!Array.isArray(datos.downloadQueue)) datos.downloadQueue = [];
  const id = String(fanficId);
  if (!datos.downloadQueue.some(j => String(j.fanficId) === id)) {
    datos.downloadQueue.push({ fanficId: id, queuedAt: Date.now() });
    await writeDB();
  }
  return datos.downloadQueue;
}

async function dequeueDownload(fanficId) {
  const datos = await leer();
  if (!Array.isArray(datos.downloadQueue)) datos.downloadQueue = [];
  const id = String(fanficId);
  datos.downloadQueue = datos.downloadQueue.filter(j => String(j.fanficId) !== id);
  await writeDB();
  return datos.downloadQueue;
}

async function getAssistantState() {
  const datos = await leer();
  return datos.assistant || null;
}

async function updateAssistantState(cambiar) {
  const datos = await leer();
  const next = cambiar(JSON.parse(JSON.stringify(datos.assistant || null)));
  if (!next || typeof next !== 'object' || typeof next.then === 'function') throw new Error('Actualización de asistente inválida.');
  datos.assistant = next;
  await writeDB();
  return next;
}

module.exports = {
  getTrabajos,
  setTrabajos,
  getQueue,
  enqueueDownload,
  dequeueDownload,
  getAssistantState,
  updateAssistantState
};
