import { useEffect, useState } from 'react';
import { Download, Headphones } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';
import { SecondaryButton } from '../ui/Buttons';
import { Girando, Notice, ProgressIndicator } from '../ui/Feedback';

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
    <p className="text-xs text-text-secondary font-bold uppercase tracking-wider mb-3">{t('reader.audio_title')}</p>
  );
  const boton = 'w-full';

  if (estado.estado === 'sin-motor' && window.api?.instalarVoces && voces?.disponible && voces.faltan?.length) {
    const mb = Math.ceil(voces.bytesABajar / 1000000);
    return <div>
      {titulo}
      <SecondaryButton className={boton} disabled={instalando} onClick={instalar}
        icon={instalando ? Girando : Download}>
        {t('reader.audio_install', { mb })}
      </SecondaryButton>

      <p className="text-footnote text-text-secondary mt-2" data-licencias-voces>{t('reader.audio_install_licenses')}</p>
      {instalando && (
        <ProgressIndicator className="mt-3" role="status" aria-live="polite" value={progreso?.porcentaje || 0}
          label={t('reader.audio_install_progress', { n: progreso?.porcentaje || 0 })} />
      )}
      {errorInstalar && <Notice tone="error" compact className="mt-2">{errorInstalar}</Notice>}
    </div>;
  }
  if (estado.estado === 'sin-motor' || estado.estado === 'error' || estado.estado === 'sin-texto') {
    return <div>{titulo}<p className="text-footnote text-text-secondary">{estado.motivo}</p>
      {errorInstalar && <Notice tone="error" compact className="mt-2">{errorInstalar}</Notice>}
    </div>;
  }
  if (estado.estado === 'falta') {
    return (
      <div>
        {titulo}
        <SecondaryButton className={boton} icon={Headphones} onClick={() => { setEstado({ estado: 'preparando' }); setPedir(true); }}>
          {t('reader.audio_make')}
        </SecondaryButton>
        <p className="text-caption text-text-tertiary mt-2">{t(estado.traducido ? 'reader.audio_hint_translated' : 'reader.audio_hint_original')}</p>
      </div>
    );
  }
  if (estado.estado === 'preparando') {
    return (
      <div>
        {titulo}
        <SecondaryButton className={boton} disabled icon={Girando}>{t('reader.audio_preparing')}</SecondaryButton>
      </div>
    );
  }
  const megas = estado.bytes ? `${(estado.bytes / 1048576).toFixed(1)} MB` : '';
  return (
    <div>
      {titulo}
      {!enElPc && estado.uri && <audio controls preload="none" src={estado.uri} className="w-full mb-2" />}
      {enElPc ? (
        <SecondaryButton className={boton} icon={Download}
          onClick={() => window.api.guardarAudioCapitulo(obraId, capitulo, { idioma: idioma || null })}>
          {t('reader.audio_save')} {megas}
        </SecondaryButton>
      ) : (
        <SecondaryButton as="a" className={boton} icon={Download} href={estado.uri} download={estado.nombre}>
          {t('reader.audio_save')} {megas}
        </SecondaryButton>
      )}
    </div>
  );
}
