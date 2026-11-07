import { Loader2, SkipBack, SkipForward } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';

const VELOCIDADES = [0.75, 1, 1.25, 1.5];

export default function BarraDeVoz({ audioActivo, estadoAudio, pedirAudio, saltarFrase, velocidad, alCambiarVelocidad }) {
  const { t } = useI18n();
  if (audioActivo) {
    return (
      <div data-barra-voz className="px-3 pt-2 flex items-center justify-center gap-1 text-[12px]">
        <button type="button" aria-label={t('reader.voice_prev_sentence')} title={t('reader.voice_prev_sentence')}
          onClick={() => saltarFrase(-1)} className="w-11 h-11 grid place-items-center rounded-full active:bg-white/10">
          <SkipBack className="w-5 h-5" />
        </button>
        {VELOCIDADES.map(v => (
          <button key={v} type="button" aria-pressed={Math.abs(velocidad - v) < 0.01} onClick={() => alCambiarVelocidad(v)}
            className={`h-9 px-2.5 rounded-full tabular-nums ${Math.abs(velocidad - v) < 0.01 ? 'bg-white/25' : 'active:bg-white/10'}`}>
            {v}×
          </button>
        ))}
        <button type="button" aria-label={t('reader.voice_next_sentence')} title={t('reader.voice_next_sentence')}
          onClick={() => saltarFrase(1)} className="w-11 h-11 grid place-items-center rounded-full active:bg-white/10">
          <SkipForward className="w-5 h-5" />
        </button>
      </div>
    );
  }
  if (estadoAudio === 'preparando') {
    return (
      <p data-barra-voz className="px-4 pt-2 flex items-center justify-center gap-2 text-[12px] text-white/70" role="status">
        <Loader2 className="w-4 h-4 animate-spin" />{t('reader.voice_audio_preparing')}
      </p>
    );
  }
  if (estadoAudio === 'falta') {
    return (
      <div data-barra-voz className="px-4 pt-2 text-center">
        <button type="button" onClick={pedirAudio} className="h-9 px-4 rounded-full bg-white/15 text-[12px] active:bg-white/25">
          {t('reader.voice_audio_prepare')}
        </button>
        <p className="mt-1 text-[11px] text-white/50">{t('reader.voice_audio_prepare_hint')}</p>
      </div>
    );
  }
  return null;
}
