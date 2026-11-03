import { useEffect, useState } from 'react';
import { Download, Library, Loader2 } from 'lucide-react';

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
      <BajarTodos obraId={obraId} idioma={idioma} listos={estado.listos} />
    </div>
  );
}

function BajarTodos({ obraId, idioma, listos }) {
  const { t } = useI18n();
  const [hecho, setHecho] = useState(null);
  const [bajando, setBajando] = useState(false);
  if (!window.api?.guardarAudioObra || !listos) return null;
  const bajar = async () => {
    setBajando(true);
    setHecho(null);
    try { setHecho(await window.api.guardarAudioObra(obraId, { idioma: idioma || null })); }
    catch (e) { setHecho({ status: 'error', message: e.message }); }
    finally { setBajando(false); }
  };
  return (
    <div className="mt-2" data-bajar-obra-mp3>
      <button type="button" onClick={bajar} disabled={bajando}
        className="w-full flex items-center justify-center gap-2 py-2 max-md:min-h-11 rounded-lg border border-white/10 text-xs text-gray-200 hover:bg-white/5 disabled:opacity-50">
        {bajando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        {t('reader.audio_work_save', { n: listos })}
      </button>
      {hecho?.status === 'ok' && hecho.ruta && (
        <p className="text-[11px] text-emerald-400/90 mt-1.5">{t('reader.audio_work_saved', { n: hecho.capitulos, ruta: hecho.ruta })}</p>
      )}
      {hecho?.status === 'error' && <p role="alert" className="text-[11px] text-red-300 mt-1.5">{hecho.message}</p>}
    </div>
  );
}
