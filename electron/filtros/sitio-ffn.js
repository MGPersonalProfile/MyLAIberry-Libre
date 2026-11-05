const { GENEROS, normalizar, plan, cerrar, sinTildes } = require('./modelo.js');
const { resolverFandomFFN } = require('./fandoms.js');

const ORIGEN = 'https://www.fanfiction.net';
const ORDEN = { popularidad: 4, recientes: 1, publicadas: 2 };
const RATING = { general: 102, adolescente: 3, maduro: 4, explicito: 4 };
const MINIMOS = [[100000, 100], [60000, 60], [40000, 40], [20000, 20], [10000, 10], [5000, 5], [1000, 1]];
const IDIOMAS = { af: 45, id: 32, ms: 42, ca: 34, da: 19, de: 4, et: 41, en: 1, es: 2, eo: 22, tl: 21, fr: 3, hr: 33, it: 11,
  pl: 13, la: 35, hu: 14, nl: 7, no: 18, pt: 8, ro: 27, sk: 43, fi: 20, sv: 17, vi: 37, tr: 30, is: 40, cs: 31, el: 26,
  bg: 12, ru: 10, uk: 44, sr: 29, he: 15, ar: 16, fa: 25, hi: 23, pa: 24, th: 38, zh: 5, ja: 6, ko: 36 };

function longitud(f, p, params) {
  if (f.minPalabras) {
    const umbral = MINIMOS.find(([n]) => n <= f.minPalabras);
    if (umbral) {
      params.len = umbral[1];
      p.enWeb('minPalabras', `len=${umbral[1]} (más de ${umbral[0]} palabras)`);
      if (umbral[0] !== f.minPalabras) p.enMemoria('minPalabras');
    } else p.enMemoria('minPalabras');
  }
  if (f.maxPalabras) {
    if (!params.len && f.maxPalabras <= 5000) {
      params.len = f.maxPalabras <= 1000 ? 11 : 51;
      p.enWeb('maxPalabras', `len=${params.len} (menos de ${f.maxPalabras <= 1000 ? 1000 : 5000} palabras)`);
      if (![1000, 5000].includes(f.maxPalabras)) p.enMemoria('maxPalabras');
    } else p.enMemoria('maxPalabras');
  }
}

function generos(f, p, params) {
  const conId = (f.generos || []).filter(g => GENEROS[g]?.ffn);
  conId.slice(0, 2).forEach((g, i) => { params[`g${i + 1}`] = GENEROS[g].ffn; });
  if (conId.length) p.enWeb('generos', conId.slice(0, 2).map((g, i) => `g${i + 1}=${GENEROS[g].ffn} (${g})`).join(', '));
  if ((f.generos || []).length > Math.min(conId.length, 2)) p.enMemoria('generos');
  const fuera = (f.sinGeneros || []).filter(g => GENEROS[g]?.ffn);
  if (fuera.length) { params._g1 = GENEROS[fuera[0]].ffn; p.enWeb('sinGeneros', `_g1=${params._g1} (${fuera[0]})`); }
  if ((f.sinGeneros || []).length > (fuera.length ? 1 : 0)) p.enMemoria('sinGeneros');
}

function personajes(f, p, params, ids) {
  const nombres = [...(f.pareja ? f.pareja.split(/\s*[/&]\s*|\s+x\s+/i) : []), ...(f.personajes || [])].filter(Boolean);
  const resueltos = ids ? [...new Set(nombres.map(n => ids.get(n)).filter(Boolean))].slice(0, 4) : [];
  resueltos.forEach((id, i) => { params[`c${i + 1}`] = id; });
  const parejaEntera = f.pareja && ids && f.pareja.split(/\s*[/&]\s*|\s+x\s+/i).every(n => ids.get(n));
  if (parejaEntera) { params.pm = 1; p.enWeb('pareja', `c1=${params.c1}, c2=${params.c2} y pm=1 (pareja)`); }
  if (f.pareja) p.enMemoria('pareja');
  if (f.personajes) {
    if (f.personajes.every(n => ids?.get(n))) p.enWeb('personajes', resueltos.map((id, i) => `c${i + 1}=${id}`).join(', '));
    else p.enMemoria('personajes');
  }
}

function enSeccion(f, p, seccion, { idsPersonajes, pagina }) {
  const params = {};
  p.enWeb('fandom', `sección ${seccion.ruta} (${seccion.nombre})`);
  if (f.consulta) p.enMemoria('consulta');
  if (ORDEN[f.orden]) { params.srt = ORDEN[f.orden]; p.enWeb('orden', `srt=${params.srt} (${f.orden})`); } else if (f.orden) p.enMemoria('orden');
  generos(f, p, params);
  if (f.idioma) { if (IDIOMAS[f.idioma]) { params.lan = IDIOMAS[f.idioma]; p.enWeb('idioma', `lan=${params.lan}`); } else p.enMemoria('idioma'); }
  params.r = f.rating ? RATING[f.rating] : 10;
  if (f.rating) p.enWeb('rating', `r=${params.r}${f.rating === 'explicito' ? ' (M: FanFiction.net no separa lo explícito)' : ''}`);
  longitud(f, p, params);
  if (f.estado) { params.s = f.estado === 'completa' ? 2 : 1; p.enWeb('estado', `s=${params.s}`); }
  personajes(f, p, params, idsPersonajes);
  if (f.minCapitulos) p.enMemoria('minCapitulos');
  if (f.sinCrossovers) p.enWeb('sinCrossovers', 'la sección de un fandom no lleva crossovers');
  if (pagina > 1) params.p = pagina;
  const cadena = Object.entries(params).map(([k, v]) => `&${k}=${v}`).join('');
  p.url = `${ORIGEN}${seccion.ruta}${cadena ? `?${cadena}` : ''}`;
}

function enBuscador(f, p, { pagina }) {
  const palabras = [f.consulta, f.fandom].filter(Boolean).join(' ');
  if (!palabras) return;
  const q = new URLSearchParams({ keywords: palabras, ready: '1', type: 'story' });
  if (pagina > 1) q.set('ppage', String(pagina));
  p.url = `${ORIGEN}/search/?${q}`;
  if (f.consulta) p.enWeb('consulta', `keywords=${f.consulta}`);
  if (f.fandom) { p.enWeb('fandom', 'en las palabras clave (no hay sección con ese nombre)'); p.enMemoria('fandom'); }
  for (const c of ['orden', 'minPalabras', 'maxPalabras', 'minCapitulos', 'generos', 'sinGeneros', 'rating', 'idioma', 'estado', 'pareja', 'personajes', 'sinCrossovers']) {
    if (f[c] !== undefined) p.enMemoria(c);
  }
}

function traducirFFN(pedido, { idsPersonajes, pagina = 1 } = {}) {
  const f = normalizar(pedido);
  const p = plan('FanFiction.net');
  const seccion = f.fandom ? resolverFandomFFN(f.fandom) : null;
  if (seccion) enSeccion(f, p, seccion, { idsPersonajes, pagina });
  else enBuscador(f, p, { pagina });
  return { ...cerrar(p), ...(seccion ? { seccion } : {}) };
}

function idsDePersonajes(opciones, nombres) {
  const trozos = (s) => sinTildes(s).replace(/\./g, ' ').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const filas = (opciones || []).map(o => {
    const [id, ...resto] = String(o).split('=');
    return { id: Number(id), t: trozos(resto.join('=')) };
  }).filter(o => o.id > 0 && o.t.length);
  const casa = (o, q) => o.t.join(' ') === q.join(' ')
    || (o.t[0] === q[0] && (o.t.length === 1 || !q[1] || q[1].startsWith(o.t[1])) && o.t.length <= 2);
  const ids = new Map();
  for (const n of nombres || []) {
    const q = trozos(n);
    const exacta = filas.find(o => o.t.join(' ') === q.join(' '));
    const fila = exacta || filas.find(o => casa(o, q));
    if (fila) ids.set(n, fila.id);
  }
  return ids;
}

module.exports = { traducirFFN, idsDePersonajes, IDIOMAS, ORIGEN };
