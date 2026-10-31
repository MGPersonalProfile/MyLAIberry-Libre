const HILOS_LEIDOS = 3;
const COMENTARIOS_POR_HILO = 10;

const recortar = (t, n) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n);

const PIDE_RECOMENDACIONES = /\b(recs?|recommend\w*|suggest\w*|best|favou?rites?|looking for|lists?|top \d+|must.?reads?)\b/i;

const BORRADO = /^\[(deleted|removed|eliminado|borrado|supprimé)\]$/i;

const OBRA = String.raw`https?:\/\/(?:www\.|m\.)?(?:archiveofourown\.org\/works\/\d+|fanfiction\.net\/s\/\d+|royalroad\.com\/fiction\/\d+)`;
function enlacesDe(texto) {
  const t = String(texto || '');
  const vistos = new Map();
  for (const m of t.matchAll(new RegExp(String.raw`\[([^\]]{1,150})\]\((${OBRA})[^)]*\)`, 'gi'))) {
    const url = m[2].replace('://m.', '://www.');
    if (!vistos.has(url)) vistos.set(url, { titulo: m[1].replace(/\s+/g, ' ').trim(), url });
  }
  for (const m of t.matchAll(new RegExp(OBRA, 'gi'))) {
    const url = m[0].replace('://m.', '://www.');
    if (!vistos.has(url)) vistos.set(url, { url });
  }
  return [...vistos.values()];
}

function urlDeBusqueda({ consulta, subreddit }) {
  const p = new URLSearchParams({ q: String(consulta || ''), sort: 'relevance', t: 'all', limit: '15', type: 'link' });
  const sub = String(subreddit || '').replace(/^\/?r\//i, '').replace(/[^\w]/g, '');
  if (sub) p.set('restrict_sr', 'on');
  return `https://www.reddit.com/${sub ? `r/${sub}/` : ''}search.json?${p}`;
}

function hilosDeListado(json) {
  return (json?.data?.children || []).filter(c => c.kind === 't3').map(({ data: d }) => ({
    id: d.id,
    titulo: recortar(d.title, 200),
    subreddit: d.subreddit,
    puntos: d.score,
    numComentarios: d.num_comments,
    fecha: d.created_utc ? new Date(d.created_utc * 1000).toISOString().slice(0, 10) : undefined,
    url: `https://www.reddit.com${d.permalink || `/comments/${d.id}`}`,

    texto: recortar(d.selftext, 1500),
    enlaces: enlacesDe(d.selftext)
  }));
}

function comentariosDeHilo(json) {
  const lista = Array.isArray(json) ? json[1] : null;
  return (lista?.data?.children || [])
    .filter(c => c.kind === 't1' && c.data?.body && !BORRADO.test(c.data.body.trim()))
    .sort((a, b) => (b.data.score || 0) - (a.data.score || 0))
    .slice(0, COMENTARIOS_POR_HILO)
    .map(c => ({ puntos: c.data.score, texto: recortar(c.data.body, 400), enlaces: enlacesDe(c.data.body) }));
}

const entidades = (t) => String(t || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&');
const campo = (xml, re) => (String(xml).match(re) || [])[1] || '';

function textoDeEntrada(contenido) {
  let html = entidades(entidades(contenido));
  const md = html.match(/<div class="md">([\s\S]*?)<\/div>\s*<!-- SC_ON -->/);
  if (md) html = md[1];
  return entidades(html.replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, url, t) => `[${t.replace(/<[^>]+>/g, '').trim()}](${url})`)
    .replace(/<(br|\/p|\/li)\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''));
}

function entradasDe(xml) {
  return String(xml || '').split('<entry>').slice(1).map(e => e.split('</entry>')[0]).map(e => ({
    id: campo(e, /<id>([^<]+)<\/id>/), titulo: entidades(campo(e, /<title>([^<]*)<\/title>/)),
    url: campo(e, /<link href="([^"]+)"/), fecha: campo(e, /<published>([^<]+)<\/published>/).slice(0, 10) || undefined,
    subreddit: campo(e, /<category term="([^"]+)"/) || undefined, texto: textoDeEntrada(campo(e, /<content type="html">([\s\S]*?)<\/content>/))
  }));
}

function hilosDeRss(xml) {
  return entradasDe(xml).filter(e => e.id.startsWith('t3_')).map(e => ({
    id: e.id.slice(3), titulo: recortar(e.titulo, 200), subreddit: e.subreddit, fecha: e.fecha, url: e.url,
    texto: recortar(e.texto, 1500), enlaces: enlacesDe(e.texto)
  }));
}

function comentariosDeRss(xml) {
  return entradasDe(xml).filter(e => e.id.startsWith('t1_') && e.texto.trim() && !BORRADO.test(e.texto.trim()))
    .slice(0, COMENTARIOS_POR_HILO).map(e => ({ texto: recortar(e.texto, 400), enlaces: enlacesDe(e.texto) }));
}

async function pedirRss(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36' } });
  if (r.status === 429) throw new Error('Reddit está limitando las peticiones (429): vuelve a probar en unos minutos.');
  if (!r.ok) throw new Error(`Reddit no devolvió el RSS (HTTP ${r.status}).`);
  return r.text();
}

function elegirHilos(hilos) {
  const peso = h => (PIDE_RECOMENDACIONES.test(h.titulo) ? 100000 : 0) + (h.numComentarios || 0);
  return [...hilos].sort((a, b) => peso(b) - peso(a)).slice(0, HILOS_LEIDOS);
}

async function recomendaciones({ consulta, subreddit }) {
  if (!String(consulta || '').trim()) return [];
  const { BrowserWindow } = require('electron');
  const win = new BrowserWindow({ width: 1200, height: 900, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true } });

  win.webContents.setUserAgent(win.webContents.getUserAgent().replace(/\s*Electron\/\S+/, ''));
  try {
    let hilos, porRss = false;
    try {
      hilos = hilosDeListado(await pedirJson(win, urlDeBusqueda({ consulta, subreddit })));
    } catch (e) {

      hilos = hilosDeRss(await pedirRss(urlDeBusqueda({ consulta, subreddit }).replace('/search.json?', '/search.rss?')));
      porRss = true;
    }
    const aLeer = elegirHilos(hilos);
    for (const hilo of aLeer) {
      try {
        hilo.comentarios = porRss
          ? comentariosDeRss(await pedirRss(`${hilo.url.replace(/\/?$/, '/')}.rss?sort=top&depth=1&limit=25`))
          : comentariosDeHilo(await pedirJson(win, `https://www.reddit.com/comments/${hilo.id}.json?sort=top&limit=25&depth=1`));
      } catch (e) {
        hilo.errorComentarios = e.message;
      }
    }

    const nota = porRss ? 'Reddit bloquea a la app sin sesión: esto sale de su RSS, sin votos y a veces sin comentarios. ' +
      'Si el autor entra en Reddit en Ajustes > Tus cuentas, se lee entero.' : undefined;

    return hilos.map(h => (aLeer.includes(h) ? { ...h, nota } : { ...h, texto: undefined }));
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

module.exports = { recomendaciones, urlDeBusqueda, hilosDeListado, comentariosDeHilo, elegirHilos, enlacesDe, hilosDeRss, comentariosDeRss };
async function entrarPorLaPortada(win) {
  const { cargarPagina } = require('./navegar.js');
  await cargarPagina(win, 'https://www.reddit.com/');
  for (let i = 0; i < 15; i++) {
    const nombres = (await win.webContents.session.cookies.get({ domain: 'reddit.com' })).map(c => c.name);
    if (nombres.includes('loid')) return;
    await new Promise(r => setTimeout(r, 1000));
  }
}

async function pedirJson(win, url) {
  const { cargarPagina } = require('./navegar.js');
  let texto = '';
  for (let intento = 0; intento < 2; intento++) {
    if (intento) await entrarPorLaPortada(win);
    await cargarPagina(win, url);
    texto = await win.webContents.executeJavaScript('document.body ? document.body.innerText : ""');
    try { return JSON.parse(texto); } catch {  }
  }
  throw new Error(`Reddit no devolvió datos (${recortar(texto, 80) || 'página vacía'}).`);
}

module.exports = { recomendaciones, urlDeBusqueda, hilosDeListado, comentariosDeHilo, elegirHilos, enlacesDe, hilosDeRss, comentariosDeRss };
