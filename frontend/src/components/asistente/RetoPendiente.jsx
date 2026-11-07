import { ShieldAlert } from 'lucide-react';
import useRetosPendientes from '../../hooks/useRetosPendientes';
import { useI18n } from '../../i18n/I18nContext';

export default function RetoPendiente() {
  const { t } = useI18n();
  const { retos, ultimo, cerrarUltimo, reanudar, cancelar } = useRetosPendientes();
  if (!retos.length && !ultimo) return null;
  return (
    <div className="px-4 md:px-6 pt-2 space-y-2" role="status">
      {retos.map(reto => (
        <div key={reto.id} className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <p className="flex items-center gap-2"><ShieldAlert className="w-4 h-4 shrink-0" />{t('assistant.reto.needs', { site: reto.sitio })}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <a href={reto.url} target="_blank" rel="noopener noreferrer" className="min-h-[44px] px-3 inline-flex items-center rounded bg-white/10">{t('assistant.reto.open')}</a>
            <button onClick={() => reanudar(reto)} disabled={reto.estado === 'comprobando'} className="min-h-[44px] px-3 rounded bg-white/10">{t('assistant.reto.retry')}</button>
            <button onClick={() => cancelar(reto)} className="min-h-[44px] px-3 rounded opacity-70">{t('assistant.reto.cancel')}</button>
          </div>
        </div>
      ))}
      {ultimo && (
        <button onClick={cerrarUltimo} className="text-left w-full text-xs opacity-80">
          {ultimo.mensaje || t(`assistant.reto.state.${ultimo.estado}`, { site: ultimo.sitio })}
        </button>
      )}
    </div>
  );
}
