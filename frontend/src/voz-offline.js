export const CACHE_VOZ = 'mylaiberry-voz-mp3';

const urlAudio = clave => `/voz-mp3/${encodeURIComponent(clave)}.mp3`;
const urlMeta = clave => `/voz-mp3/${encodeURIComponent(clave)}.json`;

export async function guardarCopia({ caches = globalThis.caches, clave, estado, traer = (u) => fetch(u), max = 5, ahora = Date.now }) {
  try {
    if (!caches || !estado?.uri) return false;
    const r = await traer(estado.uri);
    if (!r?.ok) return false;
    const cache = await caches.open(CACHE_VOZ);

    await cache.put(urlAudio(clave), r);
    await cache.put(urlMeta(clave), new Response(JSON.stringify({
      guardado: ahora(), marcas: estado.marcas || [], frases: estado.frases || null
    })));
    await recortar(cache, max);
    return true;
  } catch { return false; }
}

async function recortar(cache, max) {
  const metas = [];
  for (const { url } of await cache.keys()) {
    if (!url.endsWith('.json')) continue;
    const r = await cache.match(url);
    metas.push({ url, guardado: (await r.json()).guardado || 0 });
  }
  metas.sort((a, b) => b.guardado - a.guardado);
  for (const { url } of metas.slice(max)) {
    await cache.delete(url);
    await cache.delete(url.replace(/\.json$/, '.mp3'));
  }
}

export async function leerCopia({ caches = globalThis.caches, clave, crearUrl = (b) => URL.createObjectURL(b) }) {
  try {
    if (!caches) return null;
    const cache = await caches.open(CACHE_VOZ);
    const meta = await cache.match(urlMeta(clave));
    const audio = await cache.match(urlAudio(clave));
    if (!meta || !audio) return null;
    const { marcas, frases } = await meta.json();
    return { estado: 'listo', uri: crearUrl(await audio.blob()), marcas, frases, local: true };
  } catch { return null; }
}

export async function leerAudioFijado({ indexedDB = globalThis.indexedDB, obra, indice, idioma, crearUrl = (b) => URL.createObjectURL(b) }) {
  if (!indexedDB || obra == null) return null;
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('mylaiberry-viaje-1');
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        const bd = req.result;
        if (!bd.objectStoreNames.contains('audios') || !bd.objectStoreNames.contains('audioDatos')) {
          bd.close();
          return resolve(null);
        }
        const tx = bd.transaction(['audios', 'audioDatos'], 'readonly');
        const clave = [String(obra), Number(indice || 0), String(idioma || 'original')];
        const reqMeta = tx.objectStore('audios').get(clave);
        const reqDatos = tx.objectStore('audioDatos').get(clave);
        let meta = null, datos = null;
        reqMeta.onsuccess = () => { meta = reqMeta.result || null; };
        reqDatos.onsuccess = () => { datos = reqDatos.result || null; };
        tx.oncomplete = () => {
          bd.close();
          if (meta && meta.estado === 'completo' && datos?.blob && datos.blob.size === meta.tamano) {
            resolve({
              estado: 'listo',
              uri: crearUrl(datos.blob),
              marcas: meta.marcas || [],
              frases: meta.frases || null,
              origen: 'viaje',
              local: true,
              fijado: true,
              huellaTexto: meta.huellaTexto || null,
              tamano: meta.tamano
            });
          } else {
            resolve(null);
          }
        };
        tx.onerror = tx.onabort = () => { bd.close(); resolve(null); };
      };
    } catch { resolve(null); }
  });
}

export async function guardarAudioFijado({ indexedDB = globalThis.indexedDB, meta, blob }) {
  if (!indexedDB || !blob || !meta || meta.obra == null) return false;
  const bd = await new Promise((ok, mal) => {
    const req = indexedDB.open('mylaiberry-viaje-1');
    req.onsuccess = () => ok(req.result);
    req.onerror = () => mal(req.error);
  });
  const clave = [String(meta.obra), Number(meta.indice || 0), String(meta.idioma || 'original')];
  return new Promise((resolve, reject) => {
    const tx1 = bd.transaction('audioDatos', 'readwrite');
    tx1.objectStore('audioDatos').put({ obra: clave[0], indice: clave[1], idioma: clave[2], blob });
    tx1.onerror = tx1.onabort = () => { bd.close(); reject(tx1.error || new Error('Fallo al escribir blob')); };
    tx1.oncomplete = () => {
      const tx2 = bd.transaction('audios', 'readwrite');
      tx2.objectStore('audios').put({
        ...meta,
        obra: clave[0],
        indice: clave[1],
        idioma: clave[2],
        tamano: blob.size,
        estado: 'completo',
        guardadoEn: Date.now(),
        fijadoParaViaje: true
      });
      tx2.oncomplete = () => { bd.close(); resolve(true); };
      tx2.onerror = tx2.onabort = () => { bd.close(); reject(tx2.error); };
    };
  });
}

export async function resolverAudio({ indexedDB = globalThis.indexedDB, caches = globalThis.caches, obraId, capitulo, idioma, clave, consultar, crearUrl }) {
  const partes = typeof clave === 'string' ? clave.split(':') : [];
  const oid = obraId ?? partes[0];
  const cap = capitulo !== undefined ? Number(capitulo) : (partes[1] !== undefined ? Number(partes[1]) : 0);
  const idi = idioma ?? (partes[2] || 'original');
  if (oid != null) {
    const fijado = await leerAudioFijado({ indexedDB, obra: oid, indice: cap, idioma: idi, crearUrl });
    if (fijado) return fijado;
  }
  const copia = await leerCopia({ caches, clave, crearUrl });
  if (copia) return { ...copia, origen: 'temporal' };
  if (typeof consultar === 'function') {
    try {
      const remoto = await consultar();
      return remoto ? { ...remoto, origen: remoto.local ? 'pc-local' : 'remoto' } : null;
    } catch { return null; }
  }
  return null;
}
