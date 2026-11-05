const TRAMO = 12;

export async function encargarAlNavegador(registro, id, desde, total) {
  const fondo = registro?.backgroundFetch;
  if (!fondo || total - desde <= TRAMO) return false;
  const base = globalThis.window?.__MYLAIBERRY_BASE__ || '';
  const urls = [];
  for (let i = desde; i < total; i++) urls.push(`${base}/capitulo/${id}/${i}`);
  try {
    if (await fondo.get(`viaje-${id}`)) return true;
    await fondo.fetch(`viaje-${id}`, urls, { title: 'Guardando capítulos para leer sin conexión' });
    return true;
  } catch {
    return false;
  }
}
