import { useEffect, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { SecondaryButton } from '../ui/Buttons';
import { Notice } from '../ui/Feedback';
import { prepararAlmacenamiento } from './espacioViaje';
import { guardarConElNavegador } from './fondoViaje';
import { textoDeViaje } from './textoViaje';
import { llevarAnotacionesDeViaje } from './anotacionesDeViaje';
import {
  textosConflicto,
  leerConflictoLocal,
  guardarConflictoLocal,
  resolverUsandoPC,
  resolverConservandoMovil
} from './conflictoIdioma';

const almacenPwa = {
  leer: async (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  guardar: async (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { return false; } },
  borrar: async (k) => { try { localStorage.removeItem(k); } catch { return false; } }
};

export function AvisoConflictoIdioma({ conflicto, onConservar, onUsarPC }) {
  if (!conflicto) return null;
  const t = textosConflicto();
  return (
    <div className="p-3 my-2 border border-warning/40 bg-warning/10 rounded-lg text-sm text-center space-y-2" aria-live="assertive">
      <p className="text-warning font-medium">{t.aviso}</p>
      <div className="flex justify-center gap-2">
        <button type="button" onClick={onConservar} className="px-2 py-1 text-xs rounded bg-surface-raised border hover:bg-surface-hover">
          {t.conservarMovil}
        </button>
        <button type="button" onClick={onUsarPC} className="px-2 py-1 text-xs rounded bg-surface-raised border hover:bg-surface-hover">
          {t.usarPC}
        </button>
      </div>
    </div>
  );
}

function useViajeObra(obraId, total, disponible, obra) {
  const [estado, setEstado] = useState(null);
  const [activo, setActivo] = useState(false);
  const [libres, setLibres] = useState(null);
  const [necesarios, setNecesarios] = useState(null);

  useEffect(() => {
    if (!disponible) return undefined;
    let vivo = true;
    let estadoActual = null;
    let reintentoInicial = false;
    const continuar = () => {
      navigator.serviceWorker.ready.then(r => r.active?.postMessage({ tipo: 'viaje-seguir', id: String(obraId) }));
    };
    const recibir = (e) => {
      if (vivo && e.data?.tipo === 'viaje-estado' && e.data.id === String(obraId)) {
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
    navigator.serviceWorker.ready.then(r => r.active?.postMessage({ tipo: 'viaje-estado', id: String(obraId) }));
    prepararAlmacenamiento(navigator.storage, { total, ficha: obra }).then(espacio => {
      if (vivo) {
        if (espacio.disponibles !== null) setLibres(Math.floor(espacio.disponibles / 1048576));
        if (espacio.necesarios) setNecesarios(Math.max(1, Math.ceil(espacio.necesarios / 1048576)));
      }
    }).catch(() => {});
    const pulso = setInterval(() => navigator.serviceWorker.ready.then(r =>
      r.active?.postMessage({ tipo: 'viaje-estado', id: String(obraId) })), 5000);
    return () => {
      vivo = false; clearInterval(pulso);
      navigator.serviceWorker.removeEventListener('message', recibir);
      window.removeEventListener('mylaiberry-conexion', reconectar);
    };
  }, [obraId, total, disponible, obra]);

  return { estado, setEstado, activo, setActivo, libres, setLibres, necesarios };
}

export default function GuardarSinConexion({ obra }) {
  const [persistente, setPersistente] = useState(null);
  const [conflicto, setConflicto] = useState(null);
  const total = Math.max(obra.chapterList?.length || 0, obra.totalChapters || 0);
  const disponible = !!window.__MYLAIBERRY_BASE__ && 'serviceWorker' in navigator && total > 0;
  const { estado, setEstado, activo, setActivo, libres, setLibres, necesarios } = useViajeObra(obra.id, total, disponible, obra);

  useEffect(() => {
    if (window.api?.leerEleccionIdioma) {
      window.api.leerEleccionIdioma(obra.id).then(r => {
        if (r?.status === 'ok' && estado?.idioma && r.idioma !== estado.idioma) {
          const c = { obraId: obra.id, local: { idioma: estado.idioma }, pc: { idioma: r.idioma, revision: r.revision } };
          guardarConflictoLocal(almacenPwa, obra.id, c);
          setConflicto(c);
        }
      }).catch(() => {});
    }
    leerConflictoLocal(almacenPwa, obra.id).then(setConflicto).catch(() => {});
  }, [obra.id, estado?.idioma]);

  const resolverMovil = async () => {
    if (window.api?.resolverEleccionIdioma) {
      await resolverConservandoMovil(almacenPwa, obra.id, window.api);
    }
    setConflicto(null);
  };
  const resolverPC = async () => {
    await resolverUsandoPC(almacenPwa, obra.id);
    setConflicto(null);
  };

  if (!disponible) return null;

  const enviar = async (tipo) => {
    if (tipo === 'viaje-guardar' || tipo === 'viaje-refrescar') {
      const espacio = await prepararAlmacenamiento(navigator.storage, { total, guardados: estado?.guardados || 0, ficha: obra });
      if (espacio.disponibles !== null) setLibres(Math.floor(espacio.disponibles / 1048576));
      if (!espacio.permitido) { setEstado(prev => ({ ...prev, error: espacio.motivo || 'No queda espacio en este navegador.' })); return; }
      setPersistente(espacio.persistente);
      setActivo(true); setEstado(prev => prev && { ...prev, error: null });
    }

    if (tipo === 'viaje-guardar' || tipo === 'viaje-refrescar') llevarAnotacionesDeViaje(window.api, obra.id).catch(() => {});
    const r = await navigator.serviceWorker.ready;

    const ficha = JSON.parse(JSON.stringify(obra));

    if (tipo === 'viaje-guardar') {
      await guardarConElNavegador(r, navigator.serviceWorker, { id: String(obra.id), desde: estado?.guardados || 0, total, ficha });
      return;
    }
    r.active?.postMessage({ tipo, id: String(obra.id), total, ...(tipo === 'viaje-borrar' ? {} : { ficha }) });
  };

  const completo = estado?.completa && estado.total === total;

  return (
    <div className="mb-5 text-center space-y-2" aria-live="polite">
      <SecondaryButton
        icon={Download}
        onClick={() => enviar('viaje-guardar')}
        disabled={activo || completo}
        className="w-full"
      >
        {textoDeViaje(estado, total, activo)}
      </SecondaryButton>
      {completo && estado.idioma && <p className="text-caption text-text-tertiary">Original y traducción ({estado.idioma})</p>}
      {estado?.error && <Notice variant="warning" compact>{estado.error}</Notice>}
      <AvisoConflictoIdioma conflicto={conflicto} onConservar={resolverMovil} onUsarPC={resolverPC} />
      {libres !== null && (
        <p className="text-caption text-text-tertiary">
          {necesarios ? `${necesarios} MB necesarios · ` : ''}{libres} MB disponibles aprox. en este navegador
        </p>
      )}
      {persistente === false && <p className="text-caption text-warning">El navegador podría borrar esta copia si necesita espacio.</p>}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {completo && !activo && (
          <button type="button" onClick={() => enviar('viaje-refrescar')} className="text-caption text-text-secondary underline underline-offset-2">
            Revisar cambios en los capítulos
          </button>
        )}
        {estado && !estado.cancelando && (
          <button type="button" onClick={() => enviar('viaje-borrar')} className="text-caption text-text-secondary inline-flex items-center gap-1">
            <Trash2 className="w-3 h-3" /> {activo ? 'Cancelar y borrar la copia' : 'Borrar copia del móvil'}
          </button>
        )}
      </div>
    </div>
  );
}
