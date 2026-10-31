import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { clavePunto, puntoDeClave } from '../punto';

const esProvisional = (id) => typeof id === 'string' && id.startsWith('nueva:');

const sin = (obj, clave) => Object.fromEntries(Object.entries(obj).filter(([k]) => k !== clave));

const nuevoId = () => (globalThis.crypto?.randomUUID
  ? globalThis.crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);

export default function useAsistente(punto = null) {
  const [hilos, setHilos] = useState({});
  const [hiloId, setHiloId] = useState(null);
  const [enCurso, setEnCurso] = useState({});
  const [errores, setErrores] = useState({});
  const [vista, setVista] = useState(null);

  const [sinLeer, setSinLeer] = useState({});
  const mirando = useRef(null);
  const peticiones = useRef(new Map());

  const disponible = !!window.api?.asistenteChat;
  useEffect(() => window.api?.onAsistenteInvestigacionProgreso?.(dato => {
    const clave = peticiones.current.get(dato.requestId);
    if (clave) setEnCurso(e => (e[clave] ? { ...e, [clave]: { ...e[clave], progreso: dato } } : e));
  }), []);

  const clave = clavePunto(punto);

  const puntoEstable = useMemo(() => puntoDeClave(clave), [clave]);

  const actual = hiloId || '';
  useEffect(() => { mirando.current = hiloId; }, [hiloId]);
  const pensando = !!enCurso[actual];

  const [vuelta, setVuelta] = useState(0);
  const refrescar = useCallback(() => setVuelta(n => n + 1), []);

  useEffect(() => {
    if (!disponible) return;
    let vivo = true;

    window.api.asistenteVer(puntoEstable)
      .then(r => {
        if (!vivo || r?.status !== 'ok') return;
        setVista(r.vista);

        if (hiloId && !esProvisional(hiloId) && !pensando) {
          const guardado = r.vista.threads?.find(h => h.id === hiloId);
          if (guardado) setHilos(h => ({ ...h, [hiloId]: guardado.messages.map(mensajeGuardado) }));
        }
      })
      .catch(() => {  });

    return () => { vivo = false; };
  }, [disponible, puntoEstable, vuelta, hiloId, pensando]);

  const abrirHilo = useCallback((id) => {
    const guardado = vista?.threads?.find(h => h.id === id);
    const destino = guardado?.id || (id && (enCurso[id] || hilos[id]) ? id : null);
    setHiloId(destino);

    if (guardado && !enCurso[guardado.id] && !guardado.recienCreada) setHilos(h => ({ ...h, [guardado.id]: guardado.messages.map(mensajeGuardado) }));
    if (!destino) setHilos(h => sin(h, ''));

    if (!sinLeer[destino || '']) setErrores(e => ({ ...e, [destino || '']: null }));
    setSinLeer(s => sin(s, destino || ''));
  }, [vista, enCurso, hilos, sinLeer]);

  const borrarHilo = useCallback(async (id) => {
    if (enCurso[id]) return false;
    try {
      const r = await window.api.asistenteAccion({ action: 'deleteThread', args: { id }, point: puntoEstable });
      if (r?.status !== 'ok') throw new Error(r?.message || 'No se pudo borrar la conversación.');
      if (id === hiloId) abrirHilo(null);
      refrescar();
      return true;
    } catch (e) { setErrores(x => ({ ...x, [id]: e.message })); return false; }
  }, [enCurso, puntoEstable, hiloId, abrirHilo, refrescar]);

  const preguntar = useCallback(async (texto, { fuera = false } = {}) => {
    const limpio = String(texto || '').trim();
    if (!limpio || pensando || !disponible) return;

    const requestId = nuevoId();

    const conversacion = hiloId && !esProvisional(hiloId) ? hiloId : `nueva:${requestId}`;
    const previos = hilos[actual] || [];
    setHilos(h => ({ ...sin(h, actual), [conversacion]: [...previos, { rol: 'user', texto: limpio, point: puntoEstable, id: 'u' + Date.now() }] }));
    setHiloId(conversacion);
    setEnCurso(e => ({ ...e, [conversacion]: { requestId, progreso: null } }));
    setErrores(e => ({ ...e, [conversacion]: null }));
    peticiones.current.set(requestId, conversacion);

    const avisarSiMiraOtra = (destino) => {
      if (mirando.current !== conversacion && mirando.current !== destino) setSinLeer(s => ({ ...s, [destino]: true }));
    };
    const trasladar = (destino) => {
      if (!destino || destino === conversacion) return;
      setHilos(h => ({ ...sin(h, conversacion), [destino]: h[conversacion] || [] }));
      setHiloId(id => (id === conversacion ? destino : id));
      setVista(v => (v?.threads && !v.threads.some(t => t.id === destino)
        ? { ...v, threads: [...v.threads, { id: destino, title: limpio.slice(0, 80), createdAt: Date.now(), messages: [], recienCreada: true }] } : v));
    };

    try {
      const r = await window.api.asistenteChat({ text: limpio, point: puntoEstable, threadId: esProvisional(conversacion) ? null : conversacion, fuera, requestId });
      if (r?.status === 'ok') {
        const destino = r.threadId || conversacion;
        trasladar(destino);

        const retiradas = new Set(r.answer?.retiradas || []);
        const sinRetiradas = (m) => (m.pendientes?.some(p => retiradas.has(p.id))
          ? { ...m, pendientes: m.pendientes.map(p => (retiradas.has(p.id) ? { ...p, estado: 'cancelado' } : p)) } : m);
        setHilos(h => {

          const suyos = h[conversacion] || h[destino] || [];
          return { ...sin(h, conversacion), [destino]: [...suyos.map(sinRetiradas), {
            rol: 'assistant',
            point: puntoEstable,
            texto: r.answer?.text || '',
            citas: r.answer?.citations || [],
            acciones: r.answer?.actions || [],
            obras: r.answer?.vistas || [],
            capturas: r.answer?.capturas || [],
            costeEstimado: r.answer?.costeEstimado || null,

            pendientes: (r.answer?.pendientes || []).map(p => ({ ...p, estado: 'pendiente' })),
            id: r.answer?.id || 'a' + Date.now()
          }] };
        });
        avisarSiMiraOtra(destino);
        refrescar();
      } else {

        trasladar(r?.threadId);

        if (!/cancelad/i.test(r?.message || '')) avisarSiMiraOtra(r?.threadId || conversacion);
        setErrores(e => ({ ...e, [r?.threadId || conversacion]: r?.message || 'El asistente no ha podido responder.' }));
        if (r?.threadId) refrescar();
      }
    } catch (e) {
      setErrores(x => ({ ...x, [conversacion]: e?.message || 'El asistente no ha podido responder.' }));

      refrescar();
    } finally {
      setEnCurso(e => sin(e, conversacion));
      peticiones.current.delete(requestId);
    }
  }, [pensando, disponible, hiloId, hilos, actual, refrescar, puntoEstable]);

  const cancelar = useCallback(async () => {
    const requestId = enCurso[actual]?.requestId;
    if (!disponible || !requestId) return;
    await window.api.asistenteAccion({ action: 'cancel', args: { requestId }, point: puntoEstable }).catch(() => {});
  }, [disponible, enCurso, actual, puntoEstable]);

  const decidir = useCallback(async (id, hacer) => {
    const poner = (cambio) => setHilos(hs => Object.fromEntries(Object.entries(hs).map(([k, h]) => [k, h.map(m => (m.pendientes?.some(p => p.id === id)
      ? { ...m, pendientes: m.pendientes.map(p => (p.id === id ? { ...p, ...cambio } : p)) } : m))])));
    poner({ estado: 'enviando' });
    const r = await window.api.asistenteAccion({ action: hacer ? 'confirm' : 'reject', args: { id } })
      .catch(e => ({ status: 'error', message: e?.message }));
    poner(r?.status === 'ok' ? { estado: hacer ? 'hecho' : 'cancelado' } : { estado: 'error', error: r?.message || '' });
    refrescar();
  }, [refrescar]);

  const visible = (hilos[actual] || []).filter(m => !puntoEstable ? !m.point : m.point
    && m.point.workId === puntoEstable.workId && (m.point.chapter < puntoEstable.chapter
      || (m.point.chapter === puntoEstable.chapter && m.point.paragraph <= puntoEstable.paragraph)));

  const respondiendo = Object.keys(enCurso);
  const nuevas = Object.keys(hilos).filter(k => esProvisional(k) && (enCurso[k] || k === actual))
    .map(k => ({ id: k, title: hilos[k][0]?.texto?.slice(0, 80) || '' }));
  return { hilo: visible, hiloId, abrirHilo, borrarHilo, pensando, respondiendo, nuevas, sinLeer: Object.keys(sinLeer), progreso: enCurso[actual]?.progreso || null,
    error: errores[actual] || null, vista, disponible, preguntar, cancelar, refrescar, decidir };
}

function mensajeGuardado(m) {
  return { id: m.id, rol: m.role, texto: m.text, point: m.point, citas: m.citations || [],
    acciones: m.actions || [], obras: m.vistas || [], capturas: m.capturas || [], costeEstimado: m.costeEstimado || null,
    pendientes: m.pendientes || [] };
}
