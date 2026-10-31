const https = require('https');
const { leerCapitulos, lectoresJsdom, TECHO_DEL_FICHERO } = require('../epub.js');
const { exigirAlgoGuardado } = require('./guardado.js');

const FICHUB_API = 'https://fichub.net/api/v0';
const USER_AGENT = 'MyLAIberry/1.0 (lector de codigo abierto)';

const TOPE_MS = 45_000;

function apiGet(endpoint) {
  return new Promise((resolve, reject) => {
    const url = `${FICHUB_API}${endpoint}`;
    const peticion = https.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`FicHub API response inválida: ${data.substring(0, 200)}`));
        }
      });
    });

    peticion.on('error', reject);

    peticion.setTimeout(TOPE_MS, () => {
      peticion.destroy(new Error(`FicHub no respondió en ${TOPE_MS / 1000}s`));
    });
  });
}

function downloadFile(url, { techo = TECHO_DEL_FICHERO, saltos = 5 } = {}) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : require('http');
    const peticion = proto.get(url, {
      headers: { 'User-Agent': USER_AGENT }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (saltos <= 0) return reject(new Error('FicHub redirige sin parar'));
        const destino = new URL(res.headers.location, url).href;
        return downloadFile(destino, { techo, saltos: saltos - 1 }).then(resolve).catch(reject);
      }
      const demasiado = () => new Error(`El EPUB de FicHub pasa de ${Math.round(techo / 1048576)} MB: no parece un libro`);
      if (Number(res.headers['content-length']) > techo) {
        res.destroy();
        return reject(demasiado());
      }
      const chunks = [];
      let bytes = 0;
      res.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > techo) { res.destroy(); peticion.destroy(); return reject(demasiado()); }
        chunks.push(chunk);
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });

    peticion.on('error', reject);

    peticion.setTimeout(TOPE_MS, () => {
      peticion.destroy(new Error(`FicHub no envió el fichero en ${TOPE_MS / 1000}s`));
    });
  });
}

async function parseEpubToChapters(epubBuffer) {

  const p = lectoresJsdom();
  try {
    return await leerCapitulos(epubBuffer, p);
  } finally {
    p.cerrar();
  }
}

async function caerAlGenerico(url, onProgress, meta) {
  if (onProgress) {
    onProgress({ step: 'loading', message: 'FicHub no pudo generar el libro; leyendo la página directamente…' });
  }
  const alterno = await require('./universal').scrape(url, onProgress);
  return {
    ...alterno,

    title: meta.title || alterno.title,
    author: meta.author || alterno.author,
    synopsis: meta.description || alterno.synopsis,
    source: alterno.source || 'FicHub'
  };
}

async function obraDesdeEpub(url, onProgress, meta, epub) {
  if (onProgress) onProgress({ step: 'parsing', message: 'Descargando y parseando EPUB...' });

  const epubBuffer = await downloadFile(`https://fichub.net${epub.epub_url}`);
  const chapters = await parseEpubToChapters(epubBuffer);

  if (!chapters.length) {
    throw new Error('El EPUB de FicHub no traia ningun capitulo legible');
  }

  if (onProgress) {
    onProgress({ step: 'done', message: `${chapters.length} capítulos extraídos vía FicHub.` });
  }

  return {
    title: meta.title || epub.title || 'Historia sin título',
    author: meta.author || epub.author || 'Autor desconocido',
    synopsis: meta.description || '',
    coverUrl: '',
    url: url,
    chapters: chapters.map((ch, i) => ({ title: ch.title, url: `${url}#chapter-${i}` })),
    chapterContents: chapters.map(ch => ch.content),
    source: 'FicHub'
  };
}

async function pedirAFicHub(url, onProgress) {
  const meta = await apiGet(`/meta?q=${encodeURIComponent(url)}`);
  if (meta.err) throw new Error(`FicHub error: ${meta.err_msg || 'URL no soportada'}`);

  if (onProgress) {
    onProgress({
      step: 'extracting',
      message: `"${meta.title}" encontrado en FicHub.`,
      details: `${meta.chapters || 1} capítulos`
    });
    onProgress({ step: 'downloading', message: 'Generando EPUB vía FicHub...' });
  }

  const epub = await apiGet(`/epub?q=${encodeURIComponent(url)}`);

  if (epub.err) {
    console.warn(`[FicHub] EPUB no disponible (${epub.err}); se intenta con el extractor genérico.`);
    return caerAlGenerico(url, onProgress, meta);
  }
  if (!epub.epub_url) throw new Error('FicHub no devolvió URL de EPUB');

  return obraDesdeEpub(url, onProgress, meta, epub);
}

async function copiaDeAO3(url, onProgress) {
  const meta = await apiGet(`/meta?q=${encodeURIComponent(url)}`);
  if (meta.err) throw new Error(`FicHub no tiene copia: ${meta.err_msg || meta.msg || 'sin guardar'}`);
  if (onProgress) onProgress({ step: 'downloading', message: `AO3 está cerrado; «${meta.title}» sale de la copia de FicHub…` });
  const epub = await apiGet(`/epub?q=${encodeURIComponent(url)}`);
  if (epub.err || !epub.epub_url) {
    throw new Error(`FicHub no tiene copia: ${(epub.fixits || []).join(' ') || epub.msg || 'sin EPUB'}`);
  }
  return { ...(await obraDesdeEpub(url, onProgress, meta, epub)), meta };
}

async function scrape(url, onProgress) {
  if (onProgress) onProgress({ step: 'init', message: 'Consultando FicHub API...' });

  try {
    return await pedirAFicHub(url, onProgress);
  } catch (err) {

    if (onProgress) {
      onProgress({ step: 'fallback', message: `FicHub falló (${err.message}). Usando extractor universal...` });
    }
    return require('./universal').scrape(url, onProgress);
  }
}

async function downloadChapters(chapters, fanficId, onProgress, saveContentFn) {
  if (!chapters.length) return;

  const hilo = String(chapters[0].url || '').split('#')[0];
  if (!hilo) throw new Error('Esta obra de FicHub no guarda la dirección de su hilo.');

  if (onProgress) {
    onProgress({ step: 'loading', message: 'Pidiendo el libro a FicHub…' });
  }

  const obra = await pedirAFicHub(hilo, onProgress);
  const delEpub = (obra.chapterContents || []).map(content => ({ content }));

  if (!delEpub.length) {
    throw new Error('FicHub devolvió el libro sin capítulos legibles; se reintentará.');
  }

  let guardados = 0;
  for (let n = 0; n < chapters.length; n++) {

    const m = String(chapters[n].url || '').match(/#chapter-(\d+)$/);
    const i = m ? Number(m[1]) : n;

    const contenido = delEpub[i]?.content;
    if (!contenido || !contenido.trim()) {
      console.error(`[FicHub] El capítulo ${i + 1} no está en el libro; no se guarda.`);
      continue;
    }

    if (await saveContentFn(fanficId, i, contenido) !== false) guardados++;

    if (onProgress) {
      onProgress({
        step: 'downloading_chapters',
        message: `Guardando capítulo ${n + 1} de ${chapters.length}…`,
        details: chapters[n].title || ''
      });
    }
  }

  exigirAlgoGuardado(guardados, chapters.length, 'FicHub');
}

module.exports = { scrape, downloadChapters, admiteHuecos: true, downloadFile, copiaDeAO3 };
