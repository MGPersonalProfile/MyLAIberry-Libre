import { useState, useEffect, useCallback, useRef } from 'react';
import { desdeLectura, fusionar, deInvestigacion, esViva, esTerminal, obsoleta, claveNueva, CADUCIDAD_MS } from '../ejecuciones.js';
import { esSinConexion } from '../avisos.js';

const SONDEO_MS = 8000;
const REINTENTOS_DE_ENVIO = 2;

export default function useEjecucionesInvestigacion({ sondeoMs = SONDEO_MS, caducidadMs = CADUCIDAD_MS, alTerminar } = {}) {
  const api = window.api;
  const disponible = !!api?.asistenteEjecuciones;
  const [mapa, setMapa] = useState({});
  const [leidoEn, setLeidoEn] = useState(0);
  const [reloj, setReloj] = useState(() => Date.now());
  const [error, setError] = useState(null);
  const vivo = useRef(true);

  const terminadas = useRef(null);
  const alTerminarRef = useRef(alTerminar);
  useEffect(() => { alTerminarRef.current = alTerminar; });
  const vigilarFin = useCallback((lista) => {
    const ids = lista.filter(e => esTerminal(e.estado)).map(e => e.executionId);
    const nuevas = terminadas.current ? ids.filter(id => !terminadas.current.has(id)) : [];
    terminadas.current = new Set([...(terminadas.current || []), ...ids]);
    if (nuevas.length) alTerminarRef.current?.();
  }, []);

  const leer = useCallback(async () => {
    if (!disponible) return;
    try {
      const r = await api.asistenteEjecuciones();
      if (!vivo.current) return;
      if (r?.status === 'ok') { vigilarFin(r.ejecuciones || []); setMapa(m => desdeLectura(m, r)); setLeidoEn(Date.now()); }
    } catch (e) { if (!esSinConexion(e) && vivo.current) setError(e?.message || 'No se pudo leer el estado.'); }
  }, [api, disponible, vigilarFin]);

  useEffect(() => {
    vivo.current = true;
    const primera = setTimeout(leer, 0);
    const alVolver = () => { if (document.visibilityState !== 'hidden') leer(); };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('online', leer);
    const quitar = api?.onAsistenteEjecucion?.(e => { vigilarFin([e]); setMapa(m => fusionar(m, e)); });
    return () => { vivo.current = false; clearTimeout(primera); document.removeEventListener('visibilitychange', alVolver); window.removeEventListener('online', leer); quitar?.(); };
  }, [api, leer, vigilarFin]);

  const algunaViva = Object.values(mapa).some(esViva);
  useEffect(() => {
    if (!algunaViva) return;
    const t = setInterval(() => { setReloj(Date.now()); leer(); }, sondeoMs);
    return () => clearInterval(t);
  }, [algunaViva, leer, sondeoMs]);

  const enviar = useCallback(async (action, args) => {
    setError(null);
    const clave = claveNueva();
    for (let i = 0; ; i++) {
      try {
        const r = await api.asistenteAccion({ action, args: { ...args, clave } });
        if (r?.status !== 'ok') { setError(r?.message || 'No se pudo completar.'); return null; }
        if (r.resultado?.ejecucion) setMapa(m => fusionar(m, r.resultado.ejecucion));
        leer();
        return r.resultado;
      } catch (e) {
        if (!esSinConexion(e) || i >= REINTENTOS_DE_ENVIO) { setError(esSinConexion(e) ? 'Sin conexión con el servidor: no se sabe si se ha lanzado. Comprueba el estado cuando vuelva.' : (e?.message || 'No se pudo completar.')); return null; }
      }
    }
  }, [api, leer]);

  return {
    disponible, error, desactualizado: algunaViva && obsoleta(leidoEn, reloj, caducidadMs),
    de: id => deInvestigacion(mapa, id), refrescar: leer,
    iniciar: id => enviar('startInvestigation', { id }),
    cancelar: executionId => enviar('cancelInvestigation', { executionId }),
    reintentar: executionId => enviar('retryInvestigation', { executionId })
  };
}
