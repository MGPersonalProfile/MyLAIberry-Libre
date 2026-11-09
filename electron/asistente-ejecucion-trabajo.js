const { randomUUID } = require('node:crypto');
const { aplanar } = require('./asistente-busqueda');
const { contrastarCaso } = require('./asistente-rescate');

const INTERNET_MS = 90000;

const cancelada = () => Object.assign(new Error('Ejecución cancelada.'), { cancelada: true });

function carrera(promesa, signal) {
  if (signal.aborted) { promesa.catch(() => {}); return Promise.reject(cancelada()); }
  return new Promise((resolver, rechazar) => {
    const parar = () => rechazar(cancelada());
    signal.addEventListener('abort', parar, { once: true });
    promesa.then(resolver, rechazar).finally(() => signal.removeEventListener('abort', parar));
  });
}

function aviso(job, cuantas) {
  if (job.kind !== 'lost') return `${cuantas} candidatas nuevas para «${job.query}»`;
  const encajan = (job.contrastadas || []).filter(c => c.veredicto === 'encaja').length;
  return encajan
    ? `${encajan} de ${job.findings.length} candidatas encajan con tus pistas sobre «${job.query}»`
    : `Ninguna de las ${job.findings.length} candidatas de «${job.query}» encaja todavía con tus pistas`;
}

async function enInternet(consulta, { services, signal, origen }) {
  if (!services.crearInvestigador) return { results: [], errors: [] };

  if (signal.aborted) throw cancelada();
  const controller = new AbortController();
  const parar = () => controller.abort();
  signal.addEventListener('abort', parar, { once: true });
  const tope = setTimeout(parar, INTERNET_MS);

  const web = services.crearInvestigador({ signal: controller.signal, ...(origen === 'movil' ? { origen: 'movil' } : {}) });
  try {
    const r = await carrera(web.buscarEnInternet({ consulta }), controller.signal);
    const results = (r?.resultados || []).filter(x => /^https?:/.test(x?.url || '')).slice(0, 8)
      .map(x => ({ title: String(x.titulo || x.url).slice(0, 200), url: x.url, synopsis: String(x.extracto || '').slice(0, 300), fuente: 'Internet' }));
    return { results, errors: results.length ? [] : (r?.errores || []).map(e => `Internet: ${e}`), sinConsultar: results.length ? [] : ['Internet'] };
  } catch (e) {
    if (signal.aborted) throw cancelada();
    return { results: [], errors: [`Internet: ${e.message}`], sinConsultar: ['Internet'] };
  } finally { clearTimeout(tope); signal.removeEventListener('abort', parar); web.cerrar?.(); }
}

function fusionar(s, jobId, { results, errors }, { origen, acumular }) {
  const current = s.investigations.find(j => j.id === jobId);
  if (!current || current.status === 'closed' || (origen === 'periodica' && current.status !== 'active')) return 0;
  const added = results.filter(r => !current.findings.some(f => f.url === r.url) && !current.excluded.includes(r.url));
  current.findings.push(...added);
  current.lastAt = Date.now();
  current.errors = acumular ? [...(current.errors || []), ...errors] : errors;
  if (current.kind === 'lost') current.contrastadas = contrastarCaso(current.findings, current.pistas || []);
  return added.length;
}

async function trabajar({ job, services, state, signal, origen, fase, parcial }) {
  const guardar = async (r, acumular) => {
    let nuevas = 0;
    await state.update(s => { nuevas = fusionar(s, job.id, r, { origen, acumular }); });
    parcial.nuevas += nuevas;
    parcial.errores.push(...r.errors);
    parcial.sinConsultar.push(...(r.sinConsultar || []));
  };
  if (signal.aborted) throw cancelada();
  await fase('buscando');

  const bloques = await carrera(Promise.resolve(services.search(job.query)), signal);
  const result = aplanar(bloques);
  await guardar({ ...result, sinConsultar: Array.isArray(bloques) ? bloques.filter(b => b?.error).map(b => b.fuente) : [] }, false);
  if (job.kind === 'lost') {
    await fase('internet');
    await guardar(await enInternet(job.query, { services, signal, origen }), true);
  }
  parcial.total = (await state.read()).investigations.find(j => j.id === job.id)?.findings.length ?? 0;
  return parcial;
}

function avisarDeHallazgos(s, jobId, nuevas) {
  const current = s.investigations.find(j => j.id === jobId);
  if (current && nuevas) s.inbox.push({ id: randomUUID(), text: aviso(current, nuevas), investigationId: jobId, at: Date.now() });
}

module.exports = { trabajar, enInternet, avisarDeHallazgos, carrera, cancelada, aviso, INTERNET_MS };
