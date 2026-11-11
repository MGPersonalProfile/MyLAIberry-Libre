const PROGRESO = ['guardados', 'completa', 'continuar', 'faltantes', 'error', 'revisionPendiente'];
function masAvanzada(actual, estado) {
  const suya = actual.total === estado.total && !estado.revisionPendiente && (actual.guardados || 0) > (estado.guardados || 0);
  return suya ? { ...estado, ...Object.fromEntries(PROGRESO.filter(k => k in actual).map(k => [k, actual[k]])) } : estado;
}

async function escribirAvanceViaje(estado) {
  const bd = await abrirViaje();
  return new Promise((ok, mal) => {
    const tx = bd.transaction('obras', 'readwrite');
    const almacen = tx.objectStore('obras');
    let escrito = null;
    const q = almacen.get(estado.id);
    q.onsuccess = () => { if (q.result) almacen.put(escrito = masAvanzada(q.result, { ...estado })); };
    tx.oncomplete = () => { bd.close(); ok(escrito); };
    tx.onerror = () => { bd.close(); mal(tx.error); };
    tx.onabort = () => { bd.close(); mal(tx.error || new Error('Operación local interrumpida.')); };
  });
}
