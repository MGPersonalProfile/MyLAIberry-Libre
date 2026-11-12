import { useCallback, useEffect, useState } from 'react';

const ABIERTOS = ['esperando-persona', 'comprobando', 'no-resuelto'];

const VISIBLES = [...ABIERTOS, 'incompatible'];
const CLAVE_VISTOS = 'mylaiberry-retos-resultados-vistos';
const leerVistos = () => { try { return new Set(JSON.parse(localStorage.getItem(CLAVE_VISTOS) || '[]')); } catch { return new Set(); } };
const guardarVistos = vistos => { try { localStorage.setItem(CLAVE_VISTOS, JSON.stringify([...vistos].slice(-100))); } catch {  } };
const conResultado = r => r.estado === 'reanudado' && !!r.resultado;

export default function useRetosPendientes() {
  const [retos, setRetos] = useState([]);
  const [resultados, setResultados] = useState([]);
  const [ultimo, setUltimo] = useState(null);

  useEffect(() => {
    let vivo = true;
    const avisados = new Set();
    const anotarResultado = r => { if (conResultado(r) && !leerVistos().has(r.id)) setResultados(previos => [...previos.filter(p => p.id !== r.id), r]); };
    window.api?.asistenteRetosPendientes?.().then(lista => {
      if (!vivo || !Array.isArray(lista)) return;
      const nuevos = lista.filter(r => !avisados.has(r.id) && VISIBLES.includes(r.estado));
      setRetos(previos => [...previos, ...nuevos]);
      lista.filter(r => !avisados.has(r.id)).forEach(anotarResultado);
    }).catch(() => {});
    const quitar = window.api?.onAsistenteRetoPendiente?.(dato => {
      avisados.add(dato.id);
      setRetos(previos => [...previos.filter(r => r.id !== dato.id), dato].filter(r => VISIBLES.includes(r.estado)));
      anotarResultado(dato);
      if (!VISIBLES.includes(dato.estado) && !conResultado(dato)) setUltimo(dato);
    });
    return () => { vivo = false; quitar?.(); };
  }, []);

  const actuar = useCallback(async (metodo, reto) => {
    try {
      const r = await window.api?.[metodo]?.(reto.id, reto.token);
      if (r && !VISIBLES.includes(r.estado) && !conResultado(r)) setUltimo(r);
      if (r) setRetos(previos => previos.map(p => (p.id === r.id ? { ...p, ...r, token: p.token } : p)).filter(p => VISIBLES.includes(p.estado)));
    } catch (e) { setUltimo({ ...reto, estado: 'error', mensaje: String(e?.message || e) }); }
  }, []);

  const verResultado = useCallback(reto => window.api?.asistenteRetoResultado?.(reto.id, reto.token), []);
  const descartarResultado = useCallback(reto => {
    const vistos = leerVistos();
    vistos.add(reto.id);
    guardarVistos(vistos);
    setResultados(previos => previos.filter(p => p.id !== reto.id));
  }, []);

  return { retos, resultados, ultimo, cerrarUltimo: () => setUltimo(null), verResultado, descartarResultado,
    reanudar: reto => actuar('asistenteRetoReanudar', reto), cancelar: reto => actuar('asistenteRetoCancelar', reto),
    reabrir: reto => actuar('asistenteRetoReabrir', reto) };
}
