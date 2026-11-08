import { useI18n } from '../../i18n/I18nContext';
import { SecondaryButton } from '../ui/Buttons';
import { Notice } from '../ui/Feedback';
import { Card } from '../ui/Layout';

export default function ResumenPrevio({
  recap, recapError, mejorandoRecap, mejorarRecap, cerrarRecap, alAbrirAjustes
}) {
  const { t } = useI18n();

  return (
    <Card className="dark mb-10 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-2">
        <p className="text-footnote uppercase tracking-widest text-text-secondary">{t('recap.previously')}</p>
        <SecondaryButton size="sm" className="whitespace-nowrap" onClick={cerrarRecap}>{t('recap.dismiss')}</SecondaryButton>
      </div>
      <p className="text-small italic leading-relaxed text-text-primary">{recap.texto}</p>

      {recapError ? (
        <Notice tone="warning" compact className="mt-3"
          action={recapError === 'sin-clave' && alAbrirAjustes && (
            <SecondaryButton size="sm" onClick={alAbrirAjustes}>{t('recap.open_settings')}</SecondaryButton>
          )}>
          {recapError === 'sin-clave' ? t('recap.needs_key') : t('recap.failed')}
        </Notice>
      ) : (

        <SecondaryButton size="sm" className="mt-3" onClick={() => mejorarRecap(recap.origen === 'modelo')} disabled={mejorandoRecap}>
          {mejorandoRecap
            ? t('recap.improving')
            : recap.origen === 'modelo' ? t('recap.again') : t('recap.improve')}
        </SecondaryButton>
      )}
    </Card>
  );
}
