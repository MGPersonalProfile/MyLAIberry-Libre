import { useState, useEffect, useCallback, useMemo } from 'react';
import { clavePunto, puntoDeClave } from '../punto';
import { esSinConexion } from '../avisos';

export default function useIniciativa(punto = null, { solo = null } = {}) {
  const disponible = !!window.api?.asistenteVer;

  const clave = clavePunto(punto);

  const puntoEstable = useMemo(() => puntoDeClave(clave), [clave]);

  const soloClave = Array.isArray(solo) ? solo.join(',') : '';
  const [vista, setVista] = useState(null);

  const [cargando, setCargando] = useState(disponible);
  const [error, setError] = useState(null);
  const [vuelta, setVuelta] = useState(0);
  const refrescar = useCallback(() => setVuelta(n => n + 1), []);

  useEffect(() => {
    if (!disponible) return;
    let vivo = true;

    window.api.asistenteVer(puntoEstable, soloClave ? { solo: soloClave.split(',') } : undefined)
      .then(r => {
        if (!vivo) return;
        if (r?.status === 'ok') setVista(r.vista);
        else setError(r?.message || 'No se pudo leer el estado del asistente.');
      })

      .catch(e => { if (vivo && !esSinConexion(e)) setError(e?.message || 'No se pudo leer el estado del asistente.'); })
      .finally(() => { if (vivo) setCargando(false); });

    return () => { vivo = false; };
  }, [disponible, vuelta, puntoEstable, soloClave]);

  const accion = useCallback(async (action, args = {}) => {
    if (!disponible) return { ok: false };
    setError(null);
    try {
      const r = await window.api.asistenteAccion({ action, args, point: puntoEstable });
      if (r?.status !== 'ok') { setError(r?.message || 'No se pudo completar.'); return { ok: false }; }
      refrescar();
      return { ok: true, resultado: r.resultado };
    } catch (e) {
      setError(e?.message || 'No se pudo completar.');
      return { ok: false };
    }
  }, [disponible, refrescar, puntoEstable]);

  const hoy = new Date().toISOString().slice(0, 10);
  const consumo = vista?.usage?.[hoy] || { calls: 0, background: 0, input: 0, output: 0 };

  return {
    disponible, cargando, error, refrescar, accion, consumo,
    ajustes: vista?.settings || null,

    modelos: vista?.modelos || [],
    avisos: vista?.inbox || [],
    investigaciones: vista?.investigations || [],
    radar: vista?.radar || [],
    memoria: vista?.preferences || [],
    estanterias: vista?.shelves || [],

    deshacibles: vista?.undo || [],
    operaciones: vista?.operations || [],
    propuestas: vista?.changes || [],

    buzon: vista?.buzon || [],
    reglas: vista?.translationRules || [],

    notas: vista?.notes || [],
    teorias: vista?.theories || []
  };
}
