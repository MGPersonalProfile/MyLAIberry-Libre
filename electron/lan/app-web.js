const fs = require('fs');
const path = require('path');
const { mismoOrigen, drenar } = require('./progreso.js');
const { rutaSegura, esIdValido } = require('./rutas-seguras.js');
const { puenteParaElMovil, CON_CODIGO_OBLIGATORIO } = require('./puente.js');
const eventos = require('./eventos.js');
const { conComic, resolverImagen } = require('./comic-lan.js');

const CARPETA_APP = path.join(__dirname, '..', '..', 'frontend', 'dist');
const MAXIMO = 1024 * 1024;
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.avif': 'image/avif', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream'
};
const IMAGENES = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif']);

const DE_LA_BIBLIOTECA = new Set([...IMAGENES, '.mp3']);

const POLITICA_APP = [
  "default-src 'self'", "script-src 'self' 'wasm-unsafe-eval' blob:", "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http:", "font-src 'self' data:", "connect-src 'self'",
  "worker-src 'self' blob:", "manifest-src 'self'", "object-src 'none'", "frame-src 'none'",
  "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'"
].join('; ');

function enviar(res, codigo, tipo, cuerpo, extra = {}) {
  res.writeHead(codigo, {
    'Content-Type': tipo, 'Content-Length': Buffer.byteLength(cuerpo),
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': POLITICA_APP, ...extra
  });
  res.end(cuerpo);
}
const json = (res, codigo, datos) => enviar(res, codigo, 'application/json; charset=utf-8', JSON.stringify(datos), { 'Cache-Control': 'no-store' });

function comoApp(html) {
  return html
    .replace(/<meta name="viewport"[^>]*>/, '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">')
    .replace('</head>', [
      '<link rel="manifest" href="../manifest.webmanifest">',
      '<link rel="apple-touch-icon" href="../icono-192.png">',
      '<meta name="theme-color" content="#141414">',
      '<meta name="apple-mobile-web-app-capable" content="yes">',
      '<meta name="mobile-web-app-capable" content="yes">',
      '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
      '<meta name="apple-mobile-web-app-title" content="MyLAIberry">',
      '</head>'
    ].join(''));
}

function servirApp(res, resto) {
  const relativa = resto.length ? resto.join('/') : 'index.html';
  const ruta = rutaSegura(CARPETA_APP, relativa);
  if (!ruta || !fs.existsSync(ruta) || fs.statSync(ruta).isDirectory()) return json(res, 404, { error: 'No hay nada aquí.' });

  const eterno = /-[A-Za-z0-9_-]{8,}\.(js|css|woff2?|png|svg)$/.test(ruta);
  const cuerpo = relativa === 'index.html' ? comoApp(fs.readFileSync(ruta, 'utf-8')) : fs.readFileSync(ruta);
  return enviar(res, 200, TIPOS[path.extname(ruta).toLowerCase()] || 'application/octet-stream', cuerpo,
    { 'Cache-Control': eterno ? 'public, max-age=31536000, immutable' : 'no-cache' });
}

const SOLO_DEL_PC = /^(clasificador|transformers|ort-wasm)|\.(wasm|onnx|map)$/;
function precargaDeLaApp(carpeta = CARPETA_APP) {
  const lista = [''];
  const recorrer = (dir, prefijo) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefijo + e.name;
      if (e.isDirectory() && e.name === 'modelos') continue;
      if (e.isDirectory()) recorrer(path.join(dir, e.name), rel + '/');
      else if (e.name !== 'index.html' && !SOLO_DEL_PC.test(e.name)) lista.push(rel);
    }
  };
  if (fs.existsSync(carpeta)) recorrer(carpeta, '');
  return lista;
}

function servirFichero(res, pedida, raizDatos, cabeceraRango = '') {
  if (!pedida || !raizDatos) return json(res, 404, { error: 'No hay nada aquí.' });
  const raiz = fs.realpathSync(raizDatos);
  let real = null;
  try { real = fs.realpathSync(path.resolve(pedida)); } catch {}

  const nombre = path.basename(String(pedida));
  const enCapturas = path.join(raiz, 'capturas', nombre);
  if ((!real || !rutaSegura(raiz, path.relative(raiz, real))) && /^pagina-\d+\.jpg$/.test(nombre)
    && path.basename(path.dirname(String(pedida))) === 'capturas' && fs.existsSync(enCapturas)) {
    real = fs.realpathSync(enCapturas);
  }
  if (!real) return json(res, 404, { error: 'No hay nada aquí.' });
  const dentro = rutaSegura(raiz, path.relative(raiz, real));
  if (!dentro || !DE_LA_BIBLIOTECA.has(path.extname(real).toLowerCase())) return json(res, 404, { error: 'No hay nada aquí.' });
  const cuerpo = fs.readFileSync(real);
  const tipo = TIPOS[path.extname(real).toLowerCase()];
  const comunes = { 'Cache-Control': 'private, max-age=86400', 'Accept-Ranges': 'bytes' };

  const r = rangoPedido(cabeceraRango, cuerpo.length);
  if (r === 'fuera') return enviar(res, 416, tipo, '', { ...comunes, 'Content-Range': `bytes */${cuerpo.length}` });
  if (!r) return enviar(res, 200, tipo, cuerpo, comunes);
  return enviar(res, 206, tipo, cuerpo.subarray(r.ini, r.fin + 1), { ...comunes, 'Content-Range': `bytes ${r.ini}-${r.fin}/${cuerpo.length}` });
}

function rangoPedido(cabecera, total) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(cabecera || '').trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  const ini = m[1] === '' ? Math.max(0, total - Number(m[2])) : Number(m[1]);
  const fin = m[1] === '' || m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1);
  return ini > fin || ini >= total ? 'fuera' : { ini, fin };
}

async function servirEpub(res, id, url, epub) {
  if (typeof epub !== 'function' || !esIdValido(id)) return json(res, 404, { error: 'No hay nada aquí.' });
  const t = url.searchParams.get('traducido');
  const hecho = await epub(id, t === '1' || t === '0' ? { traducido: t === '1' } : {});
  if (hecho.status !== 'ok') return json(res, 404, { error: hecho.message || 'No se pudo exportar.' });
  const nombre = hecho.nombre;
  return enviar(res, 200, 'application/epub+zip', hecho.libro, {
    'Content-Disposition': `attachment; filename="${nombre.replace(/[^\x20-\x7e]|["\\]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
    'Cache-Control': 'no-store',
    'X-Capitulos': String(hecho.resumen.capitulos), 'X-Total': String(hecho.resumen.total)
  });
}

async function servirAudioObra(res, id, url, audioObra) {
  const idioma = url.searchParams.get('idioma') || 'es';
  if (typeof audioObra !== 'function' || !esIdValido(id) || !/^[a-z]{2}$/.test(idioma)) return json(res, 404, { error: 'No hay nada aquí.' });
  const zip = await audioObra(id, idioma);
  if (!zip) return json(res, 404, { error: 'Todavía no hay ningún capítulo de esta obra en MP3.' });
  res.writeHead(200, {
    'Content-Type': 'application/zip', 'Content-Length': String(zip.bytes),
    'Content-Disposition': `attachment; filename="${zip.nombre.replace(/[^\x20-\x7e]|["\\]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(zip.nombre)}`,
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store',
    'X-Capitulos': String(zip.capitulos), 'X-Total': String(zip.total)
  });
  const escribir = buf => new Promise((ok, mal) => {
    if (res.destroyed) return mal(new Error('El móvil cerró la conexión'));
    if (res.write(buf)) ok(); else res.once('drain', ok);
  });
  try {
    await require('../epub-zip.js').escribirZipPorPartes(zip.ficheros, escribir);
    res.end();
  } catch {
    res.destroy();
  }
}

function leerCuerpo(req, maximo = MAXIMO) {
  return new Promise((ok, mal) => {
    const trozos = [];
    let largo = 0;
    req.on('data', (t) => {
      largo += t.length;
      if (largo > maximo) { mal(new Error('grande')); req.destroy(); return; }
      trozos.push(t);
    });
    req.on('end', () => ok(Buffer.concat(trozos).toString('utf-8')));
    req.on('error', mal);
  });
}

async function servirCapitulo(res, [id, n], llamar) {
  const indice = Number(n);
  if (!/^[\w.-]{1,160}$/.test(id) || !Number.isInteger(indice) || indice < 0 || indice > 20000) {
    return json(res, 400, { error: 'Capítulo no válido.' });
  }
  try {
    return json(res, 200, { valor: (await llamar('get-chapter-content', [id, indice])) ?? null });
  } catch (e) {
    return json(res, 500, { error: String(e?.message || e) });
  }
}

async function servirImagenComic(res, [id, n, i], comic) {
  const f = await resolverImagen(comic, id, n, i);
  if (!f) return json(res, 404, { error: 'No hay nada aquí.' });
  return enviar(res, 200, f.mime, fs.readFileSync(f.ruta), { 'Cache-Control': 'private, max-age=31536000, immutable' });
}

async function llamarApi(req, res, canal, llamar, { codigoLan = false } = {}) {
  const permitidos = new Set(Object.values(puenteParaElMovil().metodos));

  const no = async (codigo, error) => { await drenar(req); return json(res, codigo, { error }); };
  if (!permitidos.has(canal)) return no(404, 'Eso no se puede pedir desde el móvil.');
  if (!mismoOrigen(req)) return no(403, 'Origen no permitido.');
  if (CON_CODIGO_OBLIGATORIO.has(canal) && !codigoLan) return no(403, 'Este canal necesita el código de acceso del móvil.');
  if (!/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) return no(415, 'Sólo JSON.');
  if (Number(req.headers['content-length'] || 0) > MAXIMO) return no(413, 'Es demasiado grande para mandarlo desde el móvil.');
  let args;
  try { args = JSON.parse(await leerCuerpo(req)); } catch { return json(res, 400, { error: 'Cuerpo no válido.' }); }
  if (!Array.isArray(args)) return json(res, 400, { error: 'Los argumentos van en una lista.' });
  try {
    return json(res, 200, { valor: (await llamar(canal, args)) ?? null });
  } catch (e) {
    return json(res, 200, { error: String(e?.message || e) });
  }
}

async function atenderPush(req, res, accion, ctx) {
  const push = () => ctx.push || require('../aviso-push.js').actual();
  const no = async (codigo, error) => { await drenar(req); return json(res, codigo, { error }); };
  if (req.method === 'GET' && accion === 'publica') {
    return json(res, 200, { publicKey: await push().clavePublica() });
  }
  if (req.method !== 'POST' || !['suscribir', 'cancelar', 'estado'].includes(accion)) return no(404, 'Ruta no encontrada.');
  if (!ctx.codigoLan) return no(403, 'Esta ruta necesita el código de acceso del móvil.');
  if (!mismoOrigen(req)) return no(403, 'Origen no permitido.');
  if (!/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) return no(415, 'Sólo JSON.');
  if (Number(req.headers['content-length'] || 0) > 4096) return no(413, 'Cuerpo demasiado grande.');
  let dato;
  try { dato = JSON.parse(await leerCuerpo(req, 4096)); } catch { return json(res, 400, { error: 'Cuerpo no válido.' }); }
  try {
    if (accion === 'suscribir') return json(res, 200, await push().suscribir(dato));
    if (accion === 'cancelar') return json(res, 200, await push().cancelar(dato.endpoint));
    return json(res, 200, { activa: await push().estaSuscrito(dato.endpoint) });
  } catch (e) { return json(res, 400, { error: e.message }); }
}

async function atenderApp(req, res, partes, url, ctx) {
  if (!ctx || typeof ctx.llamar !== 'function') return false;
  const [primero, ...resto] = partes;
  if (ctx.comic) ctx = { ...ctx, llamar: conComic(ctx.llamar, ctx.comic) };
  if (primero === 'push' && resto.length === 1) {
    await atenderPush(req, res, resto[0], ctx);
    return true;
  }
  if (req.method === 'POST') {

    if (primero === 'subir' && !resto.length) {
      await require('./subida.js').atenderSubida(req, res, url, ctx.subirLibro, { json, drenar, mismoOrigen });
      return true;
    }
    if (primero !== 'api' || resto.length !== 1) return false;
    await llamarApi(req, res, resto[0], ctx.llamar, ctx);
    return true;
  }

  if (primero === 'app' && !resto.length && !url.pathname.endsWith('/')) {
    res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
    res.end();
    return true;
  }
  if (primero === 'app' && resto.join('/') === 'precarga.json') { json(res, 200, precargaDeLaApp()); return true; }
  if (primero === 'app') { servirApp(res, resto); return true; }
  if (primero === 'puente.json' && !resto.length) { json(res, 200, puenteParaElMovil()); return true; }
  if (primero === 'eventos' && !resto.length) { eventos.suscribir(req, res); return true; }
  if (primero === 'epub' && resto.length === 1) { await servirEpub(res, resto[0], url, ctx.epub); return true; }
  if (primero === 'capitulo' && resto.length === 2) { await servirCapitulo(res, resto, ctx.llamar); return true; }
  if (primero === 'imagen-capitulo' && resto.length === 3) { await servirImagenComic(res, resto, ctx.comic); return true; }
  if (primero === 'audio-obra' && resto.length === 1) { await servirAudioObra(res, resto[0], url, ctx.audioObra); return true; }
  if (primero === 'fichero' && !resto.length) {
    servirFichero(res, url.searchParams.get('ruta'), typeof ctx.raizDatos === 'function' ? ctx.raizDatos() : ctx.raizDatos, req.headers?.range);
    return true;
  }
  return false;
}

module.exports = { atenderApp, precargaDeLaApp, POLITICA_APP, CARPETA_APP };
