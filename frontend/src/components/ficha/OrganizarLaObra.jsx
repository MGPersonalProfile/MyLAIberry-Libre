import { useState } from 'react';
import { Bell, BellOff } from 'lucide-react';

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
      {error && <p className="text-xs text-red-400 mt-2" role="alert">{error}</p>}
    </>
  );
}

function VigilarRegreso({ obraId, radar, accion }) {
  const { t } = useI18n();
  const [capitulos, setCapitulos] = useState(1);
  const vivas = radar.filter(r => r.status === 'active' && String(r.workId) === String(obraId));

  return (
    <div className="mt-6" data-vigilar-regreso>
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">{t('watch.title')}</h3>
      {vivas.map(r => (
        <div key={r.id} className="flex flex-wrap items-center gap-3 text-sm text-gray-300 mb-2">
          <Bell className="w-4 h-4 text-amber-400/80" />
          <span>{r.condition === 'complete' ? t('watch.when_complete') : t('watch.when_chapters', { n: r.chapters })}</span>
          <button onClick={() => accion('stopWatch', { id: r.id })}
                  className="text-xs px-3 py-1 rounded-full border border-white/15 text-gray-400 hover:text-gray-200 flex items-center gap-1.5">
            <BellOff className="w-3 h-3" /> {t('watch.stop')}
          </button>
        </div>
      ))}
      {!vivas.length && <p className="text-xs text-gray-600 mb-3">{t('watch.help')}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-gray-400">
          {t('watch.with')}
          <input type="number" min={1} max={500} value={capitulos} aria-label={t('watch.chapters_label')}
                 onChange={e => setCapitulos(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                 className="w-16 bg-transparent border-b border-white/20 focus:border-white/50 outline-none text-center text-sm text-gray-200" />
        </label>
        <button onClick={() => accion('watchReturn', { workId: obraId, condition: 'chapters', chapters: capitulos })}
                className="text-xs px-3 py-1 rounded-full bg-white/10 hover:bg-white/15 flex items-center gap-1.5">
          <Bell className="w-3 h-3" /> {t('watch.chapters_button', { n: capitulos })}
        </button>
        <button onClick={() => accion('watchReturn', { workId: obraId, condition: 'complete' })}
                className="text-xs px-3 py-1 rounded-full border border-white/15 text-gray-400 hover:text-gray-200">
          {t('watch.complete_button')}
        </button>
      </div>
    </div>
  );
}
