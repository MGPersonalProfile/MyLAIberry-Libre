const { JSDOM } = require('jsdom');
const { conRitmo } = require('./navegar.js');
const { cabeceras, fetchWeb } = require('../user-agent.js');
const { pedirPublico } = require('../red-publica.js');
const { descargadorComic } = require('./comic.js');

const HOST_VINHETA_WEBTOON = /(^|\.)(pstatic\.net|webtoons?\.com|naver\.(net|com))$/i;
const esLocalDePrueba = u => process.env.MYLAIBERRY_WEBTOON_LOCAL === '1' && (u.hostname === '127.0.0.1' || u.hostname === 'localhost');

function idDeObra(url) {
  const m = String(url || '').match(/title_no=(\d+)/i);
  return m ? m[1] : null;
}

function esUrlDeWebtoon(url) {
  try {
    const u = new URL(String(url).trim());
    return /^https?:$/.test(u.protocol) && /^(?:[a-z0-9-]+\.)*webtoons?\.com$/i.test(u.hostname);
  } catch { return false; }
}

function urlCanonica(url) {
  const tid = idDeObra(url);
  if (!tid) return url;
  try {
    const u = new URL(url);
    const m = u.pathname.match(/^(\/[a-z]{2}\/[^/]+\/[^/]+)/i);
    const base = m ? m[1] : '/en/comic';

    const deLaPrueba = esLocalDePrueba(u);
    const origin = deLaPrueba ? u.origin : 'https://www.webtoons.com';
    return `${origin}${base}/list?title_no=${tid}`;
  } catch {
    return `https://www.webtoons.com/en/comic/list?title_no=${tid}`;
  }
}

function extraerEpisodios(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const items = Array.from(doc.querySelectorAll('#_listUl li, .detail_lst li'));

  return items.map(li => {
    const a = li.querySelector('a');
    const href = a ? a.href : '';
    const m = href.match(/episode_no=(\d+)/i);
    const episodeNo = li.getAttribute('data-episode-no') || (m ? m[1] : '');
    const title = li.querySelector('.subj span, .subj')?.textContent?.trim() || `Episode ${episodeNo}`;
    const date = li.querySelector('.date')?.textContent?.trim() || '';
    return { episodeNo, title, url: href, date };
  }).filter(e => e.episodeNo && e.url);
}

function paginasDeSerie(html, base = 'https://www.webtoons.com') {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const links = Array.from(doc.querySelectorAll('.paginate a, .paginate_area a'));
  let origenBase = '';
  try { origenBase = new URL(base).origin; } catch {  }
  const urls = [];
  for (const a of links) {
    const href = a.getAttribute('href');
    if (!href || href === '#' || href.startsWith('javascript:')) continue;
    try {
      const u = new URL(href, base);
      if (u.username || u.password) continue;
      if (esUrlDeWebtoon(u.href) || (esLocalDePrueba(u) && u.origin === origenBase)) urls.push(u.href);
    } catch {  }
  }
  return [...new Set(urls)];
}

function ordenarEpisodios(episodios) {
  return [...episodios].sort((a, b) => Number(a.episodeNo || 0) - Number(b.episodeNo || 0));
}

function extraerVinhetas(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const imgs = Array.from(doc.querySelectorAll('#_imageList img, .viewer_img img, .viewer_lst img'));

  const vinhetas = [];
  for (const img of imgs) {
    const dataUrl = img.getAttribute('data-url');
    const src = img.getAttribute('src');
    const url = dataUrl || src;

    if (!url || url.includes('bg_transparency.png')) continue;
    let u;
    try { u = new URL(url); } catch { continue; }
    if (u.username || u.password) continue;
    const permitida = esLocalDePrueba(u)
      ? /^https?:$/.test(u.protocol)
      : u.protocol === 'https:' && HOST_VINHETA_WEBTOON.test(u.hostname);
    if (!permitida) continue;

    const ancho = Number(img.getAttribute('width')) || 800;
    const alto = Number(img.getAttribute('height')) || 1280;
    const alt = img.getAttribute('alt') || 'Viñeta';

    vinhetas.push({ url: u.href, ancho, alto, alt });
  }
  return vinhetas;
}

function limpiarAutor(texto) {
  return String(texto || '').replace(/\s+/g, ' ').replace(/\s*(?:\.\.\.|…)?\s*author info\s*$/i, '')
    .replace(/\s+,/g, ',').trim();
}

function autoresDe(doc) {
  const enlaces = [...doc.querySelectorAll('.author_area a.author')].map(a => limpiarAutor(a.textContent)).filter(Boolean);
  if (enlaces.length) return enlaces.join(', ');
  const area = doc.querySelector('.author, .author_area')?.cloneNode(true);
  area?.querySelectorAll('button, .btn_info, .ico_info, [class*="_btnAuthorInfo"]').forEach(b => b.remove());
  return limpiarAutor(area?.textContent);
}

function extraerMetadatosSerie(doc) {
  const title = doc.querySelector('.subj, h1')?.textContent?.trim() || 'Webtoon';
  const author = autoresDe(doc);
  const coverCruda = doc.querySelector('.thmb img, meta[property="og:image"]')?.src ||
                doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
  const cover = require('../red-publica.js').urlPublica(coverCruda, 'https://www.webtoons.com');
  const description = doc.querySelector('.summary, meta[name="description"]')?.textContent?.trim() ||
                      doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  return { title, author, cover, description };
}

async function scrape(url, onProgress, opciones = {}) {
  const avisar = (msg, step = 'loading') => onProgress && onProgress({ step, message: msg });
  avisar('Leyendo la serie de Webtoon...');

  const pedirWebtoon = (destino) => {
    const u = new URL(destino);
    return esLocalDePrueba(u)
      ? fetchWeb(u.href, { headers: cabeceras(), credentials: 'omit' })
      : pedirPublico(u.href, { headers: cabeceras() });
  };
  const canon = urlCanonica(url);
  const res = await conRitmo(canon, () => pedirWebtoon(canon));
  const html = await res.text();

  const dom = new JSDOM(html);
  const meta = extraerMetadatosSerie(dom.window.document);

  let episodios = extraerEpisodios(html);
  const uBase = (() => { try { return new URL(canon).origin; } catch { return 'https://www.webtoons.com'; } })();
  const paginas = paginasDeSerie(html, uBase);

  for (const pagUrl of paginas) {
    avisar(`Leyendo página adicional de episodios: ${pagUrl}`);
    try {
      const pRes = await conRitmo(pagUrl, () => pedirWebtoon(pagUrl));
      const pHtml = await pRes.text();
      episodios = episodios.concat(extraerEpisodios(pHtml));
    } catch (err) {
      if (err.limitado || err.reto) throw err;
    }
  }

  const vistos = new Set();
  const unicos = episodios.filter(ep => !vistos.has(ep.episodeNo) && vistos.add(ep.episodeNo));

  let capitulosOrdenados = ordenarEpisodios(unicos).map((ep, idx) => ({
    title: ep.title,
    url: ep.url,
    index: idx,
    episodeNo: ep.episodeNo,
    idioma: new URL(canon).pathname.split('/')[1]
  }));

  let episodiosElegidos;
  if (Array.isArray(opciones?.episodios) && opciones.episodios.length > 0) {
    const permitidos = new Set(opciones.episodios.map(String));
    const sonIndices = opciones.episodios.every(x => typeof x === 'number');
    capitulosOrdenados = capitulosOrdenados.filter((ep, idx) =>
      permitidos.has(String(ep.episodeNo)) || (sonIndices && permitidos.has(String(idx)))
    );

    episodiosElegidos = capitulosOrdenados.map(ep => ep.episodeNo);
  }

  return {
    ...meta,
    source: 'Webtoon',
    url: canon,
    tipo: 'comic',
    esComic: true,
    chapters: capitulosOrdenados,
    totalChapters: capitulosOrdenados.length,
    ...(episodiosElegidos ? { episodiosElegidos } : {})
  };
}

async function obtenerVinhetas(ch) {
  const { pedirComic } = require('./comic-red.js');
  const html = await pedirComic(ch.url, r => r.text(), {
    headers: cabeceras({ Referer: 'https://www.webtoons.com/' }), redirect: 'follow'
  });
  return extraerVinhetas(html);
}

const downloadChapters = descargadorComic({ fuente: 'webtoon', obtenerVinhetas, idDeObra, referer: ch => ch.url });

async function obtenerEpisodios(url, onProgress) {
  return await scrape(url, onProgress);
}

module.exports = {
  limpiarAutor,
  extraerMetadatosSerie,
  esUrlDeWebtoon,
  idDeObra,
  urlCanonica,
  extraerEpisodios,
  paginasDeSerie,
  ordenarEpisodios,
  extraerVinhetas,
  scrape,
  downloadChapters,
  obtenerEpisodios
};
