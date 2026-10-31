const { pistasDelCaso, contrastarCaso } = require('./asistente-rescate');
const { randomUUID } = require('node:crypto');
const MAX_PISTAS = 200;
const { normal } = require('./descubrimientos-preferencias');

function herramientasEditarInvestigacion(add, { state }) {
  const str = { type: 'string', minLength: 1, maxLength: 4000 };
  add('actualizar_investigacion', 'Añade pistas a una investigación existente sin perder las anteriores, ni sus hallazgos o exclusiones. Consulta investigaciones para elegirla por query o id. Guarda de verdad las nuevas pistas; no basta con decirlo en el chat. query opcional cambia las palabras de búsqueda (máximo seis).',
    { investigacion: str, pistas: { type: 'array', maxItems: 20, items: { type: 'object', required: ['text', 'certeza'],
      properties: { text: str, certeza: { type: 'string', enum: ['segura', 'dudosa'] } } } }, query: str },
    async ({ investigacion, pistas, query }) => {
      if (!pistas.length) throw new Error('Añade al menos una pista.');
      if (query && query.trim().split(/\s+/).length > 6) throw new Error('Usa como máximo seis palabras de búsqueda.');
      let actualizada;
      await state.update(s => {
        const candidatas = s.investigations.filter(j => j.id === investigacion || normal(j.query) === normal(investigacion));
        if (candidatas.length !== 1) throw new Error('Consulta investigaciones y elige una investigación concreta.');
        actualizada = anadirPistas(candidatas[0], pistas, query);
      });
      return actualizada;
    }, ['investigacion', 'pistas']);
}

function anadirPistas(j, pistas, query) {
  const anteriores = pistasDelCaso(j);
  for (const p of pistasDelCaso({ pistas })) {
    const indice = anteriores.findIndex(x => normal(x.text) === normal(p.text));
    if (indice < 0) anteriores.push(p); else anteriores[indice] = p;
  }

  if (anteriores.length > MAX_PISTAS) {
    throw new Error(`La investigación tendría ${anteriores.length} pistas y el máximo es ${MAX_PISTAS}: reformula o junta las que digan lo mismo.`);
  }
  j.pistas = anteriores;
  if (query) j.query = query.trim();
  j.contrastadas = contrastarCaso(j.findings, j.pistas);
  j.nextAt = Date.now(); j.updatedAt = Date.now();
  return { investigacion: j.query, pistas: j.pistas, estado: j.status };
}

async function crearInvestigacion(args, { state }) {

  const pistas = pistasDelCaso(args);
  if (!String(args.query || '').trim()) throw new Error('Faltan las palabras de búsqueda.');
  if (!['search', 'lost'].includes(args.kind)) throw new Error('Tipo de investigación no válido.');

  if (args.kind === 'lost' && !pistas.length) throw new Error('Para buscar una historia perdida hacen falta pistas: lo que el usuario recuerde.');

  if (String(args.query).trim().split(/\s+/).length > 6) {
    throw new Error('Esa consulta es una frase: se repite tal cual en los buscadores de AO3, FanFiction.net, RoyalRoad y Gutenberg. Usa palabras clave cortas en inglés, como en buscar_obras («naruto self insert»).');
  }
  const job = { ...args, query: String(args.query).trim(), pistas, id: randomUUID(), status: 'active', findings: [], excluded: [], nextAt: Date.now(), intervalHours: 24, createdAt: Date.now() };
  await state.update(s => { s.investigations.push(job); });
  return job;
}

const ACCIONES_DE_INVESTIGACION = ['investigationStatus', 'createInvestigation', 'addClue', 'excludeFinding'];

function accionDeInvestigacion(action, args, { state }) {
  if (action === 'createInvestigation') {
    const { query, kind, pistas = [] } = args;
    return crearInvestigacion({ query, kind, pistas }, { state });
  }
  return state.update(s => {
    if (action === 'investigationStatus' && !['active', 'paused', 'closed'].includes(args.status)) throw new Error('Estado inválido.');
    const job = s.investigations.find(j => j.id === args.id); if (!job) throw new Error('Investigación no encontrada.');
    if (action === 'investigationStatus') job.status = args.status;
    if (action === 'addClue') {

      const text = String(args.text || '').trim();
      if (!text || text.length > 4000) throw new Error('Escribe la pista (hasta 4000 caracteres).');
      anadirPistas(job, [{ text, certeza: args.certeza === 'dudosa' ? 'dudosa' : 'segura' }]);
    }
    if (action === 'excludeFinding') {
      if (!job.findings.some(f => f.url === args.url)) throw new Error('Candidata no encontrada.');
      if (!job.excluded.includes(args.url)) job.excluded.push(args.url);
    }
  });
}

module.exports = { herramientasEditarInvestigacion, anadirPistas, crearInvestigacion, ACCIONES_DE_INVESTIGACION, accionDeInvestigacion };
