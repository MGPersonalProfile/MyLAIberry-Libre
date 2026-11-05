const { GENEROS, normalizar, sinTildes } = require('./modelo.js');
const { esCrossover } = require('../asistente-busqueda.js');

const trozos = (s) => sinTildes(s).replace(/\./g, ' ').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const etiquetas = (o, ...cats) => (o.tags || []).filter(t => !cats.length || cats.includes(t.category || '')).map(t => String(t.name || t));

function mismoNombre(etiqueta, pedido) {
  const h = trozos(etiqueta), q = trozos(pedido);
  if (!h.length || !q.length || h[0] !== q[0]) return false;
  for (let i = 1; i < Math.min(h.length, q.length); i++) if (!h[i].startsWith(q[i]) && !q[i].startsWith(h[i])) return false;
  return true;
}

const partes = (s) => String(s || '').split(/\s*[/&]\s*|\s+x\s+/i).map(x => x.trim()).filter(Boolean);

function parejaCasa(etiqueta, pedida) {
  const { casaPareja } = require('../asistente-investigar-web.js');
  if (casaPareja(etiqueta, pedida)) return true;
  const quiero = partes(pedida), hay = partes(etiqueta);
  if (quiero.length < 2) return false;
  if (/&/.test(etiqueta) !== /&/.test(pedida) && /\//.test(etiqueta) !== /\//.test(pedida)) return false;
  return quiero.every(q => hay.some(h => mismoNombre(h, q)));
}

const nombresDeGenero = (g) => (GENEROS[g] ? [g, GENEROS[g].ao3, GENEROS[g].rr, ...GENEROS[g].alias] : [g]).filter(Boolean).map(n => trozos(n).join(' '));
const tieneGenero = (o, g) => etiquetas(o, 'genre', 'freeform').some(t => nombresDeGenero(g).includes(trozos(t).join(' ')));

function nivel(t) {
  const n = sinTildes(t);
  if (/explicit/.test(n)) return 'explicito';
  if (/\bm\b|mature|\bma\b/.test(n.replace(/^rated\s+/, ''))) return 'maduro';
  if (/\bt\b|teen/.test(n.replace(/^rated\s+/, ''))) return 'adolescente';
  if (/\bk\+?|general/.test(n.replace(/^rated\s+/, ''))) return 'general';
  return null;
}

function nombresDeIdioma(codigo) {
  const en = new Intl.DisplayNames(['en'], { type: 'language' }).of(codigo);
  const propio = new Intl.DisplayNames([codigo], { type: 'language' }).of(codigo);
  return [codigo, en, propio].map(n => sinTildes(n));
}

const COMPROBAR = {

  consulta: (o, f) => require('../relevancia.js').pertinencia(o, f.consulta) >= 2 / 3,
  fandom: (o, f) => { const fs = etiquetas(o, 'fandom'); return fs.length ? fs.some(x => { const a = trozos(x).join(' '), b = trozos(f.fandom).join(' '); return a.includes(b) || b.includes(a); }) : null; },
  minPalabras: (o, f) => (o.wordCount ? o.wordCount >= f.minPalabras : null),
  maxPalabras: (o, f) => (o.wordCount ? o.wordCount <= f.maxPalabras : null),
  minCapitulos: (o, f) => (o.totalChapters ? o.totalChapters >= f.minCapitulos : null),
  generos: (o, f) => (etiquetas(o, 'genre', 'freeform').length ? f.generos.every(g => tieneGenero(o, g)) : null),
  sinGeneros: (o, f) => (etiquetas(o, 'genre', 'freeform').length ? !f.sinGeneros.some(g => tieneGenero(o, g)) : null),
  rating: (o, f) => { const n = etiquetas(o, 'rating').map(nivel).filter(Boolean)[0]; return n ? n === f.rating || (f.rating === 'explicito' && n === 'maduro' && o.source === 'FanFiction.net') : null; },
  idioma: (o, f) => { const ls = [...etiquetas(o, 'language'), o.language].filter(Boolean).map(sinTildes); return ls.length ? ls.some(l => nombresDeIdioma(f.idioma).includes(l)) : null; },
  estado: (o, f) => (typeof o.completa === 'boolean' ? o.completa === (f.estado === 'completa') : null),
  pareja: (o, f) => etiquetas(o, 'relationship').some(t => parejaCasa(t, f.pareja)),
  personajes: (o, f) => { const ps = etiquetas(o, 'character', 'relationship').flatMap(partes); return ps.length ? f.personajes.every(q => ps.some(h => mismoNombre(h, q))) : null; },
  sinCrossovers: (o) => !esCrossover(o)
};

function ordenar(obras, f) {
  const criterio = {
    popularidad: (a, b) => (b.kudos || 0) - (a.kudos || 0),
    palabras: (a, b) => (b.wordCount || 0) - (a.wordCount || 0),
    relevancia: (a, b) => Number(COMPROBAR.consulta(b, f)) - Number(COMPROBAR.consulta(a, f))
  }[f.orden];
  return criterio && (f.orden !== 'relevancia' || f.consulta) ? [...obras].sort(criterio) : obras;
}

function aplicarEnMemoria(obras, pedido, campos = []) {
  const f = normalizar(pedido);
  const comprobar = campos.filter(c => c !== 'orden' && COMPROBAR[c] && f[c] !== undefined);
  const salen = [];
  for (const o of obras || []) {
    const veredictos = comprobar.map(c => [c, COMPROBAR[c](o, f)]);
    if (veredictos.some(([, v]) => v === false)) continue;
    const dudas = veredictos.filter(([, v]) => v === null).map(([c]) => c);
    salen.push(dudas.length ? { ...o, sinComprobar: dudas } : o);
  }
  return campos.includes('orden') ? ordenar(salen, f) : salen;
}

module.exports = { aplicarEnMemoria, mismoNombre, parejaCasa, COMPROBAR };
