import { Check, X } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';

export default function GenerosDeLaObra({ generos, propuestos, origenDeGenero, alDecidir }) {
  const { t } = useI18n();
  return (
      <div className="mt-6">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">
          {t('genres.title')}
        </h3>

        {generos.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {generos.map(g => (
              <span
                key={g.name}
                title={t(origenDeGenero(g.origen))}
                className={`px-3 py-1 rounded-full border text-xs flex items-center gap-1.5 ${
                  g.origen === 'modelo' || g.origen === 'propagado'
                    ? 'border-white/15 text-gray-400'
                    : 'border-white/25 text-gray-200'
                }`}
              >
                {g.name}

                {(g.origen === 'modelo' || g.origen === 'propagado') && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500/70" />
                )}
              </span>
            ))}
          </div>
        )}

        {propuestos.length > 0 && (
          <>
            <p className="text-xs text-gray-600 mb-2">{t('genres.proposed_help')}</p>
            <div className="flex flex-wrap gap-2">
              {propuestos.map(g => (
                <span
                  key={g.nombre}
                  className="pl-3 pr-1 py-1 rounded-full border border-dashed border-amber-500/40 text-xs text-amber-200/80 flex items-center gap-1"
                >
                  {g.nombre}
                  <button
                    onClick={() => alDecidir(g.nombre, true)}
                    title={t('genres.accept')}
                    aria-label={t('genres.accept_aria', { g: g.nombre })}
                    className="p-1 rounded-full hover:bg-green-500/20 hover:text-green-400 transition-colors"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => alDecidir(g.nombre, false)}
                    title={t('genres.reject')}
                    aria-label={t('genres.reject_aria', { g: g.nombre })}
                    className="p-1 rounded-full hover:bg-red-500/20 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </>
        )}
      </div>
  );
}
