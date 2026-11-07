const { esObra } = require('./asistente-vetos');

const AVISO = 'No hay sinopsis disponible: dilo así. No la inventes ni la deduzcas del título, las etiquetas o el fandom; ofrece abrir su ficha.';

const NIVELES_EVIDENCIA = {
  SINOPSIS: 'sinopsis publicada',
  FICHA: 'ficha consultada',
  INFERIDA: 'inferida de etiquetas o título',
  NO_COMPROBADA: 'no comprobada'
};

const normalizar = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const palabras = (s) => normalizar(s).split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 2);

const TEMA_ALIAS = {
  'time travel': ['tiempo', 'viaje', 'pasado', 'volver', 'futuro', 'regreso', 'past', 'time', 'travel', 'return'],
  'viaje en el tiempo': ['tiempo', 'viaje', 'pasado', 'volver', 'futuro', 'regreso', 'past', 'time', 'travel', 'return']
};

function evidenciaSinopsis(sinopsis, pStr, terms, url) {
  if (!sinopsis) return null;
  const sNorm = normalizar(sinopsis);
  const coincideFrase = sNorm.includes(pStr);
  const coincideMecanismo = terms.length > 0 && terms.filter(t => sNorm.includes(t)).length >= Math.min(terms.length, 2);
  const reMecanismo = /recuerd|memori|vuelv|volver|pasad|past|ten|diez|anos|years|futur/;
  if (coincideFrase || (coincideMecanismo && terms.some(t => reMecanismo.test(t) ? sNorm.includes(t) : false))) {
    return { nivel: NIVELES_EVIDENCIA.SINOPSIS, evidencia: sinopsis.slice(0, 200), url, valida: true };
  }
  return null;
}

function inferenciaTagsOTitulo(tags, titulo, terms, pStr, url) {
  const tagCoincide = tags.find(t => {
    const tNorm = normalizar(t);
    if (terms.some(term => tNorm.includes(term))) return true;
    for (const [tema, aliases] of Object.entries(TEMA_ALIAS)) {
      if (tNorm.includes(tema) && aliases.some(a => terms.includes(a) || pStr.includes(a))) return true;
    }
    return false;
  });
  const tituloCoincide = terms.some(term => normalizar(titulo).includes(term));
  if (tagCoincide || tituloCoincide) {
    return {
      nivel: NIVELES_EVIDENCIA.INFERIDA,
      evidencia: tagCoincide ? `Etiqueta: ${tagCoincide}` : `Título: ${titulo}`,
      url,
      valida: false
    };
  }
  return null;
}

function evaluarEvidencia(obra, premisa = '', { ficha = false } = {}) {
  const url = obra?.url || '';
  if (!obra || typeof obra !== 'object') {
    return { nivel: NIVELES_EVIDENCIA.NO_COMPROBADA, evidencia: null, url, valida: false };
  }
  const sinopsis = String(obra.synopsis || '').trim();
  const tags = (obra.tags || []).map(t => String(t?.name || t)).filter(Boolean);
  const titulo = String(obra.title || obra.titulo || '');
  const pStr = normalizar(premisa);

  if (!pStr) {
    if (ficha || obra.estadoVerificacion === 'ficha_consultada') {
      return { nivel: NIVELES_EVIDENCIA.FICHA, evidencia: 'Ficha consultada', url, valida: true };
    }
    if (sinopsis) {
      return { nivel: NIVELES_EVIDENCIA.SINOPSIS, evidencia: sinopsis.slice(0, 150), url, valida: true };
    }
    return { nivel: NIVELES_EVIDENCIA.NO_COMPROBADA, evidencia: null, url, valida: false };
  }

  const terms = palabras(premisa).filter(w => !/^(para|como|este|esta|estos|estas|donde|cuando|sobre|desde|hacia|pero|algo|obra|fanfic|fic)$/.test(w));
  const deSinopsis = evidenciaSinopsis(sinopsis, pStr, terms, url);
  if (deSinopsis) return deSinopsis;

  if (ficha && obra.estadoVerificacion === 'ficha_consultada') {
    return { nivel: NIVELES_EVIDENCIA.FICHA, evidencia: 'Ficha consultada y verificada', url, valida: true };
  }

  const inferida = inferenciaTagsOTitulo(tags, titulo, terms, pStr, url);
  if (inferida) return inferida;

  return { nivel: NIVELES_EVIDENCIA.NO_COMPROBADA, evidencia: null, url, valida: false };
}

const AFIRMA_VERIFICADO = /\b(?:verificad[oa]s?|comprobad[oa]s?|confirmad[oa]s?|he(?:mos)?\s+(?:verificado|comprobado|confirmado)|est[aá]n?\s+(?:verificad[oa]s?|comprobad[oa]s?|confirmad[oa]s?)|se\s+(?:comprueba|verifica|confirma))\b/i;
const AFIRMA_GLOBAL = new RegExp(AFIRMA_VERIFICADO.source, 'gi');
const ES_INFERENCIA = /\b(?:inferencia|inferir|inferid[oa]s?|deducci[oó]n|deducir|hip[oó]tesis|suposici[oó]n|posible|quiz[aá]s?|tal vez|probablemente|no\s+(?:est[aá]\s+)?comprobad[oa]|sin\s+comprobar)\b/i;

function obrasDeContexto(ctx) {
  const encontradas = new Map();
  const agregar = (o) => { const t = o?.title || o?.titulo; if (t && !encontradas.has(t)) encontradas.set(t, o); };
  if (Array.isArray(ctx?.vistas)) ctx.vistas.forEach(agregar);
  if (Array.isArray(ctx?.messages)) {
    for (const m of ctx.messages) {
      if (m.role === 'tool' && typeof m.content === 'string') {
        try {
          const parsed = JSON.parse(m.content);
          const lista = Array.isArray(parsed) ? parsed : (parsed.obras || (parsed.title ? [parsed] : []));
          lista.forEach(agregar);
        } catch {  }
      }
    }
  }
  return [...encontradas.values()];
}

function afirmacionesSinEvidencia(texto, ctx) {
  if (!texto || !AFIRMA_VERIFICADO.test(texto)) return [];
  const candidatos = obrasDeContexto(ctx);
  if (!candidatos.length) return [];
  const premisa = ctx.textoDelUsuario || '';
  const frases = String(texto).split(/(?<=[.!?\n;])/);
  const fallidas = [];

  for (const c of candidatos) {
    const ev = c.evidenciaPremisa || c.evidencia || evaluarEvidencia(c, premisa);
    if (ev.valida) continue;
    const nombre = String(c.title || c.titulo || '');
    if (!nombre) continue;
    const afirmada = frases.some(f => {
      const mencionaObra = f.includes(nombre) || (/\b(?:ambas|todas|dos)\s+obras\b/i.test(f) && (f.includes(nombre) || candidatos.length <= 2));
      return mencionaObra && AFIRMA_VERIFICADO.test(f) && !ES_INFERENCIA.test(f);
    });
    if (afirmada) fallidas.push({ obra: c, titulo: nombre, url: c.url, nivel: ev.nivel });
  }
  return fallidas;
}

function rechazarVerificacionSinEvidencia(texto, ctxOCandidatos = [], premisa = '') {
  if (!texto || !AFIRMA_VERIFICADO.test(texto)) return texto;
  const ctx = Array.isArray(ctxOCandidatos)
    ? { vistas: ctxOCandidatos, textoDelUsuario: premisa }
    : (ctxOCandidatos || {});
  const candidatos = obrasDeContexto(ctx);
  if (!candidatos.length) return texto;
  const userPremisa = ctx.textoDelUsuario || premisa;
  let res = String(texto);
  for (const c of candidatos) {
    const ev = c.evidenciaPremisa || c.evidencia || evaluarEvidencia(c, userPremisa);
    if (ev.valida) continue;
    const nombre = String(c.title || c.titulo || '');
    if (!nombre || !res.includes(nombre)) continue;
    res = res.split(/(?<=[.!?\n])/).map(frase => {
      if (frase.includes(nombre) && AFIRMA_VERIFICADO.test(frase) && !ES_INFERENCIA.test(frase)) {
        return frase.replace(AFIRMA_GLOBAL, 'es solo una inferencia o hipótesis no comprobada en');
      }
      return frase;
    }).join('');
  }
  return res;
}

function marcarSinSinopsis(v) {
  if (Array.isArray(v)) return v.map(marcarSinSinopsis);
  if (!v || typeof v !== 'object') return v;
  if (/^Tu biblioteca/.test(String(v.fuente || ''))) return v;
  const hijos = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, marcarSinSinopsis(x)]));
  return esObra(v) && !String(v.synopsis ?? '').trim() ? { ...hijos, sinSinopsis: AVISO } : hijos;
}

module.exports = {
  marcarSinSinopsis,
  AVISO,
  NIVELES_EVIDENCIA,
  evaluarEvidencia,
  afirmacionesSinEvidencia,
  rechazarVerificacionSinEvidencia
};
