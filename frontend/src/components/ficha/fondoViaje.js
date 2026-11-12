const TRAMO = 12;

const ESPERA_PERMISO_MS = 20000;

export async function encargarObraAlNavegador(registro, id, desde, total, esperaPermisoMs = ESPERA_PERMISO_MS) {
  const fondo = registro?.backgroundFetch;
  if (!fondo) return 'sin-api';
  if (total - desde <= TRAMO) return 'corta';
  const base = globalThis.window?.__MYLAIBERRY_BASE__ || '';
  const urls = [];
  for (let i = desde; i < total; i++) urls.push(`${base}/capitulo/${encodeURIComponent(id)}/${i}`);
  try {

    const previo = await fondo.get(`viaje-${id}`);
    if (previo && !previo.result) return 'existente';
    const encargo = fondo.fetch(`viaje-${id}`, urls, { title: 'Guardando capítulos para leer sin conexión' }).then(() => 'aceptada');
    let reloj;
    const sinRespuesta = new Promise(ok => { reloj = setTimeout(() => ok('sin-respuesta'), esperaPermisoMs); });
    try { return await Promise.race([encargo, sinRespuesta]); } finally { clearTimeout(reloj); encargo.catch(() => {}); }
  } catch {
    return 'rechazada';
  }
}

export async function permisoDelNavegador(permisos = globalThis.navigator?.permissions) {
  try {
    const { state } = await permisos.query({ name: 'background-fetch' });
    return ['granted', 'prompt', 'denied'].includes(state) ? state : null;
  } catch {
    return null;
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

export async function guardarConElNavegador(registro, sw, { id, desde, total, ficha, esperaPermisoMs }) {
  const enviar = m => registro.active?.postMessage(m);
  if (!registro?.backgroundFetch || total - desde <= TRAMO) { enviar({ tipo: 'viaje-guardar', id, total, ficha }); return 'tramos'; }
  const apunte = esperarApunte(sw, id);
  enviar({ tipo: 'viaje-fondo', id, total, ficha });
  await apunte;
  const resultado = await encargarObraAlNavegador(registro, id, desde, total, esperaPermisoMs);
  if (!['aceptada', 'existente'].includes(resultado)) enviar({ tipo: 'viaje-guardar', id, total, ficha });
  return resultado;
}
