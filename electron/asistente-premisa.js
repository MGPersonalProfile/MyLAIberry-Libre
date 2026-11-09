const NIVELES_EVIDENCIA = {
  SINOPSIS: 'sinopsis publicada',
  FICHA: 'ficha consultada',
  INFERIDA: 'inferida de etiquetas o título',
  NO_COMPROBADA: 'no comprobada'
};

const normalizar = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const palabras = (s) => normalizar(s).split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 2);
const POCO_SIGNIFICATIVAS = /^(?:para|como|este|esta|estos|estas|donde|cuando|sobre|desde|hacia|pero|algo|obra|fanfic|fic|quiero|busco|que|con|una|uno|sus|del|las|los|por|the|and|story|historia|protagonista)$/;

const EN_LA_PREMISA = {
  vuelta: (p) => /\b(?:vuelv\w*|volv\w*|regres\w*|retroced\w*|retorn\w*|viaj\w*|travel\w*|return\w*|go(?:es)? back|time travel)\b/.test(p) && /\b(?:atras|pasado|tiempo|anos|back|past|ago|years)\b/.test(p),
  recuerdos: (p) => /\b(?:recuerdos?|memorias?|memories|memory)\b/.test(p)
};
const EN_LA_SINOPSIS = {
  vuelta: /\b(?:vuelv\w*|volver|regres\w*|retroced\w*|retorn\w*|viaj\w*|despiert\w*|wakes?|returns?|goes?|go|went|travel\w*|sent|thrown|transported)\b[^.!?]{0,50}\b(?:al pasado|atras|en el tiempo|back in time|to the past|years ago|years earlier|back to)\b|\b(?:regreso|vuelta|retorno|viaje)\b[^.!?]{0,40}\b(?:al pasado|atras|en el tiempo)\b|\btime[- ]travel\w*\b/,
  recuerdos: /\b(?:conserv\w*|mantien\w*|mantener\w*|retien\w*|retain\w*|keep\w*|kept|remember\w*|recuerd\w*|recall\w*)\b[^.!?]{0,50}\b(?:recuerdos|memorias|memories|memory)\b|\b(?:recuerdos|memorias|memories)\b[^.!?]{0,40}\b(?:intactos|de su vida anterior|of (?:his|her|their) (?:past|previous|former) lives?)\b|\bwith\s+(?:his|her|their)\s+memories\b|\bcon\s+(?:sus|todos sus)\s+recuerdos\b/
};

const ETIQUETA_SUGIERE = {
  vuelta: /time travel|viaje en el tiempo|second chance|regression|rebirth|reincarnation|time loop|do-?over|reset|fix-?it|segunda oportunidad/i,
  recuerdos: /memor|amnesia|retain/i
};

const INSTRUCCION = /\b(?:asistente|assistant|ignora\w*|ignore|declara\w*|declare|instrucciones|instructions|system prompt|verificad[oa]s?|comprobad[oa]s?|confirmad[oa]s?|verified|confirmed|premisa)\b/;

const frases = (texto) => String(texto || '').split(/(?<=[.!?])\s+|\n+/).map(f => f.trim()).filter(Boolean);

const conceptosDe = (premisa) => { const p = normalizar(premisa); return Object.keys(EN_LA_PREMISA).filter(k => EN_LA_PREMISA[k](p)); };

const describe = (concepto, texto) => EN_LA_SINOPSIS[concepto].test(normalizar(texto));

function literal(premisa, sinopsis) {
  const p = palabras(premisa).filter(w => !POCO_SIGNIFICATIVAS.test(w));
  const s = ` ${palabras(sinopsis).join(' ')} `;
  for (let largo = Math.min(p.length, 6); largo >= 4; largo--) {
    for (let i = 0; i + largo <= p.length; i++) if (s.includes(` ${p.slice(i, i + largo).join(' ')} `)) return true;
  }
  return false;
}

function respaldoDeSinopsis(sinopsis, premisa) {
  const utiles = frases(sinopsis).filter(f => !INSTRUCCION.test(normalizar(f)));
  const conceptos = conceptosDe(premisa);
  if (!conceptos.length) return literal(premisa, utiles.join(' ')) ? { fragmento: utiles.join(' ').slice(0, 240) } : null;
  for (let i = 0; i < utiles.length; i++) {
    const trozo = [utiles[i], utiles[i + 1]].filter(Boolean).join(' ');
    if (conceptos.every(c => describe(c, trozo))) return { fragmento: trozo.slice(0, 240) };
  }
  return null;
}

function sugerencia(tags, titulo, premisa) {
  const conceptos = conceptosDe(premisa);
  const etiqueta = tags.find(t => conceptos.some(c => ETIQUETA_SUGIERE[c].test(t)) || palabras(premisa).some(w => w.length > 4 && normalizar(t).includes(w)));
  if (etiqueta) return `Etiqueta: ${etiqueta}`;
  const enTitulo = palabras(premisa).some(w => w.length > 4 && !POCO_SIGNIFICATIVAS.test(w) && normalizar(titulo).includes(w));
  return enTitulo ? `Título: ${titulo}` : null;
}

function evaluarEvidencia(obra, premisa = '') {
  const url = obra?.url || '';
  const base = { url, obra: String(obra?.title || obra?.titulo || ''), premisa: String(premisa || '') };
  if (!obra || typeof obra !== 'object') return { ...base, nivel: NIVELES_EVIDENCIA.NO_COMPROBADA, evidencia: null, fragmento: null, fuente: null, resultado: 'no_comprobada', valida: false };
  const sinopsis = String(obra.synopsis || '').trim();
  const tags = (obra.tags || []).map(t => String(t?.name || t)).filter(Boolean);
  if (!normalizar(premisa).trim()) {

    if (obra.estadoVerificacion === 'ficha_consultada') return { ...base, nivel: NIVELES_EVIDENCIA.FICHA, evidencia: 'Ficha consultada', fragmento: null, fuente: 'ficha', resultado: 'datos_de_la_ficha', ambito: 'datos_de_la_ficha', valida: true };
    if (sinopsis) return { ...base, nivel: NIVELES_EVIDENCIA.SINOPSIS, evidencia: sinopsis.slice(0, 150), fragmento: sinopsis.slice(0, 150), fuente: 'sinopsis', resultado: 'sinopsis_publicada', valida: true };
    return { ...base, nivel: NIVELES_EVIDENCIA.NO_COMPROBADA, evidencia: null, fragmento: null, fuente: null, resultado: 'no_comprobada', valida: false };
  }
  const respaldo = respaldoDeSinopsis(sinopsis, premisa);
  if (respaldo) return { ...base, nivel: NIVELES_EVIDENCIA.SINOPSIS, evidencia: respaldo.fragmento, fragmento: respaldo.fragmento, fuente: 'sinopsis', resultado: 'comprobada', valida: true };
  const inferida = sugerencia(tags, base.obra, premisa);
  if (inferida) return { ...base, nivel: NIVELES_EVIDENCIA.INFERIDA, evidencia: inferida, fragmento: null, fuente: 'etiquetas', resultado: 'inferida', valida: false };
  return { ...base, nivel: NIVELES_EVIDENCIA.NO_COMPROBADA, evidencia: null, fragmento: null, fuente: null, resultado: 'no_comprobada', valida: false };
}

module.exports = { evaluarEvidencia, NIVELES_EVIDENCIA, normalizar, palabras, frases, conceptosDe, describe, POCO_SIGNIFICATIVAS };
