import { useCallback, useEffect, useState } from 'react';

const ABIERTOS = ['esperando-persona', 'comprobando', 'no-resuelto'];

export default function useRetosPendientes() {
  const [retos, setRetos] = useState([]);
  const [ultimo, setUltimo] = useState(null);

  useEffect(() => {
    let vivo = true;
    const avisados = new Set();
    window.api?.asistenteRetosPendientes?.().then(lista => {
      if (!vivo || !Array.isArray(lista)) return;
      const nuevos = lista.filter(r => !avisados.has(r.id) && ABIERTOS.includes(r.estado));
      setRetos(previos => [...previos, ...nuevos]);
    }).catch(() => {});
    const quitar = window.api?.onAsistenteRetoPendiente?.(dato => {
      avisados.add(dato.id);
      setRetos(previos => [...previos.filter(r => r.id !== dato.id), dato].filter(r => ABIERTOS.includes(r.estado)));
      if (!ABIERTOS.includes(dato.estado)) setUltimo(dato);
    });
    return () => { vivo = false; quitar?.(); };
  }, []);

  const actuar = useCallback(async (metodo, reto) => {
    try {
      const r = await window.api?.[metodo]?.(reto.id, reto.token);
      if (r && !ABIERTOS.includes(r.estado)) setUltimo(r);
      if (r) setRetos(previos => previos.map(p => (p.id === r.id ? { ...p, ...r, token: p.token } : p)).filter(p => ABIERTOS.includes(p.estado)));
    } catch (e) { setUltimo({ ...reto, estado: 'error', mensaje: String(e?.message || e) }); }
  }, []);

  return { retos, ultimo, cerrarUltimo: () => setUltimo(null),
    reanudar: reto => actuar('asistenteRetoReanudar', reto), cancelar: reto => actuar('asistenteRetoCancelar', reto) };
}
