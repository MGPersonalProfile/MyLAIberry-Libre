const { randomUUID } = require('node:crypto');
const { estaCompleta } = require('./asistente-obra');

const ACCIONES_DE_RADAR = ['watchReturn', 'stopWatch'];

async function accionDeRadar(action, args, { state, services }) {
  if (action === 'watchReturn') {
    const work = (await services.library()).find(w => String(w.id) === String(args.workId));
    if (!work) throw new Error('Esa obra no está en la biblioteca.');
    const condition = args.condition === 'complete' ? 'complete' : 'chapters';
    if (condition === 'complete' && estaCompleta(work)) throw new Error('Esa obra ya está terminada.');
    const chapters = Math.max(1, Math.min(500, Math.floor(Number(args.chapters)) || 1));
    let vigilancia;
    await state.update(s => {

      vigilancia = s.radar.find(r => r.status === 'active' && String(r.workId) === String(work.id) && r.condition === condition);
      if (vigilancia) { vigilancia.chapters = chapters; return; }

      vigilancia = { reason: '', chapters, condition, workId: work.id, baseline: work.totalChapters, id: randomUUID(), status: 'active', createdAt: Date.now() };
      s.radar.push(vigilancia);
    });
    return vigilancia;
  }
  if (action === 'stopWatch') {
    return state.update(s => {
      const vigilancia = s.radar.find(r => r.id === args.id);
      if (!vigilancia) throw new Error('Vigilancia no encontrada.');
      vigilancia.status = 'stopped';
    });
  }
  throw new Error('Acción no disponible.');
}

async function radarParaPintar(estado, services) {
  const radar = estado.radar || [];
  if (!radar.length) return radar;
  const titulos = new Map((await services.library()).map(w => [String(w.id), w.title]));
  return radar.map(r => ({ ...r, title: titulos.get(String(r.workId)) || null }));
}

module.exports = { ACCIONES_DE_RADAR, accionDeRadar, radarParaPintar };
