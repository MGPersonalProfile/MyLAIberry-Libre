import Cover from '../Cover';
import { useI18n } from '../../i18n/I18nContext';

export default function FinDeObra({ sugerencias, alElegir, completa }) {
  const { t } = useI18n();
  const terminada = completa === true;
  if (terminada && !sugerencias.length) return null;

  return (
    <div className="mb-24 border-t border-current pt-10">
      <p className="text-sm uppercase tracking-widest opacity-50 mb-1">
        {terminada ? t('reader.the_end') : t('reader.caught_up')}
      </p>
      {!terminada && (
        <p className="text-sm opacity-70 mb-6 max-w-xl">
          {completa === false ? t('reader.caught_up_ongoing') : t('reader.caught_up_unknown')}
        </p>
      )}
      {sugerencias.length > 0 && (
        <h3 className="text-2xl font-bold mb-8">{terminada ? t('reader.what_now') : t('reader.meanwhile')}</h3>
      )}

      <div className="grid grid-cols-3 gap-5">
        {sugerencias.map(s => (
          <button
            key={s.id}
            onClick={() => alElegir(s)}
            className="text-left group"
          >
            <div className="rounded-md overflow-hidden aspect-[2/3] mb-3 transition-transform duration-300 group-hover:scale-105 shadow-lg">
              <Cover story={s} className="w-full h-full" imgClassName="w-full h-full object-cover" />
            </div>
            <p className="font-bold text-sm leading-tight line-clamp-2">{s.title}</p>
            <p className="text-xs opacity-60 mt-1">{s.author}</p>
            {s.origen === 'descubierta' && (
              <p className="text-[11px] opacity-50 mt-1">{t('reader.ready_to_read')}</p>
            )}
            {s.porque?.length > 0 && (
              <p className="text-[11px] opacity-40 mt-0.5 line-clamp-2">
                {t('suggest.because', { tags: s.porque.join(', ') })}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
