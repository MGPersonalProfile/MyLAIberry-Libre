import { useI18n } from '../../i18n/I18nContext';
import { SecondaryButton } from '../ui/Buttons';
import { Notice, Tag } from '../ui/Feedback';

export default function AvisosDeCarga({
  errorCarga, errorTrad, traducido, traduciendo, contenidoTraducido,
  alReintentarCarga, alReintentarTraduccion
}) {
  const { t } = useI18n();

  return (
    <>
      {errorCarga && (
        <Notice tone="error" title={t('reader.load_error')} className="dark mb-6 font-sans"
          action={<SecondaryButton size="sm" onClick={alReintentarCarga}>{t('reader.retry_load')}</SecondaryButton>}>
          {errorCarga}
        </Notice>
      )}
      {errorTrad && (
        <Notice tone="warning" role="status" compact className="dark mb-6 font-sans"
          action={traducido && (
            <SecondaryButton size="sm" disabled={traduciendo} onClick={alReintentarTraduccion}>{t('reader.retry_translation')}</SecondaryButton>
          )}>
          {errorTrad}
        </Notice>
      )}
      {contenidoTraducido && !errorTrad && (
        <p className="text-center mb-6 font-sans">
          <Tag className="dark">{t('reader.translated_badge')}</Tag>
        </p>
      )}
    </>
  );
}
