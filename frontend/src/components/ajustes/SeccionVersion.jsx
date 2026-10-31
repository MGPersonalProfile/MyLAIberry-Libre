import { RefreshCw } from 'lucide-react';
import { Seccion } from './piezas';
import { useI18n } from '../../i18n/I18nContext';
import useActualizacion from '../../hooks/useActualizacion';

export default function SeccionVersion() {
  const { t } = useI18n();
  const { estado, instalando, error, actualizar } = useActualizacion();
  if (!estado) return null;

  return (
    <Seccion icono={RefreshCw} titulo={t('update.title')} descripcion={t('update.desc')}>
      <p className="text-sm text-gray-300 tabular-nums">{t('update.current', { version: estado.actual })}</p>
      {estado.disponible && !window.api?.instalarActualizacion ? (
        <p className="text-xs text-gray-500 mt-1">{t('update.on_pc', { version: estado.nueva })}</p>
      ) : estado.disponible ? (
        <button
          onClick={actualizar}
          disabled={instalando}
          className="mt-3 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-60 text-sm font-semibold transition-colors"
        >
          {instalando ? t('update.installing') : t('update.install_version', { version: estado.nueva })}
        </button>
      ) : (
        <p className="text-xs text-gray-500 mt-1">{t('update.up_to_date')}</p>
      )}
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </Seccion>
  );
}
