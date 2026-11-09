const TRAMO = 12;

export async function encargarObraAlNavegador(registro, id, desde, total) {
  const fondo = registro?.backgroundFetch;
  if (!fondo) return 'sin-api';
  if (total - desde <= TRAMO) return 'corta';
  const base = globalThis.window?.__MYLAIBERRY_BASE__ || '';
  const urls = [];
  for (let i = desde; i < total; i++) urls.push(`${base}/capitulo/${encodeURIComponent(id)}/${i}`);
  try {
    if (await fondo.get(`viaje-${id}`)) return 'existente';
    await fondo.fetch(`viaje-${id}`, urls, { title: 'Guardando capítulos para leer sin conexión' });
    return 'aceptada';
  } catch {
    return 'rechazada';
  }
}

export async function encargarAlNavegador(registro, id, desde, total) {
  return ['aceptada', 'existente'].includes(await encargarObraAlNavegador(registro, id, desde, total));
}

export function esperarApunte(sw, id, ms = 3000) {
  return new Promise(ok => {
    const fin = () => { sw.removeEventListener('message', oir); clearTimeout(reloj); ok(); };
    const oir = e => { if (e.data?.tipo === 'viaje-estado' && e.data.id === id && e.data.estado?.enFondo) fin(); };
    const reloj = setTimeout(fin, ms);
    sw.addEventListener('message', oir);
  });
}

export async function guardarConElNavegador(registro, sw, { id, desde, total, ficha }) {
  const enviar = m => registro.active?.postMessage(m);
  if (!registro?.backgroundFetch || total - desde <= TRAMO) { enviar({ tipo: 'viaje-guardar', id, total, ficha }); return 'tramos'; }
  const apunte = esperarApunte(sw, id);
  enviar({ tipo: 'viaje-fondo', id, total, ficha });
  await apunte;
  const resultado = await encargarObraAlNavegador(registro, id, desde, total);
  if (!['aceptada', 'existente'].includes(resultado)) enviar({ tipo: 'viaje-guardar', id, total, ficha });
  return resultado;
}
