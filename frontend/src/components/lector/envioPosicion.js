export function crearEmisor(api, storage, obra, revisionInicial = 0, id = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`) {
  const clave = `mylaiberry:a36:${obra}`;
  const leer = k => { try { return JSON.parse(storage?.getItem(k) || 'null'); } catch { return null; } };
  const escribir = (k, v) => { try { storage?.setItem(k, JSON.stringify(v)); } catch {  } };
  const quitar = k => { try { storage?.removeItem(k); } catch {  } };
  let revision = Number(revisionInicial) || 0;
  let cola = Promise.resolve();
  const dispositivoClave = 'mylaiberry:deviceId';
  const dispositivo = leer(dispositivoClave) || id();
  escribir(dispositivoClave, dispositivo);

  function preparar(capitulo, posicion) {
    const pendiente = { capitulo, posicion, meta: { deviceId: dispositivo,
      mutationId: id(), baseRevision: revision } };
    escribir(clave, pendiente);
    return pendiente;
  }

  let confirmada = false;

  function pasar(p, conservarBase) {
    const tarea = cola.catch(() => {}).then(async () => {
      if (!conservarBase) p.meta.baseRevision = revision;
      if (leer(clave)?.meta?.mutationId === p.meta.mutationId) escribir(clave, p);
      try {
        let r = await api.saveScrollPosition(obra, p.capitulo, p.posicion, p.meta);
        if (r?.status === 'conflict' && !confirmada && !conservarBase && Number.isInteger(r.revision)) {
          revision = r.revision; p.meta.baseRevision = revision;
          r = await api.saveScrollPosition(obra, p.capitulo, p.posicion, p.meta);
        }
        if (r?.status !== 'ok' && r?.status !== 'conflict') return r;
        confirmada = true;
        if (Number.isInteger(r.revision)) revision = r.revision;
        if (leer(clave)?.meta?.mutationId === p.meta.mutationId) quitar(clave);
        return r;
      } catch { return null; }
    });
    cola = tarea;
    return tarea;
  }

  function enSerie(accion) {
    const tarea = cola.catch(() => {}).then(async () => {
      const r = await accion();
      if (Number.isInteger(r?.lecturaRevision)) { revision = Math.max(revision, r.lecturaRevision); confirmada = true; }
      return r;
    });
    cola = tarea.catch(() => {});
    return tarea;
  }

  function enviar(p, posicion) {
    p.posicion = posicion;
    if (leer(clave)?.meta?.mutationId === p.meta.mutationId) escribir(clave, p);
    return pasar(p, false);
  }

  function reanudar() {
    const p = leer(clave);
    return p?.meta?.mutationId ? pasar(p, true) : Promise.resolve(null);
  }

  const actualizarRevision = n => { if (Number.isInteger(n)) revision = Math.max(revision, n); };
  return { preparar, enviar, reanudar, actualizarRevision, enSerie };
}
