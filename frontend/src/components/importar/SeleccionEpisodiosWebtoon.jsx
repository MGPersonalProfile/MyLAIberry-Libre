import { useState } from 'react';
import { PrimaryButton, SecondaryButton } from '../ui/Buttons';
import { InsetGroupedList } from '../ui/List';
import { Notice } from '../ui/Feedback';
import { useI18n } from '../../i18n/I18nContext';

export default function SeleccionEpisodiosWebtoon({ webtoonData, onConfirmar, onCancelar }) {
  const { t } = useI18n();
  const chapters = webtoonData?.chapters || [];
  const [marcados, setMarcados] = useState(() => chapters.map(c => c.episodeNo || String(c.index)));

  const alternar = (id) => {
    setMarcados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const seleccionarTodos = () => {
    setMarcados(chapters.map(c => c.episodeNo || String(c.index)));
  };

  const seleccionarNinguno = () => {
    setMarcados([]);
  };

  const handleConfirmar = () => {
    if (!marcados.length) return;
    onConfirmar(marcados);
  };

  return (
    <div className="space-y-4" data-seleccion-webtoon>
      <div>
        <h3 className="text-subhead font-semibold text-text-primary">
          {webtoonData?.title || t('import.webtoon_select_episodes')}
        </h3>
        {webtoonData?.author && (
          <p className="text-footnote text-text-secondary">{webtoonData.author}</p>
        )}
      </div>

      <Notice variant="info" compact>
        {t('import.webtoon_select_hint')}
      </Notice>

      <div className="flex gap-2">
        <SecondaryButton onClick={seleccionarTodos}>{t('selection.all')}</SecondaryButton>
        <SecondaryButton onClick={seleccionarNinguno}>{t('selection.none')}</SecondaryButton>
      </div>

      <InsetGroupedList divided>
        <div className="max-h-60 overflow-y-auto divide-y divide-separator">
          {chapters.map((cap) => {
            const id = cap.episodeNo || String(cap.index);
            const marcado = marcados.includes(id);
            return (
              <label
                key={id}
                className="flex gap-3 items-center px-4 py-2.5 hover:bg-surface-hover cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={() => alternar(id)}
                  className="accent-accent shrink-0 w-4 h-4"
                />
                <span className="min-w-0 text-small text-text-primary">
                  {cap.title || `Episode ${cap.episodeNo}`}
                </span>
              </label>
            );
          })}
        </div>
      </InsetGroupedList>

      <div className="flex gap-2 pt-2">
        <PrimaryButton disabled={!marcados.length} onClick={handleConfirmar} className="flex-1">
          {t('import.webtoon_import_selected', { n: marcados.length })}
        </PrimaryButton>
        <SecondaryButton onClick={onCancelar}>
          {t('common.cancel')}
        </SecondaryButton>
      </div>
    </div>
  );
}
