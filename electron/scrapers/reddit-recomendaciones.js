const { enlacesDe } = require('./reddit');

const PATRON_AUTOR = /\b(?:by|autor:?|escrito por)\s+([A-Za-z0-9_' -]{2,40})/i;
const PATRON_ESPECULATIVO = /\b(?:maybe|not sure|could be|creo que|quiz[aá]s?|tal vez|possibly|might be|i think)\b/i;
const PATRON_CORRECCION = /\b(?:no es|actually,? (?:it'?s|that wasn'?t)|en realidad|correcci[oó]n|is not|rather than)\b/i;

const norm = s => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

function clasificarMencion(texto, tieneEnlace, esParcial = false) {
  if (PATRON_CORRECCION.test(texto)) return 'correccion';
  if (esParcial || /\btitle had\b|\bt[ií]tulo ten[ií]a\b|\bt[ií]tulo incompleto\b|\bhad\s+['"][^'"]+['"]\s+or\b/i.test(texto)) {
    return 'mencion_ambigua';
  }
  if (PATRON_ESPECULATIVO.test(texto)) return 'especulativa';
  if (tieneEnlace) return 'mencionada_con_enlace';
  return 'mencion_ambigua';
}

function autorDeEnlace(texto, e) {
  const pos = texto.indexOf(e.url) >= 0 ? texto.indexOf(e.url) : texto.indexOf(e.titulo);
  if (pos >= 0) {
    const sub = texto.slice(pos, pos + 250);
    const m = sub.match(/(?:\]\([^\)]+\)|[^\n]+?)\s+(?:by|autor:?|escrito por)\s+([A-Za-z0-9_' -]{2,40})/i)
      || sub.match(/\b(?:by|autor:?|escrito por)\s+([A-Za-z0-9_' -]{2,40})/i);
    if (m) return m[1].replace(/[.,;].*$/, '').trim();
  }
  const mGen = texto.match(PATRON_AUTOR);
  return mGen ? mGen[1].replace(/[.,;].*$/, '').trim() : null;
}

function parsearConEnlaces(texto, metadata) {
  const tipoMencion = clasificarMencion(texto, true);
  return enlacesDe(texto).map(e => ({
    comunidad: metadata.subreddit || '',
    tituloHilo: metadata.title || '',
    urlOriginal: metadata.url || '',
    urlObra: e.url,
    textoRelevante: texto.slice(0, 500),
    obraMencionada: e.titulo || e.url,
    autorMencionado: autorDeEnlace(texto, e),
    fecha: metadata.fecha,
    metricas: metadata.puntos !== undefined ? { puntos: metadata.puntos, numComentarios: metadata.numComentarios } : undefined,
    tipoMencion,
    estadoIdentificacion: (metadata.fichaConsultada || metadata.identificadorVerificado) ? 'confirmado' : 'candidato'
  }));
}

function parsearLineaIndividual(l, metadata) {
  const correc = PATRON_CORRECCION.test(l);
  let obra = null;
  let autor = null;

  if (correc) {
    const m = l.match(/(?:es|is)\s+([A-Z][A-Za-z0-9' ]{2,40}?)(?:\s+(?:de|by|autor:?|escrito por)\s+([A-Za-z0-9_ -]+)|$|[.,])/i);
    if (m) { obra = m[1].trim(); autor = m[2]?.trim() || null; }
  } else {
    const mc = l.match(/["'«]([^"'»]{3,60})["'»]/);
    if (mc) obra = mc[1].trim();
    else {
      const mt = l.match(/(?:fic|story|historia|obra|called|llamada|named)\s+([A-Z][A-Za-z0-9' ]{2,40})/i);
      if (mt) obra = mt[1].trim();
    }
  }
  if (!obra) return null;
  const autorMatch = autor || (l.match(PATRON_AUTOR) || [])[1];
  const tipoMencion = clasificarMencion(l, false);
  return {
    comunidad: metadata.subreddit || '',
    tituloHilo: metadata.title || '',
    urlOriginal: metadata.url || '',
    urlObra: '',
    textoRelevante: l.slice(0, 500),
    obraMencionada: obra,
    autorMencionado: autorMatch ? autorMatch.trim() : null,
    fecha: metadata.fecha,
    metricas: metadata.puntos !== undefined ? { puntos: metadata.puntos, numComentarios: metadata.numComentarios } : undefined,
    tipoMencion,
    estadoIdentificacion: 'candidato',
    refutada: correc
  };
}

function parsearObrasDeTexto(texto, metadata = {}) {
  const conEnlaces = parsearConEnlaces(texto, metadata);
  const lineas = texto.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const sinEnlaces = lineas.map(l => parsearLineaIndividual(l, metadata)).filter(Boolean);

  const todas = [...conEnlaces];
  for (const s of sinEnlaces) {
    if (!todas.some(t => norm(t.obraMencionada) === norm(s.obraMencionada))) {
      todas.push(s);
    }
  }

  if (!todas.length && texto.trim()) {
    const tipoMencion = clasificarMencion(texto, false);
    todas.push({
      comunidad: metadata.subreddit || '',
      tituloHilo: metadata.title || '',
      urlOriginal: metadata.url || '',
      urlObra: '',
      textoRelevante: texto.slice(0, 500),
      obraMencionada: 'Mención no identificada',
      autorMencionado: null,
      tipoMencion,
      estadoIdentificacion: 'candidato'
    });
  }
  return todas;
}

function extraerRecomendacionesReddit(entrada = {}) {
  if (entrada.errorHttp === 429) {
    return { recomendaciones: [], estado: 'limitado', codigoHttp: 429, mensaje: 'Reddit está limitando las peticiones (HTTP 429).' };
  }
  if (entrada.sinSesion) {
    return { recomendaciones: [], estado: 'sin_sesion', mensaje: 'Sesión no disponible para consultar Reddit.' };
  }
  if (entrada.errorHttp === 403) {
    return { recomendaciones: [], estado: 'bloqueado', codigoHttp: 403, mensaje: 'Reddit bloqueó la petición (HTTP 403).' };
  }

  const metadata = {
    subreddit: entrada.subreddit,
    title: entrada.title,
    url: entrada.permalink ? `https://www.reddit.com${entrada.permalink}` : entrada.url,
    puntos: entrada.score,
    numComentarios: entrada.num_comments,
    fecha: entrada.created_utc ? new Date(entrada.created_utc * 1000).toISOString().slice(0, 10) : undefined,
    fichaConsultada: entrada.fichaConsultada === true,
    identificadorVerificado: entrada.identificadorVerificado === true
  };

  const texto = entrada.selftext || entrada.body || entrada.texto || '';
  const recomendaciones = parsearObrasDeTexto(texto, metadata);
  return {
    recomendaciones,
    estado: 'ok'
  };
}

module.exports = {
  extraerRecomendacionesReddit,
  clasificarMencion,
  parsearObrasDeTexto
};
