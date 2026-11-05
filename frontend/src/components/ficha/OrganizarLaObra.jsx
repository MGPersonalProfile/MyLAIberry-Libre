import { useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { SecondaryButton } from '../ui/Buttons';
import { Notice } from '../ui/Feedback';
import { useI18n } from '../../i18n/I18nContext';
import useIniciativa from '../../hooks/useIniciativa';
import EstanteriasDeLaObra from './EstanteriasDeLaObra';

const SOLO = ['shelves', 'radar'];

export default function OrganizarLaObra({ obraId }) {
  const { disponible, estanterias, radar, accion, error } = useIniciativa(null, { solo: SOLO });
  if (!disponible) return null;
  return (
    <>
      <EstanteriasDeLaObra obraId={obraId} estanterias={estanterias} accion={accion} />
      <VigilarRegreso obraId={obraId} radar={radar} accion={accion} />
      {error && <Notice variant="error" compact className="mt-2">{error}</Notice>}
    </>
  );
}

function VigilarRegreso({ obraId, radar, accion }) {
  const { t } = useI18n();
  const [capitulos, setCapitulos] = useState(1);
  const vivas = radar.filter(r => r.status === 'active' && String(r.workId) === String(obraId));

  return (
    <div className="mt-6" data-vigilar-regreso>
      <h3 className="text-caption font-semibold text-text-secondary uppercase tracking-wider mb-2">
        {t('watch.title')}
      </h3>
      {vivas.map(r => (
        <div key={r.id} className="flex flex-wrap items-center gap-3 text-small text-text-primary mb-2">
          <Bell className="w-4 h-4 text-warning" />
          <span>{r.condition === 'complete' ? t('watch.when_complete') : t('watch.when_chapters', { n: r.chapters })}</span>
          <SecondaryButton icon={BellOff} onClick={() => accion('stopWatch', { id: r.id })}>
            {t('watch.stop')}
          </SecondaryButton>
        </div>
      ))}
      {!vivas.length && <p className="text-footnote text-text-secondary mb-3">{t('watch.help')}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-footnote text-text-secondary">
          {t('watch.with')}
          <input
            type="number"
            min={1}
            max={500}
            value={capitulos}
            aria-label={t('watch.chapters_label')}
            onChange={e => setCapitulos(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
            className="w-16 bg-surface-secondary border border-border rounded-md px-2 py-1 text-center text-small text-text-primary focus:outline-none focus:border-accent"
          />
        </label>
        <SecondaryButton
          icon={Bell}
          onClick={() => accion('watchReturn', { workId: obraId, condition: 'chapters', chapters: capitulos })}
        >
          {t('watch.chapters_button', { n: capitulos })}
        </SecondaryButton>
        <SecondaryButton
          onClick={() => accion('watchReturn', { workId: obraId, condition: 'complete' })}
        >
          {t('watch.complete_button')}
        </SecondaryButton>
      </div>
    </div>
  );
}
