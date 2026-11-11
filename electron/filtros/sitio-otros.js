const { GENEROS, normalizar, plan, cerrar } = require('./modelo.js');

const PALABRAS_POR_PAGINA = 275;
const ORDEN_RR = { popularidad: 'followers', recientes: 'last_update', publicadas: 'release_date', palabras: 'length', relevancia: 'relevance' };

function generosRR(f, p, q) {
  const dentro = (f.generos || []).map(g => GENEROS[g]?.rr).filter(Boolean);
  const fuera = (f.sinGeneros || []).map(g => GENEROS[g]?.rr).filter(Boolean);
  dentro.forEach(t => q.append('tagsAdd', t));
  fuera.forEach(t => q.append('tagsRemove', t));
  if (dentro.length) p.enWeb('generos', `tagsAdd=${dentro.join(',')}`);
  if (fuera.length) p.enWeb('sinGeneros', `tagsRemove=${fuera.join(',')}`);
  if ((f.generos || []).length > dentro.length) p.enMemoria('generos');
  if ((f.sinGeneros || []).length > fuera.length) p.enMemoria('sinGeneros');
}

function paginasRR(f, p, q) {
  if (f.minPalabras) {
    q.set('minPages', String(Math.floor(f.minPalabras / PALABRAS_POR_PAGINA)));
    p.enWeb('minPalabras', `minPages=${q.get('minPages')} (${PALABRAS_POR_PAGINA} palabras por página)`);
    p.enMemoria('minPalabras');
  }
  if (f.maxPalabras) {
    q.set('maxPages', String(Math.ceil(f.maxPalabras / PALABRAS_POR_PAGINA)));
    p.enWeb('maxPalabras', `maxPages=${q.get('maxPages')} (${PALABRAS_POR_PAGINA} palabras por página)`);
    p.enMemoria('maxPalabras');
  }
}

function traducirRoyalRoad(pedido, { pagina = 1 } = {}) {
  const f = normalizar(pedido);
  const p = plan('RoyalRoad');
  const q = new URLSearchParams();
  if (f.consulta) { q.set('title', f.consulta); p.enWeb('consulta', `title=${f.consulta}`); }
  if (f.fandom) {
    q.set('keyword', f.fandom); q.set('type', 'FANFICTION');
    p.enWeb('fandom', `type=FANFICTION y keyword=${f.fandom}`); p.enMemoria('fandom');
  }
  generosRR(f, p, q);
  if (f.estado) { q.set('status', f.estado === 'completa' ? 'COMPLETED' : 'ONGOING'); p.enWeb('estado', `status=${q.get('status')}`); }
  paginasRR(f, p, q);
  q.set('orderBy', ORDEN_RR[f.orden] || 'relevance');
  if (f.orden) p.enWeb('orden', `orderBy=${ORDEN_RR[f.orden]}`);
  for (const c of ['minCapitulos', 'rating', 'idioma', 'pareja', 'personajes', 'sinCrossovers']) if (f[c] !== undefined) p.enMemoria(c);
  if (pagina > 1) q.set('page', String(pagina));
  p.url = `https://www.royalroad.com/fictions/search?${q}`;
  return cerrar(p);
}

const DE_TEXTO = {
  Wattpad: { url: (t) => `https://www.wattpad.com/search/stories?query=${encodeURIComponent(t)}`, campo: 'query', pertinente: true },
  Webnovel: { url: (t, pagina) => `https://www.webnovel.com/search?${new URLSearchParams({ keywords: t, ...(pagina > 1 ? { pageIndex: String(pagina) } : {}) })}`, campo: 'keywords' },
  'Project Gutenberg': { url: (t) => `https://www.gutenberg.org/ebooks/search.opds/?${new URLSearchParams({ query: t })}`, campo: 'query' },
  WeTriedTLs: {
    url: (t, pagina, f) => `https://api.wetriedtls.com/query?${new URLSearchParams({ query_string: t, series_type: 'Novel', orderBy: f.orden === 'recientes' ? 'latest' : 'total_views', order: 'desc', perPage: '20', page: String(pagina) })}`,
    campo: 'query_string', orden: { popularidad: 'orderBy=total_views', recientes: 'orderBy=latest' }
  }
};

function traducirDeTexto(fuente, pedido, { pagina = 1 } = {}) {
  const f = normalizar(pedido);
  const p = plan(fuente);
  const sitio = DE_TEXTO[fuente];
  const texto = [f.consulta, f.fandom].filter(Boolean).join(' ');
  if (texto) p.url = sitio.url(texto, pagina, f);
  if (f.consulta) p.enWeb('consulta', sitio.campo);

  if (f.consulta && sitio.pertinente) p.enMemoria('consulta');
  if (f.fandom) { p.enWeb('fandom', `en ${sitio.campo}, junto a la consulta`); p.enMemoria('fandom'); }
  if (f.orden && sitio.orden?.[f.orden]) p.enWeb('orden', sitio.orden[f.orden]);
  else if (f.orden && ['popularidad', 'palabras'].includes(f.orden)) p.enMemoria('orden');
  else if (f.orden) p.sinPoder('orden');
  for (const c of ['minPalabras', 'maxPalabras', 'minCapitulos', 'generos', 'sinGeneros', 'rating', 'idioma', 'estado', 'pareja', 'personajes', 'sinCrossovers']) {
    if (f[c] !== undefined) p.enMemoria(c);
  }
  return cerrar(p);
}

module.exports = { traducirRoyalRoad, traducirDeTexto, DE_TEXTO, PALABRAS_POR_PAGINA };
