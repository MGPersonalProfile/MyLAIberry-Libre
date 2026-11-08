import { SkipBack, SkipForward } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';
import { IconButton, SecondaryButton } from '../ui/Buttons';
import { SegmentedControl } from '../ui/Controls';
import { Girando } from '../ui/Feedback';

const VELOCIDADES = [0.75, 1, 1.25, 1.5];

export default function BarraDeVoz({ audioActivo, estadoAudio, pedirAudio, saltarFrase, velocidad, alCambiarVelocidad }) {
  const { t } = useI18n();
  if (audioActivo) {
    const actual = VELOCIDADES.find(v => Math.abs(velocidad - v) < 0.01);
    return (
      <div data-barra-voz className="dark px-3 pt-2 flex items-center justify-center gap-1 text-text-primary">
        <IconButton icon={SkipBack} label={t('reader.voice_prev_sentence')} onClick={() => saltarFrase(-1)} />
        <SegmentedControl ariaLabel={t('reader.voice_speed')} value={actual} onChange={alCambiarVelocidad}
          options={VELOCIDADES.map(v => ({ id: v, etiqueta: `${v}×` }))} />
        <IconButton icon={SkipForward} label={t('reader.voice_next_sentence')} onClick={() => saltarFrase(1)} />
      </div>
    );
  }
  if (estadoAudio === 'preparando') {
    return (
      <p data-barra-voz className="px-4 pt-2 flex items-center justify-center gap-2 text-footnote text-white/70" role="status">
        <Girando className="w-4 h-4" />{t('reader.voice_audio_preparing')}
      </p>
    );
  }
  if (estadoAudio === 'falta') {
    return (
      <div data-barra-voz className="dark px-4 pt-2 text-center">
        <SecondaryButton size="sm" onClick={pedirAudio}>{t('reader.voice_audio_prepare')}</SecondaryButton>
        <p className="mt-1 text-caption text-text-secondary">{t('reader.voice_audio_prepare_hint')}</p>
      </div>
    );
  }
  return null;
}
