import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nuevaOperacion as operacion, nuevoId } from '../components/lector/subrayados';
import { crearSincronizador } from '../components/lector/sincronizadorSubrayados';
import { almacenPorDefecto } from '../components/lector/almacenSubrayados';
import { anclaDeSeleccion, anotacionEn, limpiarSubrayados, pintarSubrayados, ubicarAnotaciones }
  from '../components/lector/subrayadoDom';

export default function useSubrayados({ scrollRef, obra, capitulo, variante, claves }) {
  const [todas, setTodas] = useState([]);
  const [pendientes, setPendientes] = useState(0);
  const [seleccion, setSeleccion] = useState(null);
  const [abierta, setAbierta] = useState(null);
  const ubicadasRef = useRef([]);

  const sync = useMemo(() => (window.api?.operarSubrayado
    ? crearSincronizador({ api: window.api, almacen: almacenPorDefecto(), obra: String(obra) }) : null), [obra]);
  const ver = useCallback(r => { if (r) { setTodas(r.anotaciones); setPendientes(r.pendientes); } }, []);

  useEffect(() => {
    if (!sync) return undefined;
    let vivo = true;
    const al = r => { if (vivo) ver(r); };
    const sincronizar = () => sync.sincronizar().then(al).catch(() => {});
    sync.leer().then(al).then(sincronizar);

    const minuto = setInterval(sincronizar, 30000);
    window.addEventListener('focus', sincronizar);
    window.addEventListener('online', sincronizar);
    return () => {
      vivo = false; clearInterval(minuto); limpiarSubrayados();
      window.removeEventListener('focus', sincronizar); window.removeEventListener('online', sincronizar);
    };
  }, [sync, ver]);

  const delCapitulo = todas.filter(a => a.capitulo === capitulo);
  const vivas = delCapitulo.filter(a => !a.eliminado || a.conflicto);
  useEffect(() => {
    const caja = scrollRef.current;
    if (!caja) return undefined;
    let vigente = true;

    const marco = requestAnimationFrame(() => {
      if (!vigente) return;
      ubicadasRef.current = ubicarAnotaciones(caja, vivas, variante, capitulo);
      pintarSubrayados(ubicadasRef.current);
    });
    return () => { vigente = false; cancelAnimationFrame(marco); };

  }, [todas, capitulo, variante, scrollRef, ...(claves || [])]);

  const alSoltar = useCallback(async () => {
    const caja = scrollRef.current;
    if (!caja) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { setSeleccion(null); return; }
    const ancla = await anclaDeSeleccion(caja, { obra: String(obra), capitulo, variante }, sel);
    if (!ancla) { setSeleccion(null); return; }
    const r = sel.getRangeAt(0).getBoundingClientRect();
    setAbierta(null);
    setSeleccion({ capitulo, ancla, x: r.left + r.width / 2, arriba: r.top, abajo: r.bottom });
  }, [scrollRef, obra, capitulo, variante]);

  const alPulsar = useCallback(e => {
    if (window.getSelection()?.toString()) return;
    const hallada = anotacionEn(ubicadasRef.current, e.clientX, e.clientY);
    setAbierta(hallada ? { capitulo: hallada.anotacion.capitulo, id: hallada.anotacion.id, x: e.clientX, y: e.clientY } : null);
  }, []);

  useEffect(() => {
    const caja = scrollRef.current;
    if (!caja) return undefined;
    const alTocar = () => setTimeout(alSoltar, 120);
    caja.addEventListener('mouseup', alSoltar);
    caja.addEventListener('keyup', alSoltar);
    caja.addEventListener('touchend', alTocar);
    caja.addEventListener('click', alPulsar);
    return () => {
      caja.removeEventListener('mouseup', alSoltar); caja.removeEventListener('keyup', alSoltar);
      caja.removeEventListener('touchend', alTocar); caja.removeEventListener('click', alPulsar);
    };
  }, [scrollRef, alSoltar, alPulsar]);

  const aplicar = useCallback(async op => {
    await sync.operar(op);
    ver(await sync.leer());
    return sync.sincronizar().then(r => { ver(r); return r; }).catch(() => null);
  }, [sync, ver]);

  const marcar = useCallback(async (color = 'amarillo', tipo = 'subrayado') => {
    if (!seleccion) return null;
    const id = nuevoId();
    await aplicar(operacion('crear', id, 0, { ancla: seleccion.ancla, color, tipo }));
    window.getSelection()?.removeAllRanges();
    setSeleccion(null);
    if (tipo === 'nota') setAbierta({ capitulo, id, x: seleccion.x, y: seleccion.abajo });
    return id;
  }, [seleccion, aplicar, capitulo]);

  const editar = useCallback((id, cambios) => {
    const a = todas.find(x => x.id === id);
    return a ? aplicar(operacion('editar', id, a.revision, cambios)) : null;
  }, [todas, aplicar]);

  const borrar = useCallback(id => {
    const a = todas.find(x => x.id === id);
    setAbierta(null);
    return a ? aplicar(operacion('borrar', id, a.revision)) : null;
  }, [todas, aplicar]);

  const resolver = useCallback(async (id, quien) => {
    await sync.resolver(id, quien);
    ver(await sync.leer());
    return sync.sincronizar().then(ver).catch(() => {});
  }, [sync, ver]);

  const delActual = x => (x && x.capitulo === capitulo ? x : null);
  return { anotaciones: vivas, conflictos: delCapitulo.filter(a => a.conflicto), pendientes,
    seleccion: delActual(seleccion), abierta: delActual(abierta), marcar, editar, borrar, resolver,
    cerrar: () => { setSeleccion(null); setAbierta(null); } };
}
