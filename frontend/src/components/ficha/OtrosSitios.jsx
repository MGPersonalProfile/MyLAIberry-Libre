import { useI18n } from '../../i18n/I18nContext';

export default function OtrosSitios({ dePago, libres, total, resultados, alBuscar, alImportar }) {
  const { t } = useI18n();

  if (!dePago) return null;

  return (
      <div className="mt-6 border border-amber-500/25 bg-amber-500/5 rounded-lg p-4">
        <p className="text-sm text-amber-300/90">
          {t('paywall.summary', {
            libres,
            total
          })}
        </p>
        <p className="text-xs text-gray-400 mt-1">{t('paywall.explain')}</p>

        {resultados === null && (
          <button
            onClick={() => alBuscar()}
            className="mt-3 px-3 py-2 rounded-lg text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            {t('paywall.search')}
          </button>
        )}

        {resultados === 'buscando' && (
          <p className="text-xs text-gray-400 mt-3">{t('paywall.searching')}</p>
        )}

        {Array.isArray(resultados) && resultados.length === 0 && (
          <p className="text-xs text-gray-400 mt-3">{t('paywall.none')}</p>
        )}

        {Array.isArray(resultados) && resultados.length > 0 && (
          <ul className="mt-3 space-y-2">
            {resultados.map(o => (
              <li key={o.url} className="flex items-center justify-between gap-3 bg-black/20 rounded px-3 py-2">
                <span className="min-w-0">
                  <span className="block text-sm text-white truncate">{o.title}</span>
                  <span className="block text-[11px] text-gray-400">
                    {o.sitio}
                    {o.author ? ` · ${o.author}` : ''}
                    {o.totalChapters ? ` · ${o.totalChapters} cap.` : ''}
                  </span>
                </span>
                <button
                  onClick={() => alImportar(o.url)}
                  className="px-3 py-1.5 rounded text-xs bg-white text-black font-semibold hover:bg-gray-200 transition-colors shrink-0"
                >
                  {t('paywall.import')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
  );
}
