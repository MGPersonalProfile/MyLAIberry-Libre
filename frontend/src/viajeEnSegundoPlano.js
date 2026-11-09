export function instalarViajeEnSegundoPlano(sw = navigator.serviceWorker, doc = globalThis.document) {
  if (!window.__MYLAIBERRY_BASE__ || !sw) return;
  const mandar = datos => sw.ready.then(r => r.active?.postMessage(datos)).catch(() => {});
  sw.addEventListener('message', (e) => {
    const { tipo, id, estado } = e.data || {};
    if (tipo !== 'viaje-estado' || !estado || estado.enCurso) return;

    if (estado.error) mandar({ tipo: 'viaje-reanudar' });

    else if (estado.continuar && !estado.esperandoOtraObra) mandar({ tipo: 'viaje-seguir', id });

    else if (estado.terminada) mandar({ tipo: 'viaje-reanudar', conectado: true });
  });
  window.addEventListener('mylaiberry-conexion', (e) => { if (e.detail) mandar({ tipo: 'viaje-reanudar', conectado: true }); });

  doc?.addEventListener?.('visibilitychange', () => {
    if (doc.visibilityState === 'visible') mandar({ tipo: 'viaje-reanudar', conectado: window.__MYLAIBERRY_PC_EN_LINEA__ === true });
  });
  mandar({ tipo: 'viaje-reanudar' });
}
