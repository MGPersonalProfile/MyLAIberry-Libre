const { JSDOM } = require('jsdom');
const { exigirQueNoSeaUnReto } = require('./navegar.js');
const navegador = require('./comic-navegador.js');
const { urlHttp, datosComic, descargadorComic } = require('./comic.js');

const origen = 'https://asurascans.com';
const fuente = 'asura';
const nombre = 'Asura Scans';
const DOMINIO_ASURA = /(^|\.)asurascans\.com$/;

function rutaDe(url) {
  const u = urlHttp(url);
  if (!u || !/^(?:www\.)?asurascans\.com$/.test(u.hostname)) return null;
  return u.pathname.match(/^\/comics\/([a-z0-9][a-z0-9-]*)(?:\/chapter\/(\d+(?:\.\d+)?))?\/?$/i);
}

const esUrlDeAsura = url => !!rutaDe(url);
const idDeObra = url => rutaDe(url)?.[1];

async function leerPagina(url, esperar, { serie = false } = {}) {
  const html = await navegador.paginaRenderizada(url, { esperar });
  const doc = new JSDOM(html).window.document;

  if (!doc.querySelector(esperar) && !(serie && doc.querySelector('script[type="application/ld+json"]'))) {
    exigirQueNoSeaUnReto(nombre, { titulo: doc.title, texto: doc.body?.textContent, documento: doc, url });
  }
  return doc;
}

function datosDeSerie(doc) {
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const json = JSON.parse(s.textContent);
      if (json['@type'] === 'ComicSeries') return json;
    } catch {  }
  }
  return {};
}

function portadaDe(image) {
  const bruta = Array.isArray(image) ? image[0] : image;
  const u = urlHttp(typeof bruta === 'string' ? bruta : bruta?.url);
  return u && u.protocol === 'https:' && DOMINIO_ASURA.test(u.hostname) ? u.href : '';
}

const MARCA_DE_PAGO = /(^|[^a-z])(lock(ed)?|padlock|early[- ]?access|premium|asura\+|asura[- ]?plus)([^a-z]|$)/i;
function esDePago(a) {
  const atributos = e => ['class', 'aria-label', 'data-icon', 'data-lucide', 'title'].map(n => e.getAttribute?.(n) || '').join(' ');
  if ([a, ...a.querySelectorAll('*')].some(e => MARCA_DE_PAGO.test(atributos(e)))) return true;
  const copia = a.cloneNode(true);
  copia.querySelectorAll('span.truncate').forEach(e => e.remove());
  return MARCA_DE_PAGO.test(copia.textContent);
}

const numeroLimpio = n => n.replace(/\.(\d*?)0+$/, (_, d) => d ? `.${d}` : '');

function episodiosDe(doc, canon) {
  const slug = idDeObra(canon);
  const vistos = new Map();
  for (const a of doc.querySelectorAll('a[href*="/chapter/"]')) {
    let ruta;
    try { ruta = rutaDe(new URL(a.getAttribute('href'), canon).href); } catch { continue; }
    if (!ruta?.[2] || ruta[1] !== slug) continue;
    const numero = numeroLimpio(ruta[2]);
    const subtitulo = a.querySelector('span.truncate')?.textContent.trim();
    const previo = vistos.get(numero);
    vistos.set(numero, {
      title: subtitulo || !previo ? `Chapter ${numero}${subtitulo ? `: ${subtitulo}` : ''}` : previo.title,
      url: `${origen}/comics/${slug}/chapter/${ruta[2]}`, episodeNo: numero, numero, idioma: 'en',
      ...(previo?.dePago || esDePago(a) ? { dePago: true } : {})
    });
  }
  return [...vistos.values()].sort((a, b) => Number(a.numero) - Number(b.numero));
}

async function obtenerEpisodios(url, _onProgress, opciones) {
  if (!esUrlDeAsura(url)) throw new Error(nombre);
  const doc = await leerPagina(`${origen}/comics/${idDeObra(url)}`, 'a[href*="/chapter/"]', { serie: true });
  const datos = datosDeSerie(doc);

  const canonLd = `${origen}/comics/${rutaDe(datos.url)?.[1] || idDeObra(url)}`;
  const episodios = episodiosDe(doc, canonLd);
  if (!episodios.length) throw new Error(`${nombre} · 0 capítulos`);
  const dePago = episodios.filter(e => e.dePago).length;
  return datosComic({
    source: nombre, url: canonLd, title: datos.name || doc.title.replace(/\s*\|.*$/, ''),
    author: datos.author?.name || '', language: 'en', synopsis: datos.description || '', coverUrl: portadaDe(datos.image),
    capitulosDePago: dePago, capitulosLibres: episodios.length - dePago
  }, episodios, opciones);
}

async function obtenerVinhetas(ch) {
  const [, , numero] = rutaDe(ch.url) || [];
  if (!numero) throw new Error(nombre);
  const doc = await leerPagina(ch.url, 'img[data-page-index]');
  if (!doc.querySelector('img[data-page-index]')) {
    const texto = doc.body?.textContent || '';
    const muro = MARCA_DE_PAGO.test(texto) || /\b(unlock|subscribe|membership|paywall|coins?)\b/i.test(texto)
      || !!doc.querySelector('[data-lucide*="lock"], [class*="paywall"], [class*="premium"]');
    if (muro) throw Object.assign(new Error(`${nombre} · capítulo de pago o anticipado (sin viñetas)`), { dePago: true });
    throw new Error(`${nombre} · sin viñetas (¿cambió la página o no terminó de cargar?)`);
  }
  return [...doc.querySelectorAll('img[data-page-index]')]
    .sort((a, b) => Number(a.dataset.pageIndex) - Number(b.dataset.pageIndex))
    .map(img => {
      const src = urlHttp(img.getAttribute('src'));
      if (!src || src.protocol !== 'https:' || !DOMINIO_ASURA.test(src.hostname)) throw new Error(`${nombre} · imagen fuera del sitio`);
      return { url: src.href, ancho: Number(img.getAttribute('width')) || 800, alto: Number(img.getAttribute('height')) || 1280 };
    });
}

const downloadChapters = descargadorComic({ fuente, obtenerVinhetas, idDeObra, referer: () => `${origen}/` });

module.exports = { esUrlDeAsura, obtenerEpisodios, scrape: obtenerEpisodios, obtenerVinhetas, downloadChapters, admiteHuecos: true };
