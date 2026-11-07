const { JSDOM } = require('jsdom');
const { seriesDe } = require('./ao3-series.js');
const { categoriaCanonica, FANDOM, PERSONAJE, RELACION, LIBRE, CLASIFICACION, CATEGORIA } = require('../etiquetas.js');

const categoriasDe = (texto) => String(texto || '').split(',').map(s => s.trim()).filter(c => c && !/^no category$/i.test(c))
  .map(name => ({ name, category: CATEGORIA }));
const { exigirQueNoSeaUnReto } = require('./navegar.js');

const { numero } = require('./numeros.js');

const { pedirHTML, pedirHTMLConNavegador } = require('./ao3-pedir.js');
const { deLaCopiaDeFicHub } = require('./ao3-copia.js');
const { resolverParejaAO3 } = require('../filtros/parejas-ao3.js');

function extraerWorkId(url) {
  const m = String(url).match(/works\/(\d+)/);
  return m ? m[1] : null;
}

const limpio = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

function leerMeta(doc) {
  const mapa = {};
  doc.querySelectorAll('.meta dt').forEach(dt => {
    const clave = limpio(dt).replace(/:$/, '').toLowerCase();
    const dd = dt.nextElementSibling;
    if (clave && dd) mapa[clave] = limpio(dd);
  });
  return mapa;
}

const CAMPOS_DE_ETIQUETA = [
  { claves: ['fandom', 'fandoms'], categoria: FANDOM },
  { claves: ['relationship', 'relationships'], categoria: RELACION },
  { claves: ['character', 'characters'], categoria: PERSONAJE },
  { claves: ['additional tags'], categoria: LIBRE },
  { claves: ['rating'], categoria: CLASIFICACION }
];

function etiquetasDe(meta) {
  const tags = [];
  for (const { claves, categoria } of CAMPOS_DE_ETIQUETA) {
    const clave = claves.find(k => meta[k]);
    if (!clave) continue;
    meta[clave].split(',').map(s => s.trim()).filter(Boolean)
      .forEach(name => tags.push({ name, category: categoria }));
  }
  return tags;
}

function capitulosDe(doc, title) {
  const contenedor = doc.querySelector('#chapters');
  const capitulos = [];

  if (contenedor) {
    let actual = null;
    for (const hijo of contenedor.children) {
      const encabezado = hijo.querySelector ? hijo.querySelector('h2.heading') : null;
      if (encabezado) {
        actual = { title: limpio(encabezado), partes: [] };
        capitulos.push(actual);

        const cuerpo = hijo.querySelector(':scope > div.userstuff');
        if (cuerpo?.innerHTML.trim()) actual.partes.push(cuerpo.innerHTML.trim());
        continue;
      }
      if (hijo.classList && hijo.classList.contains('userstuff')) {
        const html = hijo.innerHTML.trim();
        if (!html) continue;
        if (!actual) {
          actual = { title: title || 'Capítulo 1', partes: [] };
          capitulos.push(actual);
        }
        actual.partes.push(html);
      }
    }
  }

  if (capitulos.length === 0) {
    const cuerpo = doc.querySelector('#chapters')
      || [...doc.querySelectorAll('.userstuff')].find(el => !el.closest('#preface, #afterword'));
    if (cuerpo) capitulos.push({ title: title || 'Capítulo 1', partes: [cuerpo.innerHTML.trim()] });
  }

  return capitulos;
}

function parsearDescarga(html, workId, urlOriginal) {
  const doc = new JSDOM(html).window.document;
  const urlObra = workId ? `https://archiveofourown.org/works/${workId}` : urlOriginal;

  const title = limpio(doc.querySelector('h1'));
  const enlaceAutor = doc.querySelector('.byline a') || doc.querySelector('a[rel="author"]');
  const author = limpio(enlaceAutor)
    || limpio(doc.querySelector('.byline')).replace(/^by\s+/i, '');

  const autorUrl = urlDeAutor(enlaceAutor?.getAttribute('href'));

  const meta = leerMeta(doc);
  const synopsis = meta['summary'] || limpio(doc.querySelector('.meta .userstuff'));

  const stats = meta['stats'] || '';
  const wordCount = numero(stats.match(/Words:\s*([\d,.\s]+)/i)?.[1]);

  const capitulosEnStats = stats.match(/Chapters:\s*(\d+)\s*\/\s*(\d+|\?)/i);
  const completa = capitulosEnStats
    ? (capitulosEnStats[2] === '?' ? false : capitulosEnStats[1] === capitulosEnStats[2])
    : undefined;

  const capitulos = capitulosDe(doc, title);

  return {
    title, author, autorUrl, synopsis, wordCount, completa,
    tags: etiquetasDe(meta),
    series: seriesDe(doc),
    url: urlObra,

    chapters: capitulos.map((c, i) => ({
      title: c.title || `Capítulo ${i + 1}`,
      url: urlObra
    })),
    chapterContents: capitulos.map(c => c.partes.join('\n'))
  };
}

function parsearPaginaNormal(html, workId) {
  const doc = new JSDOM(html).window.document;

  const title = limpio(doc.querySelector('.title.heading') || doc.querySelector('h2.title') || doc.querySelector('h1'));
  const enlaceAutor = doc.querySelector('a[rel="author"]');
  const author = limpio(enlaceAutor);
  const autorUrl = urlDeAutor(enlaceAutor?.getAttribute('href'));
  const synopsis = limpio(doc.querySelector('.summary .userstuff') || doc.querySelector('blockquote.userstuff'));
  const wordCount = numero(limpio(doc.querySelector('dd.words')));
  const kudos = numero(limpio(doc.querySelector('dd.kudos')));

  const cap = limpio(doc.querySelector('dd.chapters')).replace(/\s/g, '').match(/^(\d+)\/(\d+|\?)$/);
  const completa = cap ? (cap[2] === '?' ? false : cap[1] === cap[2]) : undefined;

  const tags = [];
  doc.querySelectorAll('dd.fandom a, dd.relationship a, dd.character a, dd.freeform a').forEach(a => {
    tags.push({ name: limpio(a), category: categoriaCanonica((a.closest('dd')?.className || '').split(' ')[0]) });
  });
  tags.push(...categoriasDe([...doc.querySelectorAll('dd.category a')].map(limpio).join(',')));
  for (const categoria of ['rating', 'language']) {
    const valor = limpio(doc.querySelector(`dd.${categoria}`));
    if (valor) tags.push({ name: valor, category: categoriaCanonica(categoria) });
  }

  const capitulos = [];
  const divs = doc.querySelectorAll('[id^="chapter-"]');
  if (divs.length > 0) {
    divs.forEach((div, i) => {
      const h = div.querySelector('.title a') || div.querySelector('h3.title');
      const cont = div.querySelector('.userstuff[role="article"]') || div.querySelector('.userstuff');
      capitulos.push({
        title: limpio(h) || `Capítulo ${i + 1}`,
        url: `https://archiveofourown.org/works/${workId}/chapters/${div.id.replace('chapter-', '')}`,
        content: cont ? cont.innerHTML.trim() : ''
      });
    });
  } else {
    const cont = doc.querySelector('#workskin .userstuff') || doc.querySelector('.userstuff');
    if (cont) {
      cont.querySelector('.summary')?.remove();
      capitulos.push({ title: title || 'Capítulo 1', url: `https://archiveofourown.org/works/${workId}`, content: cont.innerHTML.trim() });
    }
  }

  return {
    title, author, autorUrl, synopsis, wordCount, kudos, completa, tags, series: seriesDe(doc),
    totalChapters: cap ? Number(cap[1]) : capitulos.length,
    url: `https://archiveofourown.org/works/${workId}`,
    chapters: capitulos.map(c => ({ title: c.title, url: c.url })),
    chapterContents: capitulos.map(c => c.content)
  };
}

function esUtil(r) {
  return !!(r && r.title && r.chapters && r.chapters.length > 0);
}

async function leerKudos(workId) {
  const html = await pedirHTML(`https://archiveofourown.org/works/${workId}?view_adult=true`, 20000);

  const m = html.match(/<dd\s+class="kudos"[^>]*>([\s\S]{0,80}?)<\/dd>/i);
  return m ? numero(m[1].replace(/<[^>]+>/g, ' ')) : 0;
}

async function leerPorLasTresVias(workId, url, avisar) {
  let resultado = null;
  const problemas = [];

  const limites = [];

  let duros = 0;
  const fallo = (err) => { if (err.limitado) limites.push(err); else duros++; };

  try {
    avisar('Descargando la obra de AO3…');
    const html = await pedirHTML(`https://download.archiveofourown.org/downloads/${workId}/work.html`);
    avisar('Leyendo capítulos y metadatos…', 'extracting');
    const r = parsearDescarga(html, workId, url);
    if (esUtil(r)) resultado = r;
    else problemas.push('la descarga directa no traía título ni capítulos');
  } catch (err) {
    fallo(err);
    problemas.push(`descarga directa: ${err.message}`);
  }

  let noExiste = false;
  if (!resultado) {
    try {
      avisar('Probando por la página de la obra…');
      const html = await pedirHTML(`https://archiveofourown.org/works/${workId}?view_adult=true&view_full_work=true`);
      const r = parsearPaginaNormal(html, workId);
      if (esUtil(r)) resultado = r;
      else problemas.push('la página de la obra no traía título ni capítulos');
    } catch (err) {
      noExiste = Boolean(err.noExiste);
      fallo(err);
      problemas.push(`página de la obra: ${err.message}`);
    }
  }

  if (!resultado && !noExiste) {
    try {
      avisar('AO3 está pidiendo verificación; abriendo un navegador…');
      const html = await pedirHTMLConNavegador(`https://archiveofourown.org/works/${workId}?view_adult=true&view_full_work=true`);
      const r = parsearPaginaNormal(html, workId);
      if (esUtil(r)) resultado = r;
      else problemas.push('ni con navegador salió la obra');
    } catch (err) {
      fallo(err);
      problemas.push(`con navegador: ${err.message}`);
    }
  }

  return { resultado, problemas, noExiste, limites, duros };
}

async function scrape(url, onProgress, { respaldoFicHub = false } = {}) {
  const workId = extraerWorkId(url);
  if (!workId) throw new Error('Esa dirección de AO3 no lleva ninguna obra (falta /works/ID)');

  const avisar = (message, step = 'loading') => onProgress && onProgress({ step, message });

  let { resultado, problemas, noExiste, limites, duros } = await leerPorLasTresVias(workId, url, avisar);

  if (!resultado && respaldoFicHub && !noExiste) {
    resultado = await deLaCopiaDeFicHub(workId, onProgress, problemas);
  }

  if (!resultado) {

    const todoLimite = !noExiste && limites.length > 0 && duros === 0;
    throw Object.assign(new Error(`No se pudo leer esta obra de AO3. ${problemas.join(' · ')}`), { noExiste },
      todoLimite ? { limitado: true, mantenimiento: limites.some(e => e.mantenimiento) || undefined,
        esperarMs: Math.max(...limites.map(e => e.esperarMs || 0)) || undefined,
        sitio: 'archiveofourown.org' } : {});
  }

  if (!resultado.author) resultado.author = 'Autor desconocido';

  if (!resultado.kudos && !resultado.deCopia) {
    try {
      avisar('Leyendo los kudos…');
      resultado.kudos = await leerKudos(workId);
    } catch {  }
  }

  avisar(resultado.deCopia
    ? `${resultado.chapters.length} capítulos de la copia de FicHub (AO3 está cerrado).`
    : `${resultado.chapters.length} capítulos extraídos de AO3.`, 'done');

  return {
    title: resultado.title,
    author: resultado.author,
    autorUrl: resultado.autorUrl || '',
    synopsis: resultado.synopsis || '',
    coverUrl: '',
    url: resultado.url,
    chapters: resultado.chapters,
    chapterContents: resultado.chapterContents,
    source: 'AO3',
    tags: resultado.tags || [],
    wordCount: resultado.wordCount || 0,
    kudos: resultado.kudos || 0,

    completa: resultado.completa,

    series: resultado.series || []
  };
}

function urlDeAutor(href) {
  if (!href) return '';
  const limpio = String(href).replace(/^https?:\/\/[^/]+/, '');
  const m = limpio.match(/^\/users\/[^/]+(?:\/pseuds\/[^/?#]+)?/);
  return m ? `https://archiveofourown.org${m[0]}` : '';
}

async function leerAutor(autorUrl) {
  const base = urlDeAutor(autorUrl);
  if (!base) throw new Error('URL de autor de AO3 no válida');

  const limpiar = (el) => (el ? el.textContent.trim().replace(/\s+/g, ' ') : '');

  const obras = [];
  for (let pagina = 1; pagina <= 10; pagina++) {
    const url = pagina === 1 ? `${base}/works` : `${base}/works?page=${pagina}`;
    const doc = new JSDOM(await pedirHTMLConNavegador(url)).window.document;

    const indice = doc.querySelector('ol.work.index.group');
    const filas = indice ? [...indice.children] : [];

    const deEstaPagina = filas
      .map(f => obraDeFila(f, limpiar))
      .filter(Boolean)
      .map(o => ({ ...o, autorUrl: base }));

    if (deEstaPagina.length === 0) break;

    const conocidas = new Set(obras.map(o => o.url));
    const nuevas = deEstaPagina.filter(o => !conocidas.has(o.url));
    if (nuevas.length === 0) break;

    obras.push(...nuevas);

    if (deEstaPagina.length < 20) break;
  }

  const trozos = base.split('/').filter(Boolean);
  const nombre = decodeURIComponent(trozos[trozos.length - 1] || 'Autor');

  return { nombre, obras: obras.map(o => ({ ...o, author: o.author || nombre })) };
}

function obraDeFila(fila, limpiar) {
  const enlace = fila.querySelector('h4.heading a');
  const href = enlace?.getAttribute('href') || '';
  const workId = (href.match(/\/works\/(\d+)/) || [])[1];
  if (!workId) return null;

  const stats = {};
  for (const dt of fila.querySelectorAll('dl.stats dt')) {
    stats[limpiar(dt).replace(':', '')] = limpiar(dt.nextElementSibling);
  }

  const tags = [];
  for (const a of fila.querySelectorAll('h5.fandoms a')) {
    tags.push({ name: limpiar(a), category: FANDOM });
  }

  tags.push(...categoriasDe(fila.querySelector('ul.required-tags .category')?.getAttribute('title')));
  for (const li of fila.querySelectorAll('ul.tags li')) {
    const categoria = String(li.className || '').split(' ')[0];
    if (categoria === 'warnings') continue;
    tags.push({ name: limpiar(li), category: categoriaCanonica(categoria) });
  }

  const total = numero(stats['Chapters']) || 1;
  const enlaceAutor = fila.querySelector('h4.heading a[rel="author"]');

  return {
    idOrigen: workId,
    title: limpiar(enlace),
    synopsis: limpiar(fila.querySelector('.summary')),
    url: `https://archiveofourown.org/works/${workId}`,
    source: 'AO3',
    author: limpiar(enlaceAutor),
    autorUrl: urlDeAutor(enlaceAutor?.getAttribute('href')),
    wordCount: numero(stats['Words']),
    kudos: numero(stats['Kudos']),
    marcadores: numero(stats['Bookmarks']),

    completa: /^(\d+)\/\1$/.test(String(stats['Chapters'] || '').replace(/\s/g, '')),
    tags,
    totalChapters: total,
    chapterList: Array.from({ length: total }, (_, i) => ({
      title: `Capítulo ${i + 1}`,
      url: `https://archiveofourown.org/works/${workId}`
    }))
  };
}

function urlDeBusqueda({ consulta, pareja, orden = 'kudos_count', pagina = 1, completa, minPalabras, sinCrossovers }) {
  const p = new URLSearchParams();
  p.set('work_search[query]', consulta);
  if (pareja) p.set('work_search[relationship_names]', resolverParejaAO3(pareja).canonica);
  p.set('work_search[sort_column]', orden);
  if (completa === true) p.set('work_search[complete]', 'T');
  if (minPalabras) p.set('work_search[word_count]', `>${minPalabras}`);

  if (sinCrossovers === true) p.set('work_search[crossover]', 'F');
  if (pagina > 1) p.set('page', String(pagina));
  return `https://archiveofourown.org/works/search?${p.toString()}`;
}

async function buscar({ consulta, pareja, orden, pagina, completa, minPalabras, sinCrossovers }) {
  const html = await pedirHTMLConNavegador(urlDeBusqueda({ consulta, pareja, orden, pagina, completa, minPalabras, sinCrossovers }));
  return resultadosDeHtml(html, sinCrossovers);
}

function resultadosDeHtml(html, sinCrossovers = false) {
  const doc = new JSDOM(html).window.document;
  const limpiar = (el) => (el ? el.textContent.trim().replace(/\s+/g, ' ') : '');

  const indice = doc.querySelector('ol.work.index.group');
  const filas = indice ? [...indice.children] : [];
  if (!filas.length) exigirQueNoSeaUnReto('AO3', { titulo: doc.title, texto: doc.body?.textContent,
    documento: doc, url: 'https://archiveofourown.org/' });

  const obras = filas.map(f => obraDeFila(f, limpiar)).filter(Boolean);

  return sinCrossovers === true ? obras.map(o => ({ ...o, crossover: false })) : obras;
}

async function leerMarcadores(usuarioUrl, pagina = 1) {
  const base = urlDeAutor(usuarioUrl);
  if (!base) throw new Error('URL de usuario de AO3 no válida');

  const soloUsuario = base.replace(/\/pseuds\/.*$/, '');
  const url = pagina > 1
    ? `${soloUsuario}/bookmarks?page=${pagina}`
    : `${soloUsuario}/bookmarks`;

  const doc = new JSDOM(await pedirHTMLConNavegador(url)).window.document;
  const limpiar = (el) => (el ? el.textContent.trim().replace(/\s+/g, ' ') : '');

  const indice = doc.querySelector('ol.bookmark.index.group');
  const filas = indice ? [...indice.children] : [];

  const encabezado = limpiar(doc.querySelector('h2.heading'));
  const totalDeclarado = numero((encabezado.match(/of\s+([\d,]+)/i) || [])[1]);

  return {
    obras: filas.map(f => obraDeFila(f, limpiar)).filter(Boolean),
    hayMas: !!doc.querySelector('ol.pagination') && filas.length > 0,
    total: totalDeclarado
  };
}

async function downloadChapters(chapters, fanficId, onProgress, saveContentFn, desde = 0) {
  if (!Array.isArray(chapters) || chapters.length === 0) return;

  const url = chapters[0]?.url || '';
  const workId = extraerWorkId(url);
  if (!workId) throw new Error(`No se reconoce la obra de AO3 en ${url}`);

  if (onProgress) {
    onProgress({
      step: 'downloading_chapters',
      message: `Descargando la obra de AO3 (${chapters.length} capítulo${chapters.length === 1 ? '' : 's'})…`
    });
  }

  const obra = await scrape(`https://archiveofourown.org/works/${workId}`, null);
  const textos = obra.chapterContents || [];
  if (textos.length === 0) throw new Error('AO3 no devolvió el texto de ningún capítulo');

  let guardados = 0;
  for (let i = 0; i < chapters.length; i++) {
    const contenido = textos[desde + i];

    if (!contenido || !contenido.trim()) {
      console.error(`[AO3] El capítulo ${desde + i + 1} llegó vacío; no se guarda.`);
      continue;
    }

    if (await saveContentFn(fanficId, i, contenido) !== false) guardados++;
    if (onProgress) {
      onProgress({
        step: 'downloading_chapters',
        message: `Guardando capítulo ${desde + i + 1}…`,
        details: chapters[i]?.title || ''
      });
    }
  }

  if (guardados === 0) throw new Error('Ningún capítulo de AO3 traía texto');
}

module.exports = { scrape, downloadChapters, leerAutor, urlDeAutor, buscar, urlDeBusqueda, resultadosDeHtml, parsearPaginaNormal, parsearDescarga, leerMarcadores };
