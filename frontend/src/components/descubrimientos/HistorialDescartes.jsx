import { useEffect, useState, useCallback } from 'react';
import { History, RotateCcw } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { SecondaryButton } from '../ui/Buttons';
import { avisar } from '../../avisos';

function ElementoDescarte({ obra, recuperando, onRecuperar, t }) {
  return (
    <li className="flex items-center justify-between gap-2 py-1.5 border-b border-border/40 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-small font-medium text-text-primary line-clamp-1">{obra.title}</p>
        <p className="text-caption text-text-secondary line-clamp-1">
          {[obra.author, obra.source].filter(Boolean).join(' · ')}
        </p>
      </div>
      <SecondaryButton
        size="sm"
        icon={RotateCcw}
        disabled={recuperando === obra.id}
        onClick={() => onRecuperar(obra)}
      >
        {t('pending.recover')}
      </SecondaryButton>
    </li>
  );
}

export default function HistorialDescartes({ alCambiar }) {
  const { t } = useI18n();
  const [lista, setLista] = useState([]);
  const [recuperando, setRecuperando] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const res = await window.api?.getDescartesRecientes?.();
      setLista(Array.isArray(res) ? res : []);
    } catch {
      setLista([]);
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    window.api?.getDescartesRecientes?.()
      .then(res => { if (vivo) setLista(Array.isArray(res) ? res : []); })
      .catch(() => { if (vivo) setLista([]); });
    const cancelar = window.api?.onDiscoveriesUpdated?.(() => {
      window.api?.getDescartesRecientes?.()
        .then(res => { if (vivo) setLista(Array.isArray(res) ? res : []); })
        .catch(() => { if (vivo) setLista([]); });
    });
    return () => {
      vivo = false;
      cancelar?.();
    };
  }, []);

  const recuperar = async (obra) => {
    setRecuperando(obra.id);
    try {
      const r = await window.api?.deshacerDescarte?.(obra.id);
      if (r?.status === 'ok') {
        avisar(t('aviso.descarte_deshecho', { titulo: obra.title }));
        await cargar();
        await alCambiar?.();
      }
    } finally {
      setRecuperando(null);
    }
  };

  return (
    <details className="mt-4 rounded-lg border border-border/70 bg-surface p-3 text-small text-text-primary">
      <summary className="cursor-pointer font-medium flex items-center gap-2">
        <History className="w-4 h-4 text-text-secondary" />
        <span>{t('pending.discard_history')}</span>
        {lista.length > 0 && (
          <span className="text-caption text-text-tertiary">({lista.length})</span>
        )}
      </summary>
      <div className="mt-3">
        {!lista.length && (
          <p className="text-caption text-text-tertiary">{t('pending.no_discarded')}</p>
        )}
        {lista.length > 0 && (
          <ul className="space-y-1">
            {lista.map(o => (
              <ElementoDescarte
                key={o.id}
                obra={o}
                recuperando={recuperando}
                onRecuperar={recuperar}
                t={t}
              />
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
