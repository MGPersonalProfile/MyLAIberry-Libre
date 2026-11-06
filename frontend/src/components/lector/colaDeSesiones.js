const CLAVE = 'mylaiberry:sesiones-sin-entregar';
const MAXIMO = 200;
const almacenPorDefecto = () => { try { return globalThis.localStorage || null; } catch { return null; } };

export function sesionesSinEntregar(almacen = almacenPorDefecto()) {
  try { const l = JSON.parse(almacen?.getItem(CLAVE) || '[]'); return Array.isArray(l) ? l : []; } catch { return []; }
}
function guardar(almacen, lista) {
  try { almacen?.setItem(CLAVE, JSON.stringify(lista.slice(-MAXIMO))); } catch {  }
}
const quitar = (almacen, id) => guardar(almacen, sesionesSinEntregar(almacen).filter(s => s.sessionId !== id));

const recibida = r => r?.aceptada === true || r?.motivo === 'no-valida';

export async function entregarSesion(api, sesion, almacen = almacenPorDefecto()) {
  const previas = sesionesSinEntregar(almacen);
  if (!previas.some(s => s.sessionId === sesion.sessionId)) guardar(almacen, [...previas, sesion]);
  try {
    if (recibida(await api.registrarSesionLectura(sesion))) quitar(almacen, sesion.sessionId);
  } catch {  }
}

let reenviando = null;

export function reenviarSesiones(api, almacen = almacenPorDefecto()) {
  reenviando ||= (async () => {
    for (const s of sesionesSinEntregar(almacen)) await entregarSesion(api, s, almacen);
  })().finally(() => { reenviando = null; });
  return reenviando;
}
