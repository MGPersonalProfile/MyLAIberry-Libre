import { useI18n } from '../../i18n/I18nContext';

export default function AvisosDeCarga({
  errorCarga, errorTrad, traducido, traduciendo, contenidoTraducido,
  alReintentarCarga, alReintentarTraduccion
}) {
  const { t } = useI18n();

  return (
    <>
      {errorCarga && (
        <div className="text-center mb-6" role="alert">
          <p>{t('reader.load_error')}</p>
          <p className="text-sm opacity-60 mt-2">{errorCarga}</p>
          <button className="mt-3 underline underline-offset-4"
            onClick={alReintentarCarga}>{t('reader.retry_load')}</button>
        </div>
      )}
      {errorTrad && (
        <div className="text-center text-sm mb-6" role="status">
          <p className="opacity-70">{errorTrad}</p>
          {traducido && (
            <button className="mt-2 underline underline-offset-4 disabled:opacity-50" disabled={traduciendo}
              onClick={alReintentarTraduccion}>{t('reader.retry_translation')}</button>
          )}
        </div>
      )}
      {contenidoTraducido && !errorTrad && (
        <p className="text-center text-[11px] uppercase tracking-widest mb-6 opacity-40">
          {t('reader.translated_badge')}
        </p>
      )}
    </>
  );
}
