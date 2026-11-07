const { mismaObra } = require('./misma-obra');
const { explicarDescubrimiento } = require('./descubrimientos-explicacion');

async function buscarCandidata(ref, db, recientes) {
  const pedida = String(ref || '').trim().toLowerCase();
  const enDb = (await db.getFanfics().catch(() => []))
    .find(f => String(f.id) === pedida || mismaObra(f.url, ref) || String(f.title || '').trim().toLowerCase() === pedida);
  if (enDb) return { candidata: enDb, deDb: true };

  const vista = recientes.obtener(ref);
  if (vista?.obra) return { candidata: { ...vista.obra, fuente: vista.fuente, filtros: vista.filtros }, deDb: false };

  return { error: 'No sale en ninguna búsqueda ni en Descubrimientos: búscala primero con buscar_obras.' };
}

async function obtenerFicha(candidata, presupuesto, conRitmo, leerFicha, estado) {
  const tieneFicha = Boolean(candidata.fichaGuardada || (candidata.title && (candidata.tags?.length || candidata.synopsis)));
  if (tieneFicha) return candidata;

  if (presupuesto.maxPeticiones !== undefined && estado.peticionesWeb >= presupuesto.maxPeticiones) {
    estado.resultadoParcial = true;
    return candidata;
  }

  const leida = await conRitmo(candidata.url, () => leerFicha(candidata.url));
  estado.peticionesWeb++;
  return Object.assign(candidata, leida, { fichaGuardada: true });
}

async function obtenerCapitulo1(candidata, presupuesto, conRitmo, leerCap1, db, estado) {
  if (candidata.capitulo1Guardado || candidata.capitulo1) return candidata.capitulo1 || 'Capítulo 1 ya guardado.';
  let texto = candidata.id ? await db.getChapterContent(candidata.id, 0).catch(() => null) : null;
  if (texto) return texto;

  if (presupuesto.maxPeticiones !== undefined && estado.peticionesWeb >= presupuesto.maxPeticiones) {
    estado.resultadoParcial = true;
    return null;
  }

  texto = await conRitmo(candidata.url, () => leerCap1(candidata));
  estado.peticionesWeb++;
  candidata.capitulo1 = texto;
  return texto;
}

async function analizarTexto(candidata, texto, presupuesto, analizar, estado, interpretaciones) {
  if (!texto) return;
  if (presupuesto.maxLlamadasModelo !== undefined && estado.llamadasModelo >= presupuesto.maxLlamadasModelo) {
    estado.resultadoParcial = true;
    return;
  }

  const res = await analizar(candidata, texto);
  estado.llamadasModelo++;
  if (res.inputTokens) estado.inputTokens = (estado.inputTokens || 0) + res.inputTokens;
  if (res.outputTokens) estado.outputTokens = (estado.outputTokens || 0) + res.outputTokens;
  if (res.tono) interpretaciones.push({ tipo: 'tono', nivel: 'C', valor: res.tono });
  if (res.ritmo) interpretaciones.push({ tipo: 'ritmo', nivel: 'C', valor: res.ritmo });
  if (res.estilo) interpretaciones.push({ tipo: 'estilo', nivel: 'C', valor: res.estilo });
}

async function investigarPropuesta({ obra, nivel = 'ficha', presupuesto = {} } = {}, deps = {}) {
  const db = deps.db || require('./db.js');
  const recientes = deps.recientes || require('./filtros/recientes.js');
  const conRitmo = deps.conRitmo || require('./scrapers/navegar.js').conRitmo;
  const leerFicha = deps.leerFicha || (url => require('./scrapers/index.js').scrapeStory(url));
  const leerCapitulo1 = deps.leerCapitulo1 || (async o => require('./propuestas.js').primerCapitulo({ obra: o.url || o.id }));
  const analizar = deps.analizar || (async () => ({ tono: 'adecuado', ritmo: 'constante' }));
  const ahora = deps.ahora || (() => Date.now());

  const { candidata, deDb, error } = await buscarCandidata(obra, db, recientes);
  if (error) return { error };

  const estado = { peticionesWeb: 0, llamadasModelo: 0, resultadoParcial: false };
  const interpretaciones = [];

  const conFicha = await obtenerFicha(candidata, presupuesto, conRitmo, leerFicha, estado);
  let capMax = 0;

  if (nivel === 'primer_capitulo' || nivel === 'analisis') {
    const texto = await obtenerCapitulo1(conFicha, presupuesto, conRitmo, leerCapitulo1, db, estado);
    if (texto) capMax = 1;
    if (nivel === 'analisis' && texto) {
      await analizarTexto(conFicha, texto, presupuesto, analizar, estado, interpretaciones);
    }
  }

  const { preferencias } = await db.getPreferenciasDescubrimientos().catch(() => ({ preferencias: {} }));
  const exp = explicarDescubrimiento(conFicha, { preferencias });
  const coste = { peticionesWeb: estado.peticionesWeb, llamadasModelo: estado.llamadasModelo,
    ...(estado.inputTokens ? { inputTokens: estado.inputTokens } : {}),
    ...(estado.outputTokens ? { outputTokens: estado.outputTokens } : {}) };

  const resultado = {
    url: conFicha.url, title: conFicha.title, capituloMaximo: capMax,
    datosComprobados: exp.conocido, evidencias: exp.motivos, interpretaciones,
    restriccionesNoVerificadas: exp.advertencias, resultadoParcial: estado.resultadoParcial, coste, fecha: ahora()
  };

  if (deDb && conFicha.id) {
    await db.marcarPropuesta(conFicha.id, { investigacion: resultado, coste }).catch(() => {});
  }
  return resultado;
}

module.exports = { investigarPropuesta };
