const { JSDOM } = require('jsdom');
const { exigirQueNoSeaUnReto } = require('./navegar.js');
const { pedirComic } = require('./comic-red.js');
const { urlHttp, datosComic, tituloCapitulo, descargadorComic } = require('./comic.js');

const origen = 'https://flamecomics.xyz';
const cdn = 'https://cdn.flamecomics.xyz/uploads/images/series';
const fuente = 'flame';
const nombre = 'Flame Comics';

function rutaDe(url) {
  const u = urlHttp(url);
  if (!u || !/^(?:www\.)?flamecomics\.(?:xyz|com)$/.test(u.hostname)) return null;
  return u.pathname.match(/^\/series\/(\d+)(?:\/([\da-f]+))?\/?$/i);
}

const idDeObra = url => rutaDe(url)?.[1];
const esUrlDeFlame = url => !!rutaDe(url);
const serieDe = url => `${origen}/series/${idDeObra(url)}`;

async function datosDePagina(url) {
  const html = await pedirComic(url, r => r.text());
  const doc = new JSDOM(html).window.document;
  const script = doc.getElementById('__NEXT_DATA__');
  if (script) return JSON.parse(script.textContent).props.pageProps;
  exigirQueNoSeaUnReto(nombre, { titulo: doc.title, texto: doc.body?.textContent, documento: doc, url });
  throw new Error(`${nombre} · __NEXT_DATA__`);
}

function episodiosDe(url, capitulos, idioma) {
  return capitulos.flatMap(c => {
    if (!/^[\da-f]+$/i.test(c.token) || c.hidden || c.draft) return [];
    const numero = String(c.chapter ?? '').replace(/\.(\d*?)0+$/, (_, decimales) => decimales ? `.${decimales}` : '');
    const title = c.title?.trim() || tituloCapitulo(numero, idioma);
    return [{ title, url: `${url}/${c.token}`, episodeNo: c.token, numero, idioma }];
  }).sort((a, b) => Number(a.numero) - Number(b.numero));
}

async function obtenerEpisodios(url, _onProgress, opciones) {
  if (!esUrlDeFlame(url)) throw new Error(nombre);
  const canon = serieDe(url);
  const { series, chapters } = await datosDePagina(canon);
  const idioma = { English: 'en', Spanish: 'es' }[series.language] || series.language || '';
  return datosComic({
    source: nombre, url: canon, title: series.title, author: (series.author || []).join(', '),
    language: idioma, synopsis: JSDOM.fragment(series.description || '').textContent,
    coverUrl: series.cover ? `${cdn}/${idDeObra(canon)}/${encodeURIComponent(series.cover)}` : ''
  }, episodiosDe(canon, chapters, idioma), opciones);
}

async function obtenerVinhetas(ch) {
  const [, id, token] = rutaDe(ch.url) || [];
  if (!token) throw new Error(nombre);
  const { chapter } = await datosDePagina(`${origen}/series/${id}/${token}`);
  return Object.values(chapter.images || {}).map(({ name, width, height }) => {
    if (typeof name !== 'string' || !name || name === '.' || name === '..') throw new Error(nombre);
    return { url: `${cdn}/${id}/${token}/${encodeURIComponent(name)}`, ancho: Number(width), alto: Number(height) };
  });
}

const downloadChapters = descargadorComic({ fuente, obtenerVinhetas, idDeObra });
module.exports = { esUrlDeFlame, obtenerEpisodios, scrape: obtenerEpisodios, obtenerVinhetas, downloadChapters };
