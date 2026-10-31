import { useEffect, useState } from 'react';

import { useI18n } from '../../i18n/I18nContext';

const ESTADOS = ['en pausa', 'abandonada', 'leída fuera'];
const CLAVE = { 'en pausa': 'reading_status.paused', abandonada: 'reading_status.dropped', 'leída fuera': 'reading_status.read_elsewhere' };

export default function EstadoDeLectura({ obra }) {
  const { t } = useI18n();
  const [estado, setEstado] = useState(obra.estadoLectura || null);
  const [error, setError] = useState(null);

  useEffect(() => window.api?.alCambiarEstadoLectura?.(({ id, estado: nuevo } = {}) => {
    if (String(id) === String(obra.id)) setEstado(nuevo || null);
  }), [obra.id]);
  if (!window.api?.setReadingStatus) return null;

  const elegir = async (nuevo) => {
    const valor = nuevo === estado ? null : nuevo;
    setError(null);
    try {
      const r = await window.api.setReadingStatus(obra.id, valor);

      if (r?.status === 'ok') setEstado(valor);
      else setError(r?.message || t('reading_status.failed'));
    } catch (e) {
      setError(e?.message || t('reading_status.failed'));
    }
  };

  return (
    <div className="mt-6" data-estado-lectura>
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">{t('reading_status.title')}</h3>
      <div className="flex flex-wrap gap-2">
        {ESTADOS.map(e => (
          <button key={e} onClick={() => elegir(e)} aria-pressed={estado === e}
                  className={`px-3 py-1 rounded-full border text-xs transition-colors ${estado === e
                    ? 'border-white/40 bg-white/10 text-white' : 'border-white/15 text-gray-400 hover:border-white/30 hover:text-gray-200'}`}>
            {t(CLAVE[e])}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-400 mt-2" role="alert">{error}</p>}
    </div>
  );
}
