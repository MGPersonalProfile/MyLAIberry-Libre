const CERTEZAS = ['segura', 'dudosa'];
const CAMPOS = ['capitulos', 'completa', 'etiqueta', 'autor', 'texto'];

const COMO_DAR_UNA_PISTA =
  'Cada pista lleva su certeza («segura» sólo si el usuario lo afirma sin dudar) y, cuando se pueda, ' +
  'un campo comprobable: «capitulos» con valor numérico y op min/max/aprox, «completa» con true/false, ' +
  '«etiqueta» o «autor» con el nombre, o «texto» para lo que sólo se puede buscar en título y sinopsis. ' +
  'No conviertas en «segura» algo que el usuario ha dicho dudando: una pista segura equivocada descarta la obra buena.';

const norm = s => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function comprobarPista(candidata, pista) {
  const valor = pista?.valor;

  if (pista?.campo === 'capitulos') {
    const tiene = Number(candidata?.totalChapters);
    const esperado = Number(valor);
    if (!Number.isFinite(tiene) || tiene <= 0 || !Number.isFinite(esperado)) return null;
    if (pista.op === 'max') return tiene <= esperado ? 'concuerda' : 'contradice';
    if (pista.op === 'aprox') return Math.abs(tiene - esperado) <= Math.max(5, esperado * 0.25) ? 'concuerda' : 'contradice';
    return tiene >= esperado ? 'concuerda' : 'contradice';
  }

  if (pista?.campo === 'completa') {

    if (typeof candidata?.completa !== 'boolean') return null;
    return candidata.completa === !!valor ? 'concuerda' : 'contradice';
  }

  if (pista?.campo === 'etiqueta') {
    const tags = (candidata?.tags || []).map(t => norm(t.name || t));
    if (!tags.length) return null;
    return tags.some(t => t.includes(norm(valor))) ? 'concuerda' : 'contradice';
  }

  if (pista?.campo === 'autor') {
    if (!candidata?.author) return null;
    return norm(candidata.author).includes(norm(valor)) ? 'concuerda' : 'contradice';
  }

  const donde = norm(`${candidata?.title || ''} ${candidata?.synopsis || ''}`);
  const buscado = norm(valor || pista?.text);
  return buscado && donde.includes(buscado) ? 'concuerda' : null;
}

function contrastar(candidata, pistas = []) {
  const concuerdan = [];
  const contradicen = [];
  const sinComprobar = [];

  for (const pista of pistas) {
    const resultado = comprobarPista(candidata, pista);
    if (resultado === 'concuerda') concuerdan.push(pista.text);
    else if (resultado === 'contradice') contradicen.push(pista.text);
    else sinComprobar.push(pista.text);
  }

  const rompeUnaSegura = pistas.some(p =>
    p.certeza === 'segura' && contradicen.includes(p.text));

  return {
    url: candidata?.url,
    title: candidata?.title,
    fuente: candidata?.fuente,
    concuerdan, contradicen, sinComprobar,

    veredicto: rompeUnaSegura ? 'descartada' : (concuerdan.length ? 'encaja' : 'sin comprobar')
  };
}

function contrastarCaso(candidatas = [], pistas = []) {
  const orden = { encaja: 0, 'sin comprobar': 1, descartada: 2 };
  return candidatas
    .map(c => contrastar(c, pistas))
    .sort((a, b) => orden[a.veredicto] - orden[b.veredicto] || b.concuerdan.length - a.concuerdan.length);
}

function normalizarPista(pista) {
  const text = String(pista?.text || '').trim();
  if (!text) throw new Error('Una pista sin texto no sirve de nada.');
  const certeza = CERTEZAS.includes(pista?.certeza) ? pista.certeza : 'dudosa';
  const campo = CAMPOS.includes(pista?.campo) ? pista.campo : 'texto';
  return { text, certeza, campo, valor: pista?.valor ?? text, op: pista?.op || 'min' };
}

function pistasDelCaso({ pistas, clues }) {
  if (Array.isArray(pistas) && pistas.length) return pistas.map(normalizarPista);
  return String(clues || '')
    .split(/[;\n]|,(?=\s)/)
    .map(t => t.trim())
    .filter(t => t.length > 2)
    .slice(0, 20)
    .map(text => normalizarPista({ text, certeza: 'dudosa', campo: 'texto', valor: text }));
}

module.exports = { COMO_DAR_UNA_PISTA, CERTEZAS, CAMPOS, comprobarPista, contrastar, contrastarCaso, normalizarPista, pistasDelCaso };
