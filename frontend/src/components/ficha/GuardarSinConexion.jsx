import { useEffect, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { prepararAlmacenamiento } from './espacioViaje';

export default function GuardarSinConexion({ obra }) {
  const [estado, setEstado] = useState(null);
  const [activo, setActivo] = useState(false);
  const [libres, setLibres] = useState(null);
  const [persistente, setPersistente] = useState(null);
  const total = Math.max(obra.chapterList?.length || 0, obra.totalChapters || 0);
  const disponible = !!window.__MYLAIBERRY_BASE__ && 'serviceWorker' in navigator && total > 0;

  useEffect(() => {
    if (!disponible) return undefined;
    let vivo = true;
    let estadoActual = null;
    let reintentoInicial = false;
    const continuar = () => {

      navigator.serviceWorker.ready.then(r => r.active?.postMessage({ tipo: 'viaje-seguir', id: String(obra.id) }));
    };
    const recibir = (e) => {
      if (vivo && e.data?.tipo === 'viaje-estado' && e.data.id === String(obra.id)) {
        estadoActual = e.data.estado;
        setEstado(prev => !e.data.estado ? null : e.data.estado.error || e.data.estado.enCurso
          ? e.data.estado : { ...e.data.estado, error: prev?.error });
        setActivo(!!(estadoActual?.enCurso || estadoActual?.continuar) && !estadoActual?.error);
        if (estadoActual?.continuar && !estadoActual.enCurso && !estadoActual.error
          && !estadoActual.esperandoOtraObra) continuar();
        if (estadoActual?.reintentarAlConectar && window.__MYLAIBERRY_PC_EN_LINEA__ && !reintentoInicial) {
          reintentoInicial = true;
          continuar();
        }
      }
    };
    const reconectar = e => { if (e.detail && estadoActual?.reintentarAlConectar) continuar(); };
    navigator.serviceWorker.addEventListener('message', recibir);
    window.addEventListener('mylaiberry-conexion', reconectar);
    navigator.serviceWorker.ready.then(r => r.active?.postMessage({ tipo: 'viaje-estado', id: String(obra.id) }));
    navigator.storage?.estimate?.().then(({ usage, quota }) => {
      if (vivo && Number.isFinite(quota - usage)) setLibres(Math.max(0, Math.floor((quota - usage) / 1048576)));
    }).catch(() => {});
    const pulso = setInterval(() => navigator.serviceWorker.ready.then(r =>
      r.active?.postMessage({ tipo: 'viaje-estado', id: String(obra.id) })), 5000);
    return () => { vivo = false; clearInterval(pulso); navigator.serviceWorker.removeEventListener('message', recibir);
      window.removeEventListener('mylaiberry-conexion', reconectar); };
  }, [obra.id, total, disponible]);

  if (!disponible) return null;
  const enviar = async (tipo) => {
    if (tipo === 'viaje-guardar' || tipo === 'viaje-refrescar') {
      const espacio = await prepararAlmacenamiento(navigator.storage);
      if (espacio.libres !== null) setLibres(Math.floor(espacio.libres / 1048576));
      if (!espacio.permitido) { setEstado(prev => ({ ...prev, error: 'No queda espacio en este navegador.' })); return; }
      setPersistente(espacio.persistente);
      setActivo(true); setEstado(prev => prev && { ...prev, error: null });
    }
    const r = await navigator.serviceWorker.ready;
    r.active?.postMessage({ tipo, id: String(obra.id), total });
  };
  const guardados = estado?.guardados || 0;
  const completo = estado?.completa && estado.total === total;
  const actualizar = estado?.completa && estado.total < total;
  return (
    <div className="mb-5 text-center" aria-live="polite">
      <button type="button" onClick={() => enviar('viaje-guardar')} disabled={activo || completo}
        className="w-full h-12 rounded-lg bg-gray-700 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-70">
        <Download className="w-5 h-5" />
        {activo ? `Guardando en este móvil · ${guardados}/${total}`
          : completo ? `Original sin conexión · ${total} capítulos`
            : actualizar ? `Actualizar copia · ${estado.total} → ${total} capítulos`
              : guardados ? `Reanudar descarga · ${guardados}/${total}` : `Guardar ${total} capítulos en este móvil`}
      </button>
      {estado?.error && <p className="text-sm text-amber-400 mt-2">{estado.error}</p>}
      {libres !== null && <p className="text-xs text-gray-500 mt-2">{libres} MB libres aprox. en este navegador</p>}
      {persistente === false && <p className="text-xs text-amber-400 mt-1">El navegador podría borrar esta copia si necesita espacio.</p>}
      {completo && !activo && <button type="button" onClick={() => enviar('viaje-refrescar')}
        className="text-xs text-gray-400 mt-2 underline underline-offset-2">Revisar cambios en los capítulos</button>}
      {estado && !estado.cancelando && <button type="button" onClick={() => enviar('viaje-borrar')}
        className="text-xs text-gray-400 mt-2 ml-3 inline-flex items-center gap-1"><Trash2 className="w-3 h-3" /> {activo ? 'Cancelar y borrar la copia' : 'Borrar copia del móvil'}</button>}
    </div>
  );
}
