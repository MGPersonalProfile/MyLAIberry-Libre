import { SecondaryButton } from '../ui/Buttons';
import { Notice } from '../ui/Feedback';
import useRetosPendientes from '../../hooks/useRetosPendientes';
import { useI18n } from '../../i18n/I18nContext';

export default function RetoPendiente() {
  const { t } = useI18n();
  const { retos, ultimo, cerrarUltimo, reanudar, cancelar } = useRetosPendientes();
  if (!retos.length && !ultimo) return null;
  return (
    <div className="px-4 md:px-6 pt-2 space-y-2" role="status">
      {retos.map(reto => (
        <Notice key={reto.id} tone="warning" title={t('assistant.reto.needs', { site: reto.sitio })}>
          <div className="flex flex-wrap gap-2 mt-1">
            <SecondaryButton as="a" href={reto.url} target="_blank" rel="noopener noreferrer">{t('assistant.reto.open')}</SecondaryButton>
            <SecondaryButton onClick={() => reanudar(reto)} disabled={reto.estado === 'comprobando'}>{t('assistant.reto.retry')}</SecondaryButton>
            <SecondaryButton onClick={() => cancelar(reto)}>{t('assistant.reto.cancel')}</SecondaryButton>
          </div>
        </Notice>
      ))}
      {ultimo && (
        <button onClick={cerrarUltimo} className="text-left w-full text-xs opacity-80">
          {ultimo.mensaje || t(`assistant.reto.state.${ultimo.estado}`, { site: ultimo.sitio })}
        </button>
      )}
    </div>
  );
}
