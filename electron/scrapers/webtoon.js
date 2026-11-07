const { JSDOM } = require('jsdom');
const { conRitmo } = require('./navegar.js');
const { descargarImagen, USER_AGENT } = require('./webtoon-imagenes.js');
const { guardarCapituloComic, generarHtmlCapituloComic } = require('../db.js');

function idDeObra(url) {
  const m = String(url || '').match(/title_no=(\d+)/i);
  return m ? m[1] : null;
}

function urlCanonica(url) {
  const tid = idDeObra(url);
  if (!tid) return url;
  try {
    const u = new URL(url);
    const m = u.pathname.match(/^(\/[a-z]{2}\/[^/]+\/[^/]+)/i);
    const base = m ? m[1] : '/en/comic';
    return `https://www.webtoons.com${base}/list?title_no=${tid}`;
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

function paginasDeSerie(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const links = Array.from(doc.querySelectorAll('.paginate a, .paginate_area a'));
  const urls = [];
  for (const a of links) {
    const href = a.getAttribute('href');
    if (href && href !== '#' && !href.startsWith('javascript:')) {
      urls.push(href.startsWith('http') ? href : `https://www.webtoons.com${href}`);
    }
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

    const ancho = Number(img.getAttribute('width')) || 800;
    const alto = Number(img.getAttribute('height')) || 1280;
    const alt = img.getAttribute('alt') || 'Viñeta';

    vinhetas.push({ url, ancho, alto, alt });
  }
  return vinhetas;
}

function extraerMetadatosSerie(doc) {
  const title = doc.querySelector('.subj, h1')?.textContent?.trim() || 'Webtoon';
  const author = doc.querySelector('.author, .author_area')?.textContent?.trim() || '';
  const cover = doc.querySelector('.thmb img, meta[property="og:image"]')?.src ||
                doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
  const description = doc.querySelector('.summary, meta[name="description"]')?.textContent?.trim() ||
                      doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  return { title, author, cover, description };
}

async function scrape(url, onProgress) {
  const avisar = (msg, step = 'loading') => onProgress && onProgress({ step, message: msg });
  avisar('Leyendo la serie de Webtoon...');

  const canon = urlCanonica(url);
  const res = await conRitmo(canon, () => fetch(canon, { headers: { 'User-Agent': USER_AGENT } }));
  const html = await res.text();

  const dom = new JSDOM(html);
  const meta = extraerMetadatosSerie(dom.window.document);

  let episodios = extraerEpisodios(html);
  const paginas = paginasDeSerie(html);

  for (const pagUrl of paginas) {
    avisar(`Leyendo página adicional de episodios: ${pagUrl}`);
    try {
      const pRes = await conRitmo(pagUrl, () => fetch(pagUrl, { headers: { 'User-Agent': USER_AGENT } }));
      const pHtml = await pRes.text();
      episodios = episodios.concat(extraerEpisodios(pHtml));
    } catch {

    }
  }

  const vistos = new Set();
  const unicos = [];
  for (const ep of episodios) {
    if (!vistos.has(ep.episodeNo)) {
      vistos.add(ep.episodeNo);
      unicos.push(ep);
    }
  }

  const capitulosOrdenados = ordenarEpisodios(unicos).map((ep, idx) => ({
    title: ep.title,
    url: ep.url,
    index: idx,
    episodeNo: ep.episodeNo
  }));

  return {
    ...meta,
    source: 'Webtoon',
    url: canon,
    tipo: 'comic',
    esComic: true,
    chapters: capitulosOrdenados,
    totalChapters: capitulosOrdenados.length
  };
}

async function downloadChapters(chapters, fanficId, onProgress, saveContentFn, desde = 0) {
  if (!Array.isArray(chapters) || chapters.length === 0) return;

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const indiceReal = desde + i;
    onProgress && onProgress({
      step: 'downloading_chapter',
      message: `Descargando ${ch.title} (${i + 1}/${chapters.length})...`,
      downloaded: indiceReal,
      total: chapters.length
    });

    const res = await conRitmo(ch.url, () =>
      fetch(ch.url, { headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://www.webtoons.com/' } })
    );
    const html = await res.text();
    const vinhetas = extraerVinhetas(html);

    const imagenes = [];
    for (let j = 0; j < vinhetas.length; j++) {
      const v = vinhetas[j];
      const buffer = await descargarImagen(v.url, { referer: ch.url });
      imagenes.push({
        archivo: `${String(j + 1).padStart(4, '0')}.jpg`,
        buffer,
        ancho: v.ancho,
        alto: v.alto
      });
    }

    await guardarCapituloComic(fanficId, indiceReal, {
      titleNo: idDeObra(ch.url),
      episodio: ch.episodeNo || String(indiceReal + 1),
      url: ch.url,
      imagenes,
      totalEsperadas: vinhetas.length
    });

    const htmlCap = generarHtmlCapituloComic(fanficId, indiceReal, imagenes);
    await saveContentFn(fanficId, i, htmlCap);
  }
}

module.exports = {
  idDeObra,
  urlCanonica,
  extraerEpisodios,
  paginasDeSerie,
  ordenarEpisodios,
  extraerVinhetas,
  scrape,
  downloadChapters
};
