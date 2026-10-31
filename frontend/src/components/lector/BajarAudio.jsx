import { useEffect, useState } from 'react';
import { Download, Headphones, Loader2 } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';

const CADA = 5000;

export default function BajarAudio({ obraId, capitulo, idioma }) {
  const { t } = useI18n();
  const [estado, setEstado] = useState(null);
  const [voces, setVoces] = useState(null);
  const [instalando, setInstalando] = useState(false);
  const [progreso, setProgreso] = useState(null);
  const [errorInstalar, setErrorInstalar] = useState('');
  const [revision, setRevision] = useState(0);

  const [pedir, setPedir] = useState(false);
  const pedirAlApi = window.api?.audioCapitulo;

  useEffect(() => {
    if (!pedirAlApi || obraId == null) return undefined;
    let vivo = true;
    let reloj = null;
    const mirar = async (encargar) => {
      try {
        const e = await pedirAlApi(obraId, capitulo, { idioma: idioma || null, pedir: encargar });
        if (!vivo) return;
        setEstado(e);
        if (e?.estado === 'preparando') reloj = setTimeout(() => mirar(false), CADA);
      } catch (err) {
        if (vivo) setEstado({ estado: 'error', motivo: err.message });
      }
    };
    mirar(pedir);
    return () => { vivo = false; clearTimeout(reloj); };
  }, [pedirAlApi, obraId, capitulo, idioma, pedir, revision]);

  useEffect(() => {
    if (estado?.estado !== 'sin-motor' || !window.api?.estadoVoces) return undefined;
    let vivo = true;
    window.api.estadoVoces().then(e => { if (vivo) setVoces(e); })
      .catch(e => { if (vivo) setErrorInstalar(e.message); });
    return () => { vivo = false; };
  }, [estado?.estado]);

  useEffect(() => window.api?.onVocesProgreso?.(setProgreso), []);

  const instalar = async () => {
    setInstalando(true);
    setErrorInstalar('');
    setProgreso({ porcentaje: 0, archivo: '' });
    try {
      const r = await window.api.instalarVoces();
      if (!r.ok) throw new Error(r.motivo);
      setVoces(await window.api.estadoVoces());
      setRevision(n => n + 1);
    } catch (e) { setErrorInstalar(e.message); }
    finally { setInstalando(false); }
  };

  if (!pedirAlApi || !estado) return null;
  const enElPc = Boolean(window.api?.guardarAudioCapitulo);
  const titulo = (
    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">{t('reader.audio_title')}</p>
  );
  const boton = 'w-full flex items-center justify-center gap-2 py-2 max-md:min-h-11 rounded-lg border border-white/10 text-sm text-gray-200 hover:bg-white/5 disabled:opacity-50';

  if (estado.estado === 'sin-motor' && window.api?.instalarVoces && voces?.disponible && voces.faltan?.length) {
    const mb = Math.ceil(voces.bytesABajar / 1000000);
    return <div>
      {titulo}
      <button type="button" className={boton} disabled={instalando} onClick={instalar}>
        {instalando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {t('reader.audio_install', { mb })}
      </button>

      <p className="text-xs text-gray-500 mt-2" data-licencias-voces>{t('reader.audio_install_licenses')}</p>
      {instalando && <div className="mt-3" role="status" aria-live="polite">
        <progress className="w-full h-2 accent-amber-400" value={progreso?.porcentaje || 0} max="100" />
        <p className="text-xs text-gray-400">{t('reader.audio_install_progress', { n: progreso?.porcentaje || 0 })}</p>
      </div>}
      {errorInstalar && <p role="alert" className="text-xs text-red-300 mt-2">{errorInstalar}</p>}
    </div>;
  }
  if (estado.estado === 'sin-motor' || estado.estado === 'error' || estado.estado === 'sin-texto') {
    return <div>{titulo}<p className="text-xs text-gray-500">{estado.motivo}</p>
      {errorInstalar && <p role="alert" className="text-xs text-red-300 mt-2">{errorInstalar}</p>}
    </div>;
  }
  if (estado.estado === 'falta') {
    return (
      <div>
        {titulo}
        <button type="button" className={boton} onClick={() => { setEstado({ estado: 'preparando' }); setPedir(true); }}>
          <Headphones className="w-4 h-4" /> {t('reader.audio_make')}
        </button>
        <p className="text-[11px] text-gray-600 mt-2">{t(estado.traducido ? 'reader.audio_hint_translated' : 'reader.audio_hint_original')}</p>
      </div>
    );
  }
  if (estado.estado === 'preparando') {
    return (
      <div>
        {titulo}
        <button type="button" className={boton} disabled>
          <Loader2 className="w-4 h-4 animate-spin" /> {t('reader.audio_preparing')}
        </button>
      </div>
    );
  }
  const megas = estado.bytes ? `${(estado.bytes / 1048576).toFixed(1)} MB` : '';
  return (
    <div>
      {titulo}
      {!enElPc && estado.uri && <audio controls preload="none" src={estado.uri} className="w-full mb-2" />}
      {enElPc ? (
        <button type="button" className={boton}
          onClick={() => window.api.guardarAudioCapitulo(obraId, capitulo, { idioma: idioma || null })}>
          <Download className="w-4 h-4" /> {t('reader.audio_save')} {megas}
        </button>
      ) : (
        <a className={boton} href={estado.uri} download={estado.nombre}>
          <Download className="w-4 h-4" /> {t('reader.audio_save')} {megas}
        </a>
      )}
    </div>
  );
}
