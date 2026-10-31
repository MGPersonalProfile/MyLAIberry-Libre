import { useEffect, useState } from 'react';
import { Library, Loader2 } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';

const CADA = 15000;

export default function ObraEnteraEnMp3({ obraId, idioma }) {
  const { t } = useI18n();
  const [estado, setEstado] = useState(null);
  const [pedir, setPedir] = useState(false);
  const api = window.api?.audioObra;

  useEffect(() => {
    if (!api || obraId == null) return undefined;
    let vivo = true;
    let reloj = null;
    const mirar = async (encargar) => {
      try {
        const e = await api(obraId, { idioma: idioma || null, pedir: encargar });
        if (!vivo) return;
        setEstado(e);
        if (e?.estado === 'ok' && e.preparando > 0) reloj = setTimeout(() => mirar(false), CADA);
      } catch {
        if (vivo) setEstado(null);
      }
    };
    mirar(pedir);
    return () => { vivo = false; clearTimeout(reloj); };
  }, [api, obraId, idioma, pedir]);

  if (!api || estado?.estado !== 'ok' || estado.total < 2) return null;
  return (
    <div className="mt-3 pt-3 border-t border-white/5">
      <p className="text-xs text-gray-500 mb-2 flex items-center gap-2">
        <Library className="w-3.5 h-3.5" /> {t('reader.audio_work')}:{' '}
        {t('reader.audio_work_progress', { listos: estado.listos, total: estado.total })}
        {estado.preparando > 0 && (
          <span className="inline-flex items-center gap-1 text-gray-600">
            · <Loader2 className="w-3 h-3 animate-spin" /> {t('reader.audio_work_preparing', { n: estado.preparando })}
          </span>
        )}
      </p>
      {estado.faltan > 0 && (
        <button type="button" onClick={() => setPedir(true)} disabled={pedir}
          className="w-full py-2 max-md:min-h-11 rounded-lg border border-white/10 text-xs text-gray-300 hover:bg-white/5 disabled:opacity-50">
          {t('reader.audio_work_make', { n: estado.faltan })}
        </button>
      )}
    </div>
  );
}
