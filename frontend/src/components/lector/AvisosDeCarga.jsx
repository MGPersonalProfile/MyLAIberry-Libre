import { useI18n } from '../../i18n/I18nContext';
import { SecondaryButton } from '../ui/Buttons';
import { Notice, Tag } from '../ui/Feedback';
import { avisosDeTraduccion } from '../../traduccionInfo.js';

export default function AvisosDeCarga({
  errorCarga, errorTrad, traducido, traduciendo, contenidoTraducido, infoTrad,
  alReintentarCarga, alReintentarTraduccion
}) {
  const { t } = useI18n();
  const { aviso, pie, detalle } = avisosDeTraduccion(contenidoTraducido ? infoTrad : null);

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
      {aviso && !errorTrad && (
        <Notice tone="warning" role="status" compact className="dark mb-6 font-sans" data-integridad={aviso}>
          {t(`reader.integrity.${aviso}`)}{detalle.length ? ` (${detalle.join('; ')})` : ''}
        </Notice>
      )}
      {contenidoTraducido && !errorTrad && (
        <p className="text-center mb-6 font-sans flex flex-wrap items-center justify-center gap-1.5">
          <Tag className="dark">{t('reader.translated_badge')}</Tag>
          {pie.map(clave => <Tag key={clave} className="dark" data-pie={clave}>{t(`reader.integrity.${clave}`)}</Tag>)}
        </p>
      )}
    </>
  );
}
