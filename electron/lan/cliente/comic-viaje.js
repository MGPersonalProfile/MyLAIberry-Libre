const RUTA_IMAGEN = /\/imagen-capitulo\/([\w-]{1,64})\/(\d{1,6})\/(\d{1,6})$/;
const esComicHtml = html => typeof html === 'string' && /data-tipo=["']comic["']/.test(html);

const contenidoDeViaje = html => typeof html === 'string' && (esComicHtml(html) || html.replace(/<[^>]*>/g, '').trim()) ? html : null;
const MB = bytes => Math.max(1, Math.round(bytes / 1048576));

function vinetasDe(html, obra, capitulo) {
  const lista = [];
  for (const [etiqueta] of html.matchAll(/<img\b[^>]*>/gi)) {
    const src = /\bsrc=["']([^"']+)["']/i.exec(etiqueta)?.[1];
    if (!src) continue;
    const url = new URL(src, `${self.location.origin}${BASE}/app/`);
    const m = url.origin === self.location.origin && RUTA_IMAGEN.exec(url.pathname);
    if (!m || url.pathname !== `${BASE}/imagen-capitulo/${m[1]}/${m[2]}/${m[3]}` || m[1] !== obra || Number(m[2]) !== capitulo) continue;
    lista.push({ imagen: Number(m[3]), url: url.href, bytes: Number(/\bdata-bytes=["']?(\d+)/i.exec(etiqueta)?.[1]) || 0 });
  }
  return lista;
}

async function espacioDelNavegador() {
  try { return (typeof navigator !== 'undefined' && await navigator.storage?.estimate?.()) || null; } catch { return null; }
}
const bytesDeCapitulos = estado => Object.values(estado?.bytesComic || {}).reduce((s, b) => s + b, 0);

async function bytesGuardadosDeVinetas(estado) {
  const otras = (await obrasDeViaje().catch(() => [])).filter(o => o?.id !== estado.id);
  return otras.reduce((s, o) => s + bytesDeCapitulos(o), 0) + bytesDeCapitulos(estado);
}

function sinEspacio(c, que) {
  const e = new Error(`No queda espacio para guardar esta obra en el móvil: ${que} necesita unos ${MB(c.necesarios)} MB y caben ${Math.floor(c.disponibles / 1048576)} MB.`);
  return Object.assign(e, { name: 'QuotaExceededError', espacioViaje: true });
}

async function comprobarCabidaDeComic(estado, indice, declarados) {
  if (!declarados || typeof comprobarImagenesViaje !== 'function') return;
  const est = await espacioDelNavegador(), guardados = await bytesGuardadosDeVinetas(estado);
  const previos = estado.bytesComic?.[indice] || 0;
  const capitulo = comprobarImagenesViaje({ bytesNuevos: declarados, bytesGuardados: guardados, bytesPrevios: previos }, est);
  if (!capitulo.permitido) throw sinEspacio(capitulo, 'este capítulo');
  if (estado.serieComicEstimada) return;
  const serie = comprobarImagenesViaje({ bytesNuevos: declarados * Math.max(1, estado.total - indice), bytesGuardados: guardados, bytesPrevios: previos }, est);
  if (!serie.permitido) throw sinEspacio(serie, 'la serie');
  estado.serieComicEstimada = true;
}

async function traerVineta(v) {
  for (let intento = 0; intento < 3; intento++) {
    try {
      const r = await fetch(v.url);
      const blob = r.ok ? await r.blob() : null;
      if (blob && blob.size > 0 && (!v.bytes || blob.size === v.bytes) && /^image\//.test(blob.type || r.headers.get('Content-Type') || '')) return blob;
    } catch {  }
    if (intento < 2) await new Promise(ok => setTimeout(ok, 300 * (intento + 1)));
  }
  throw new Error(`No se pudo traer la viñeta ${v.imagen + 1} del PC. Se reanudará al reconectar.`);
}

async function escribirTodoViaje(operaciones) {
  const bd = await abrirViaje();
  return new Promise((ok, mal) => {
    const tx = bd.transaction([...new Set(operaciones.map(o => o[0]))], 'readwrite');
    for (const [almacen, accion, valor] of operaciones) tx.objectStore(almacen)[accion](valor);
    tx.oncomplete = () => { bd.close(); ok(); };
    tx.onerror = () => { bd.close(); mal(tx.error); };
    tx.onabort = () => { bd.close(); mal(tx.error || new Error('Guardado local interrumpido.')); };
  });
}

async function escribirCapituloViaje(estado, indice, html) {
  const id = estado.id, previos = estado.bytesComic?.[indice] || 0;
  const vs = esComicHtml(html) ? vinetasDe(html, id, indice) : [];
  if (!vs.length && !previos) return escribirViaje('capitulos', { obra: id, indice, html });
  await comprobarCabidaDeComic(estado, indice, vs.reduce((s, v) => s + v.bytes, 0));
  const blobs = [];
  for (const v of vs) blobs.push(await traerVineta(v));
  const bytes = blobs.reduce((s, b) => s + b.size, 0);
  if (typeof comprobarImagenesViaje === 'function') {
    const real = comprobarImagenesViaje({ bytesNuevos: bytes, bytesGuardados: await bytesGuardadosDeVinetas(estado), bytesPrevios: previos }, await espacioDelNavegador());
    if (!real.permitido) throw sinEspacio(real, 'este capítulo');
  }
  const bytesComic = { ...estado.bytesComic };
  if (bytes) bytesComic[indice] = bytes; else delete bytesComic[indice];
  await escribirTodoViaje([
    ['imagenes', 'delete', IDBKeyRange.bound([id, indice], [id, indice, []])],
    ...vs.map((v, i) => ['imagenes', 'put', { obra: id, capitulo: indice, imagen: v.imagen, blob: blobs[i], mime: blobs[i].type || 'image/jpeg', bytes: blobs[i].size }]),
    ['capitulos', 'put', { obra: id, indice, html }],
    ['obras', 'put', { ...estado, bytesComic }]
  ]);
  estado.bytesComic = bytesComic;
}

async function atenderImagenComic(peticion) {
  const m = RUTA_IMAGEN.exec(new URL(peticion.url).pathname);
  const r = m && await leerViaje('imagenes', [m[1], Number(m[2]), Number(m[3])]).catch(() => null);
  if (r?.blob) return new Response(r.blob, { headers: { 'Content-Type': r.mime || 'image/jpeg', 'Cache-Control': 'private, max-age=31536000, immutable' } });
  return fetch(peticion);
}
