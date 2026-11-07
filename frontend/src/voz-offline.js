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

export async function resolverAudio({ caches, clave, consultar, crearUrl }) {
  const copia = await leerCopia({ caches, clave, crearUrl });
  if (copia) return copia;
  try { return await consultar(); } catch { return null; }
}
