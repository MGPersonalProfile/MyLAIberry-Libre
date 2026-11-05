import { useState } from 'react';
import { PrimaryButton, SecondaryButton } from '../ui/Buttons';
import { InsetGroupedList } from '../ui/List';
import { Notice } from '../ui/Feedback';
import { useI18n } from '../../i18n/I18nContext';

export default function SeleccionCapitulos({ obra, alGuardar }) {
  const { t } = useI18n();
  const capitulos = obra.chapterList || [];
  const [marcados, setMarcados] = useState(() => capitulos.map((_, i) => i));
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(false);
  const alternar = (i) => setMarcados(prev => prev.includes(i) ? prev.filter(n => n !== i) : [...prev, i]);

  const guardar = async () => {
    setOcupado(true);
    setError(false);
    try {
      const res = await window.api.elegirCapitulos(obra.id, marcados);
      if (res.status !== 'success') throw new Error(res.message);
      alGuardar(res.data);
    } catch {
      setError(true);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <section className="mb-6 p-4 border border-warning/40 bg-warning/10 rounded-lg space-y-3" aria-label={t('selection.title')}>
      <div>
        <h3 className="text-headline text-text-primary">{t('selection.title')}</h3>
        <p className="text-small text-text-secondary mt-1">{t('selection.hint')}</p>
      </div>
      <fieldset disabled={ocupado} className="space-y-3">
        <div className="flex gap-2">
          <SecondaryButton onClick={() => setMarcados(capitulos.map((_, i) => i))}>{t('selection.all')}</SecondaryButton>
          <SecondaryButton onClick={() => setMarcados([])}>{t('selection.none')}</SecondaryButton>
        </div>
        <InsetGroupedList divided>
          <div className="max-h-64 overflow-y-auto divide-y divide-separator">
            {capitulos.map((cap, i) => (
              <label key={i} className="flex gap-3 items-start px-4 py-2.5 hover:bg-surface-hover cursor-pointer">
                <input type="checkbox" checked={marcados.includes(i)} onChange={() => alternar(i)} className="mt-1 accent-accent shrink-0" />
                <span className="min-w-0 break-words text-small text-text-primary">
                  {cap.title || t('selection.chapter', { n: i + 1 })}
                  <small className="block text-caption text-text-secondary break-all">{cap.url}</small>
                </span>
              </label>
            ))}
          </div>
        </InsetGroupedList>
        <PrimaryButton disabled={!marcados.length} onClick={guardar}>
          {t(ocupado ? 'selection.saving' : 'selection.save')}
        </PrimaryButton>
      </fieldset>
      {error && <Notice variant="error" compact>{t('selection.error')}</Notice>}
    </section>
  );
}
