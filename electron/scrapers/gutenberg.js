const { obraDeEpub } = require('../epub-importar.js');
const { fichaDeOpds } = require('./gutenberg-opds.js');
const { GENERO } = require('../etiquetas.js');
const { exigirAlgoGuardado } = require('./guardado.js');

const TECHO = 60 * 1024 * 1024;

function numeroDeLibro(url) {
  const m = String(url || '').match(/gutenberg\.org\/(?:ebooks|cache\/epub|files)\/(\d+)/i);
  return m ? m[1] : null;
}

const direccionDe = (n) => `https://www.gutenberg.org/ebooks/${n}`;

function pedir(url, opciones) {
  const net = require('electron').net;
  return net?.fetch ? net.fetch(url, opciones) : fetch(url, opciones);
}

async function bajarEpub(url) {
  const r = await pedir(url, { signal: AbortSignal.timeout(120000), redirect: 'follow' });
  if (!r.ok) throw new Error(`Gutenberg respondió ${r.status} a ${url}`);
  const datos = Buffer.from(await r.arrayBuffer());
  if (datos.length > TECHO) throw new Error('Ese EPUB de Gutenberg pasa de 60 MB: no se baja.');
  return datos;
}

async function bajarLibro(url) {
  const primero = await bajarEpub(url);
  if (primero.subarray(0, 2).toString('latin1') === 'PK') return primero;
  const segundo = await bajarEpub(url);
  if (segundo.subarray(0, 2).toString('latin1') === 'PK') return segundo;
  throw new Error('Gutenberg no devolvió el EPUB del libro. Vuelve a intentarlo en un rato.');
}

async function ficha(n) {
  try {
    const r = await pedir(`${direccionDe(n)}.opds`, { signal: AbortSignal.timeout(30000), redirect: 'follow' });
    return r.ok ? fichaDeOpds(await r.text()) : null;
  } catch { return null; }
}

function esDeGutenberg(titulo, html) {
  const texto = String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const portadilla = /^the project gutenberg e-?book of/i.test(texto)
    && /\*\*\* ?start of (the|this) project gutenberg/i.test(texto) && texto.length < 6000;
  return portadilla
    || /project gutenberg.{0,4}license/i.test(titulo)
    || /^\*\*\* ?end of (the|this) project gutenberg/i.test(texto);
}

async function libro(n, datos) {
  const epub = datos?.epub || `${direccionDe(n)}.epub3.images`;
  const obra = await obraDeEpub(await bajarLibro(epub), `gutenberg-${n}.epub`);
  const quedan = obra.chapters.map((c, i) => i).filter(i => !esDeGutenberg(obra.chapters[i].title, obra.chapterContents[i]));
  if (!quedan.length) throw new Error('Ese libro de Gutenberg no trae ningún capítulo con texto.');
  return {
    ...obra,
    chapters: quedan.map((i, k) => ({ title: obra.chapters[i].title, url: `${direccionDe(n)}#capitulo-${k + 1}` })),
    chapterContents: quedan.map(i => obra.chapterContents[i])
  };
}

async function scrape(url, onProgress) {
  const n = numeroDeLibro(url);
  if (!n) throw new Error('Esa dirección de Gutenberg no dice qué libro es (falta /ebooks/<número>).');
  onProgress?.({ step: 'fetching', message: 'Leyendo la ficha en Gutenberg…' });
  const datos = await ficha(n);
  onProgress?.({ step: 'fetching', message: 'Bajando el libro entero…' });
  const obra = await libro(n, datos);
  return {
    ...obra,
    title: datos?.titulo || obra.title,
    author: datos?.autores?.length ? datos.autores.join(', ') : obra.author,
    synopsis: obra.synopsis || datos?.sinopsis || '',
    coverUrl: datos?.portada || '',
    language: obra.language || datos?.idioma || '',
    url: direccionDe(n),
    source: 'Project Gutenberg',
    tags: (datos?.materias || []).slice(0, 10).map(name => ({ name, category: GENERO })),
    completa: true,
    ...(datos?.descargas ? { kudos: datos.descargas } : {})
  };
}

async function downloadChapters(chapters, fanficId, onProgress, saveContentFn) {
  const n = numeroDeLibro(chapters[0]?.url);
  if (!n) throw new Error('Esos capítulos no dicen de qué libro de Gutenberg son.');
  const obra = await libro(n, await ficha(n));
  let guardados = 0;
  for (let i = 0; i < chapters.length; i++) {
    const k = Number(String(chapters[i].url).split('#capitulo-')[1]) - 1;
    const contenido = obra.chapterContents[k];
    if (!contenido) continue;
    if (await saveContentFn(fanficId, i, contenido) !== false) guardados++;
    onProgress?.({ step: 'downloading', message: `Capítulo ${i + 1} de ${chapters.length}` });
  }
  exigirAlgoGuardado(guardados, chapters.length, 'Gutenberg');
}

module.exports = { scrape, downloadChapters, numeroDeLibro, esDeGutenberg, pedir };
