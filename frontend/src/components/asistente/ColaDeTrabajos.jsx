import { useState, useEffect, useCallback } from 'react';
import { Pause, Play, RefreshCw } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';

const TIPOS = ['descargar-capitulos', 'comprobar-capitulos', 'traducir-sinopsis', 'clasificar-genero',
  'comprobar-autor', 'comprobar-busqueda', 'importar-marcadores', 'buscar-fondos'];

export default function ColaDeTrabajos({ Accion, tarjeta }) {
  const { t } = useI18n();
  const [estado, setEstado] = useState(null);
  const [error, setError] = useState(null);
  const [vuelta, setVuelta] = useState(0);
  const leer = useCallback(() => setVuelta(n => n + 1), []);
  const disponible = !!window.api?.estadoDeLaCola;

  useEffect(() => {
    if (!disponible) return;
    let vivo = true;
    window.api.estadoDeLaCola()
      .then(r => { if (!vivo) return; if (r?.status === 'ok') { setEstado(r); setError(null); } else setError(r?.message || t('queue.failed')); })
      .catch(e => { if (vivo) setError(e?.message || t('queue.failed')); });
    return () => { vivo = false; };
  }, [disponible, vuelta, t]);
  if (!disponible) return null;

  const pausar = async () => {
    try { await window.api.pausarLaCola(estado?.enMarcha); } catch (e) { setError(e?.message || t('queue.failed')); }
    leer();
  };

  const tipos = Object.entries(estado?.porTipo || {}).sort((a, b) => b[1] - a[1]);
  return (
    <div className={tarjeta} data-cola-de-trabajos>
      <div className="flex items-center justify-between gap-3">
        <p className="leading-snug">
          {!estado ? '…' : !estado.enMarcha ? t('queue.paused') : tipos.length ? t('queue.working') : t('queue.idle')}
        </p>
        <div className="flex gap-1.5 shrink-0">
          <Accion onClick={leer} icono={RefreshCw}>{t('queue.refresh')}</Accion>
          {estado && (
            <Accion onClick={pausar} icono={estado.enMarcha ? Pause : Play}>
              {estado.enMarcha ? t('queue.pause') : t('queue.resume')}
            </Accion>
          )}
        </div>
      </div>
      {tipos.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[12px] opacity-80">
          {tipos.map(([tipo, n]) => (
            <li key={tipo}>{TIPOS.includes(tipo) ? t(`queue.type.${tipo}`) : tipo} · {n}</li>
          ))}
        </ul>
      )}
      {estado && !estado.enMarcha && (
        <p className="text-[11px] text-amber-400/80 mt-2">
          {estado.reanudaA ? t('queue.resumes_at', { hora: new Date(estado.reanudaA).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }) : t('queue.paused_note')}
        </p>
      )}
      {error && <p className="text-[11px] text-red-400 mt-2" role="alert">{error}</p>}
    </div>
  );
}
