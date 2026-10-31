import { useI18n } from '../../i18n/I18nContext';

export default function ResumenPrevio({
  recap, recapError, mejorandoRecap, mejorarRecap, cerrarRecap, alAbrirAjustes
}) {
  const { t } = useI18n();

  return (
    <div className="mb-10 border-l-2 border-current/30 pl-5 py-1 opacity-75">
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <p className="text-[11px] uppercase tracking-widest opacity-60">
          {t('recap.previously')}
        </p>
        <button
          onClick={cerrarRecap}
          className="text-[11px] uppercase tracking-wider opacity-50 hover:opacity-100 transition-opacity"
        >
          {t('recap.dismiss')}
        </button>
      </div>
      <p className="text-sm italic leading-relaxed">{recap.texto}</p>

      {recapError ? (
        <div className="mt-2 flex items-baseline gap-3 flex-wrap">
          <p className="text-[11px] text-amber-400/90">
            {recapError === 'sin-clave' ? t('recap.needs_key') : t('recap.failed')}
          </p>
          {recapError === 'sin-clave' && alAbrirAjustes && (
            <button
              onClick={alAbrirAjustes}
              className="text-[11px] underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity"
            >
              {t('recap.open_settings')}
            </button>
          )}
        </div>
      ) : (

        <button
          onClick={() => mejorarRecap(recap.origen === 'modelo')}
          disabled={mejorandoRecap}
          className="mt-2 text-[11px] opacity-50 hover:opacity-100 underline underline-offset-2 transition-opacity disabled:no-underline disabled:cursor-wait"
        >
          {mejorandoRecap
            ? t('recap.improving')
            : recap.origen === 'modelo' ? t('recap.again') : t('recap.improve')}
        </button>
      )}
    </div>
  );
}
