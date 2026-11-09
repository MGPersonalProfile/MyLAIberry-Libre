import { PrimaryButton, SecondaryButton } from '../ui/Buttons';
import { Notice } from '../ui/Feedback';
import { useState } from 'react';
import useRetosPendientes from '../../hooks/useRetosPendientes';
import RetoRemoto from './RetoRemoto';
import { useI18n } from '../../i18n/I18nContext';

export default function RetoPendiente() {
  const { t } = useI18n();
  const { retos, ultimo, cerrarUltimo, reanudar, cancelar } = useRetosPendientes();
  const [remotoDe, setRemotoDe] = useState(null);

  const sePuedePasarDesdeAqui = reto => reto.remoto === true && !!reto.token && !!window.api?.asistenteRetoRemotoIniciar
    && !!window.api?.fotogramaRetoRemoto && ['esperando-persona', 'no-resuelto'].includes(reto.estado);
  const delRemoto = retos.find(r => r.id === remotoDe) || (ultimo?.id === remotoDe ? ultimo : null);
  const cerrarRemoto = () => { setRemotoDe(null); if (ultimo?.id === remotoDe) cerrarUltimo(); };
  if (!retos.length && !ultimo) return null;
  return (
    <div className="px-4 md:px-6 pt-2 space-y-2" role="status">
      {remotoDe && delRemoto && (
        <RetoRemoto reto={delRemoto} terminado={!retos.some(r => r.id === remotoDe)} alCerrar={cerrarRemoto} />
      )}
      {retos.map(reto => (
        <Notice key={reto.id} tone="warning" title={t('assistant.reto.needs', { site: reto.sitio })}>
          <div className="flex flex-wrap gap-2 mt-1">
            {sePuedePasarDesdeAqui(reto) && <PrimaryButton onClick={() => setRemotoDe(reto.id)}>{t('assistant.reto.remote_open')}</PrimaryButton>}
            <SecondaryButton as="a" href={reto.url} target="_blank" rel="noopener noreferrer">{t('assistant.reto.open')}</SecondaryButton>
            <SecondaryButton onClick={() => reanudar(reto)} disabled={reto.estado === 'comprobando'}>{t('assistant.reto.retry')}</SecondaryButton>
            <SecondaryButton onClick={() => cancelar(reto)}>{t('assistant.reto.cancel')}</SecondaryButton>
          </div>
        </Notice>
      ))}
      {ultimo && (
        <button onClick={cerrarUltimo} className="text-left w-full text-xs opacity-80">
          {ultimo.mensaje || t(ultimo.estado === 'reanudado' && ultimo.continua ? 'assistant.reto.state.reanudado_solo' : `assistant.reto.state.${ultimo.estado}`, { site: ultimo.sitio })}
        </button>
      )}
    </div>
  );
}
