import { PrimaryButton, SecondaryButton } from '../ui/Buttons';
import { Notice } from '../ui/Feedback';
import { useState } from 'react';
import useRetosPendientes from '../../hooks/useRetosPendientes';
import RetoRemoto from './RetoRemoto';
import { useI18n } from '../../i18n/I18nContext';

function ResultadoDeReto({ reto, ver, descartar, t }) {
  const [texto, setTexto] = useState(null);
  const [error, setError] = useState('');
  const alternar = async () => {
    if (texto !== null) { setTexto(null); return; }
    try { const r = await ver(reto); setTexto(String(r?.texto || '')); setError(''); } catch (e) { setError(String(e?.message || e)); }
  };
  return (
    <Notice tone="success" title={t('assistant.reto.result_title', { site: reto.sitio })}>
      {reto.resultado?.titulo && <p className="text-sm">{reto.resultado.titulo}</p>}
      <div className="flex flex-wrap gap-2 mt-1">
        <SecondaryButton onClick={alternar}>{t(texto === null ? 'assistant.reto.result_show' : 'assistant.reto.result_hide')}</SecondaryButton>
        <SecondaryButton onClick={() => descartar(reto)}>{t('assistant.reto.discard')}</SecondaryButton>
      </div>
      {error && <p className="text-xs text-warning mt-1">{error}</p>}
      {texto !== null && (
        <div className="mt-2 max-h-64 overflow-y-auto rounded border border-border p-2 text-xs whitespace-pre-wrap" data-reto-resultado>
          <p className="opacity-70 mb-1">{t('assistant.reto.result_foreign')}</p>
          {texto}
        </div>
      )}
    </Notice>
  );
}

export default function RetoPendiente() {
  const { t } = useI18n();
  const { retos, resultados, ultimo, cerrarUltimo, reanudar, cancelar, reabrir, verResultado, descartarResultado } = useRetosPendientes();
  const [remotoDe, setRemotoDe] = useState(null);

  const sePuedePasarDesdeAqui = reto => reto.remoto === true && !!reto.token && !!window.api?.asistenteRetoRemotoIniciar
    && !!window.api?.fotogramaRetoRemoto && ['esperando-persona', 'no-resuelto'].includes(reto.estado);
  const delRemoto = retos.find(r => r.id === remotoDe) || (ultimo?.id === remotoDe ? ultimo : null);
  const cerrarRemoto = () => { setRemotoDe(null); if (ultimo?.id === remotoDe) cerrarUltimo(); };
  if (!retos.length && !ultimo && !resultados.length) return null;
  return (
    <div className="px-4 md:px-6 pt-2 space-y-2" role="status">
      {remotoDe && delRemoto && (
        <RetoRemoto reto={delRemoto} terminado={!retos.some(r => r.id === remotoDe)} alCerrar={cerrarRemoto} />
      )}
      {retos.map(reto => (reto.estado === 'incompatible' ? (
        <Notice key={reto.id} tone="warning" title={t('assistant.reto.incompatible', { site: reto.sitio })}>
          {reto.mensaje && <p className="text-xs opacity-80">{reto.mensaje}</p>}
          <SecondaryButton onClick={() => cancelar(reto)}>{t('assistant.reto.discard')}</SecondaryButton>
        </Notice>
      ) : (
        <Notice key={reto.id} tone="warning" title={t('assistant.reto.needs', { site: reto.sitio })}>
          {reto.recuperado && !reto.remoto && !reto.reabriendo && <p className="text-xs opacity-80">{t('assistant.reto.recovered')}</p>}
          {reto.reabriendo && <p className="text-xs opacity-80">{t('assistant.reto.reopening')}</p>}
          {reto.mensaje && !reto.reabriendo && <p className="text-xs opacity-80">{reto.mensaje}</p>}
          <div className="flex flex-wrap gap-2 mt-1">
            {sePuedePasarDesdeAqui(reto) && <PrimaryButton onClick={() => setRemotoDe(reto.id)}>{t('assistant.reto.remote_open')}</PrimaryButton>}
            {(reto.reabrible || reto.reabriendo) && (
              <PrimaryButton onClick={() => reabrir(reto)} disabled={reto.reabriendo}>{t('assistant.reto.reopen')}</PrimaryButton>
            )}
            <SecondaryButton as="a" href={reto.url} target="_blank" rel="noopener noreferrer">{t('assistant.reto.open')}</SecondaryButton>
            <SecondaryButton onClick={() => reanudar(reto)} disabled={reto.estado === 'comprobando' || reto.reabriendo}>{t('assistant.reto.retry')}</SecondaryButton>
            <SecondaryButton onClick={() => cancelar(reto)}>{t('assistant.reto.cancel')}</SecondaryButton>
          </div>
        </Notice>
      )))}
      {resultados.map(reto => <ResultadoDeReto key={`r-${reto.id}`} reto={reto} ver={verResultado} descartar={descartarResultado} t={t} />)}
      {ultimo && (
        <button onClick={cerrarUltimo} className="text-left w-full text-xs opacity-80">
          {ultimo.mensaje || t(ultimo.estado === 'reanudado' && ultimo.continua ? 'assistant.reto.state.reanudado_solo' : `assistant.reto.state.${ultimo.estado}`, { site: ultimo.sitio })}
        </button>
      )}
    </div>
  );
}
