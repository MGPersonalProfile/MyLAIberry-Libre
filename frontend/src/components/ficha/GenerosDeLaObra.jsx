import { Check, X } from 'lucide-react';
import { Tag } from '../ui/Feedback';
import { useI18n } from '../../i18n/I18nContext';

export default function GenerosDeLaObra({ generos, propuestos, origenDeGenero, alDecidir }) {
  const { t } = useI18n();
  return (
    <div className="mt-6">
      <h3 className="text-caption font-semibold text-text-secondary uppercase tracking-wider mb-2">
        {t('genres.title')}
      </h3>

      {generos.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {generos.map(g => (
            <Tag
              key={g.name}
              title={t(origenDeGenero(g.origen))}
              className="px-2.5 py-1 text-footnote"
            >
              {g.name}
              {(g.origen === 'modelo' || g.origen === 'propagado') && (
                <span className="w-1.5 h-1.5 rounded-full bg-warning" />
              )}
            </Tag>
          ))}
        </div>
      )}

      {propuestos.length > 0 && (
        <>
          <p className="text-footnote text-text-secondary mb-2">{t('genres.proposed_help')}</p>
          <div className="flex flex-wrap gap-2">
            {propuestos.map(g => (
              <span
                key={g.nombre}
                className="pl-3 pr-1 py-1 rounded-sm border border-dashed border-warning/45 bg-warning/10 text-footnote text-text-primary flex items-center gap-1"
              >
                {g.nombre}
                <button
                  type="button"
                  onClick={() => alDecidir(g.nombre, true)}
                  title={t('genres.accept')}
                  aria-label={t('genres.accept_aria', { g: g.nombre })}
                  className="p-1.5 max-md:p-2 rounded-xs hover:bg-success/15 hover:text-success transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => alDecidir(g.nombre, false)}
                  title={t('genres.reject')}
                  aria-label={t('genres.reject_aria', { g: g.nombre })}
                  className="p-1.5 max-md:p-2 rounded-xs hover:bg-destructive/15 hover:text-destructive transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
