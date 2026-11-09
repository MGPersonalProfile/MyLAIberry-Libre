const { claveDeObra } = require('./misma-obra');
const { evaluarEvidencia, normalizar, palabras, conceptosDe, describe, POCO_SIGNIFICATIVAS } = require('./asistente-premisa');

const AFIRMA_VERIFICADO = /\b(?:verificad[oa]s?|comprobad[oa]s?|confirmad[oa]s?|he(?:mos)?\s+(?:verificado|comprobado|confirmado)|(?:esta|estan)\s+(?:verificad|comprobad|confirmad)\w*|se\s+(?:comprueba|verifica|confirma))\b/;

const AFIRMA_CUMPLE = /cumple\s+(?:exactamente\s+|con\s+)?(?:la\s+)?premisa|ocurre\s+lo\s+que\s+(?:pedias|buscas|querias)|la\s+sinopsis\s+(?:cuenta|dice|explica|indica|narra)/;
const AFIRMA_TRAMA = /\btrata\s+de\b|\bcuenta\s+(?:la\s+historia|que)\b|\bva\s+de\b|\b(?:sigue|narra)\s+(?:a|la\s+historia)\b|\bis\s+about\b/;

const CON_CAUTELA = /\b(?:inferencia|inferir|inferid[oa]s?|deduccion|deducir|hipotesis|suposicion|posible|quizas?|tal vez|probablemente|sin\s+comprobar|no\s+(?:esta\s+)?comprobad[oa]s?)\b|\bno\s+(?:he\s+podido|puedo|pude|consta|tengo)\b|\b(?:no|tampoco)\s+(?:lo\s+)?(?:dice|detalla|explica|cuenta)\b|sin\s+sinopsis/;
const DEMOSTRATIVO = /\b(?:esta\s+obra|este\s+fic|esta\s+historia|la\s+historia|el\s+fic|la\s+obra|aqui|en\s+ella|la\s+sinopsis|lo\s+que\s+(?:pedias|buscas|querias))\b/;
const CONCEPTOS = ['vuelta', 'recuerdos'];

const tituloDe = (o) => String(o?.title ?? o?.titulo ?? '');
const autorDe = (o) => String((typeof o?.author === 'object' ? o.author?.name : o?.author) ?? o?.autor ?? '');
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function claveDe(o) {
  const id = o.id ?? o.idOrigen;
  if (o.url) return `u:${claveDeObra(o.url)}`;
  if (id) return `id:${normalizar(o.source ?? o.fuente ?? '')}:${id}`;
  return `t:${normalizar(tituloDe(o))}:${normalizar(autorDe(o))}`;
}
const pareceObra = (o) => !!o && typeof o === 'object' && !Array.isArray(o) && tituloDe(o).trim() && (typeof o.url === 'string' || o.id != null || o.idOrigen != null || o.synopsis !== undefined || Array.isArray(o.tags));

const mejor = (a, b) => ((b.estadoVerificacion === 'ficha_consultada') - (a.estadoVerificacion === 'ficha_consultada'))
  || (String(b.synopsis || '').length - String(a.synopsis || '').length) > 0 ? b : a;

function recorrer(v, alObra, vistos = new Set(), prof = 0) {
  if (!v || typeof v !== 'object' || vistos.has(v) || prof > 9) return;
  vistos.add(v);
  if (!Array.isArray(v) && pareceObra(v)) alObra(v);
  for (const x of Array.isArray(v) ? v : Object.values(v)) recorrer(x, alObra, vistos, prof + 1);
}

function obrasDeContexto(ctx) {
  const mapa = new Map();
  const poner = (o) => { const k = claveDe(o); mapa.set(k, mapa.has(k) ? mejor(mapa.get(k), o) : o); };
  recorrer(ctx?.vistas, poner);
  for (const m of ctx?.messages || []) {
    if (m.role !== 'tool' || typeof m.content !== 'string') continue;
    try { recorrer(JSON.parse(m.content), poner); } catch {  }
  }
  return [...mapa.values()];
}

function esReclamo(frase, premisa) {
  const n = normalizar(frase);
  if (/\?\s*$/.test(String(frase).trim()) || CON_CAUTELA.test(n)) return false;
  if (AFIRMA_VERIFICADO.test(n) || AFIRMA_CUMPLE.test(n) || CONCEPTOS.some(c => describe(c, n))) return true;
  const comunes = palabras(premisa).filter(w => !POCO_SIGNIFICATIVAS.test(w) && n.includes(w)).length;
  return AFIRMA_TRAMA.test(n) && comunes >= 2;
}

function objetivos(trozo, candidatos) {
  const n = normalizar(trozo);
  const porUrl = candidatos.filter(c => c.url && (trozo.includes(c.url) || trozo.includes(claveDeObra(c.url))));
  if (porUrl.length) return Object.assign(porUrl, { nombrado: true });
  const porNombre = candidatos.filter(c => tituloDe(c).trim() && n.includes(normalizar(tituloDe(c))));
  if (porNombre.length) { const porAutor = porNombre.filter(c => autorDe(c) && n.includes(normalizar(autorDe(c)))); return Object.assign(porAutor.length ? porAutor : porNombre, { nombrado: true }); }
  return DEMOSTRATIVO.test(n) || AFIRMA_VERIFICADO.test(n) || AFIRMA_CUMPLE.test(n) || AFIRMA_TRAMA.test(n) || CONCEPTOS.some(c => describe(c, n)) ? [...candidatos] : [];
}

function partir(frase, candidatos) {

  if (/\b(?:ambas|todas|las dos|los dos)\b/i.test(normalizar(frase))) return [frase];
  const puntos = [...new Set(candidatos.map(c => tituloDe(c).trim()).filter(Boolean))]
    .map(t => frase.search(new RegExp(escapar(t), 'i'))).filter(i => i >= 0).sort((a, b) => a - b);
  const cortes = [...new Set(puntos)].slice(1);
  if (!cortes.length) return [frase];
  return [frase.slice(0, cortes[0]), ...cortes.map((c, i) => frase.slice(c, cortes[i + 1]))];
}

const cortarEnFrases = (texto) => String(texto).split(/((?<=[.!?;])\s+|\n)/);

function revisarTrozos(texto, ctx) {
  const candidatos = obrasDeContexto(ctx);
  const premisa = ctx.textoDelUsuario || '';
  if (!candidatos.length) return cortarEnFrases(texto).map(trozo => ({ trozo, malas: [] }));
  return cortarEnFrases(texto).flatMap(frase => partir(frase, candidatos).map(trozo => {
    if (!trozo.trim() || !esReclamo(trozo, premisa)) return { trozo, malas: [] };
    const donde = objetivos(trozo, candidatos);
    return { trozo, objetivos: donde, malas: donde.filter(o => !evaluarEvidencia(o, premisa).valida) };
  }));
}

function afirmacionesSinEvidencia(texto, ctx = {}) {
  if (!texto) return [];
  const premisa = ctx.textoDelUsuario || '';
  const vistas = new Map();
  for (const { malas } of revisarTrozos(String(texto), ctx)) malas.forEach(o => vistas.set(claveDe(o), { obra: o, titulo: tituloDe(o), url: o.url, nivel: evaluarEvidencia(o, premisa).nivel }));
  return [...vistas.values()];
}

function limitada(obra) {
  const etiquetas = (obra.tags || []).map(t => String(t?.name ?? t)).filter(Boolean).slice(0, 3);
  const tiene = etiquetas.length ? `tiene las etiquetas ${etiquetas.join(', ')}` : 'no publica etiquetas';
  return String(obra.synopsis || '').trim()
    ? `«${tituloDe(obra)}» ${tiene}, pero su sinopsis no cuenta que cumpla lo que pides: es solo una inferencia, no comprobada.`
    : `«${tituloDe(obra)}» no tiene sinopsis publicada y ${tiene}: es solo una inferencia, no comprobada, y no puedo decir cómo es su trama.`;
}

function rechazarVerificacionSinEvidencia(texto, ctxOCandidatos = [], premisa = '') {
  if (!texto) return texto;
  const ctx = Array.isArray(ctxOCandidatos) ? { vistas: ctxOCandidatos, textoDelUsuario: premisa } : { ...(ctxOCandidatos || {}), textoDelUsuario: (ctxOCandidatos || {}).textoDelUsuario || premisa };
  const dichas = new Set();
  return revisarTrozos(String(texto), ctx).map(({ trozo, objetivos: donde = [], malas }) => {
    if (!malas.length) return trozo;

    if (donde.length !== 1 && !donde.nombrado) return '';
    const nuevas = malas.filter(o => !dichas.has(claveDe(o)));
    nuevas.forEach(o => dichas.add(claveDe(o)));
    return nuevas.length ? `${nuevas.map(limitada).join(' ')}${/\s$/.test(trozo) ? trozo.match(/\s+$/)[0] : ''}` : '';
  }).join('').replace(/\n{3,}/g, '\n\n').trim();
}

const AFIRMA_HISTORIA_CERTEZA = /\b(?:he|hemos)\s+(?:encontrado|localizado|hallado)\s+(?:tu|la)\s+(?:historia|obra)\b|\b(?:esta|este)\s+es\s+(?:la\s+obra|el\s+fic|la\s+historia)\s+que\s+(?:buscabas|quer[ií]as|ped[ií]as)\b|\bencontr[eé]\s+(?:tu|la)\s+(?:historia|obra)\b/i;

function rechazarCertezaSinConfirmacion(texto, ctx = {}) {
  if (!texto) return texto;
  const t = String(texto);
  if (!AFIRMA_HISTORIA_CERTEZA.test(t)) return t;

  const lista = ctx.historiasRecuperadas || ctx.vistas || [];
  const hayConfirmada = lista.some(o => o.estado === 'confirmado' || o.estadoVerificacion === 'confirmado' || o.estadoVerificacion === 'ficha_consultada');
  if (hayConfirmada) return t;

  return t
    .replace(/[¡!]?he(?:mos)?\s+encontrado\s+tu\s+historia[.!¡]?/gi, 'He encontrado candidatas que podrían coincidir, pero ninguna está confirmada todavía sin comprobación:')
    .replace(/(?:esta|este)\s+es\s+la\s+obra\s+que\s+buscabas:?/gi, 'candidata no confirmada que coincide con algunas pistas:')
    .replace(/\bencontr[eé]\s+tu\s+historia\b/gi, 'encontré posibles candidatas no confirmadas');
}

module.exports = {
  obrasDeContexto,
  afirmacionesSinEvidencia,
  rechazarVerificacionSinEvidencia,
  rechazarCertezaSinConfirmacion,
  AFIRMA_HISTORIA_CERTEZA,
  claveDe,
  esReclamo
};
