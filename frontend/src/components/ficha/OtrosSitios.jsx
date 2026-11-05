import { PrimaryButton, SecondaryButton } from '../ui/Buttons';
import { InsetGroupedList, ActionCell } from '../ui/List';
import { Notice } from '../ui/Feedback';
import { useI18n } from '../../i18n/I18nContext';

export default function OtrosSitios({ dePago, libres, total, resultados, alBuscar, alImportar }) {
  const { t } = useI18n();
  if (!dePago) return null;

  return (
    <div className="mt-6 space-y-3">
      <Notice
        variant="warning"
        title={t('paywall.summary', { libres, total })}
        action={
          resultados === null && (
            <SecondaryButton onClick={() => alBuscar()}>
              {t('paywall.search')}
            </SecondaryButton>
          )
        }
      >
        {t('paywall.explain')}
      </Notice>

      {resultados === 'buscando' && (
        <p className="text-footnote text-text-secondary">{t('paywall.searching')}</p>
      )}

      {Array.isArray(resultados) && resultados.length === 0 && (
        <p className="text-footnote text-text-secondary">{t('paywall.none')}</p>
      )}

      {Array.isArray(resultados) && resultados.length > 0 && (
        <InsetGroupedList divided>
          {resultados.map(o => (
            <ActionCell
              key={o.url}
              title={o.title}
              subtitle={`${o.sitio}${o.author ? ` · ${o.author}` : ''}${o.totalChapters ? ` · ${o.totalChapters} cap.` : ''}`}
              trailing={
                <PrimaryButton onClick={() => alImportar(o.url)}>
                  {t('paywall.import')}
                </PrimaryButton>
              }
            />
          ))}
        </InsetGroupedList>
      )}
    </div>
  );
}
