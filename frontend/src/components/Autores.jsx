import { motion } from 'framer-motion';
import { Bell, BellOff, Clock } from 'lucide-react';
import Cover from './Cover';
import { useI18n } from '../i18n/I18nContext';
import { PAGINA } from './pagina';
import { PageHeader } from './ui/Layout';
import { SecondaryButton } from './ui/Buttons';
import { EmptyState } from './ui/Feedback';
import { pulsable } from '../pulsable';

function haceCuanto(t, marca) {
  if (!marca) return t('authors.never_checked');
  const ms = Date.now() - marca;
  const min = Math.round(ms / 60000);
  if (min < 60) return t('authors.checked_min', { n: Math.max(1, min) });
  const h = Math.round(min / 60);
  if (h < 24) return t('authors.checked_hour', { n: h });
  return t('authors.checked_day', { n: Math.round(h / 24) });
}

export default function Autores({ autores = [], library = [], onDejarDeSeguir, onDetalle }) {
  const { t } = useI18n();

  if (autores.length === 0) {
    return (
      <main className={PAGINA}>
        <PageHeader title={t('nav.authors')} />
        <EmptyState icon={Bell} title={t('authors.empty')} description={t('authors.empty_hint')} className="py-24" />
      </main>
    );
  }

  return (
    <main className={PAGINA}>
      <PageHeader title={t('nav.authors')} subtitle={t('authors.count', { n: autores.length })} />

      <div className="space-y-12">
        {autores.map(autor => {
          const suyas = library.filter(o => o.autorUrl && o.autorUrl === autor.url);

          return (
            <motion.section
              key={autor.url}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <header className="flex items-start justify-between gap-6 mb-4 pb-3 border-b border-separator">
                <div className="min-w-0">
                  <h3 className="text-title-3 text-text-primary truncate">{autor.nombre}</h3>
                  <p className="text-footnote text-text-secondary mt-1 flex items-center gap-3 flex-wrap">
                    <span>{autor.fuente}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {haceCuanto(t, autor.comprobadoEn)}
                    </span>

                    {suyas.length > 0 && <span>{t('authors.works_in_library', { n: suyas.length })}</span>}
                  </p>
                </div>
                <SecondaryButton
                  size="sm"
                  icon={BellOff}
                  onClick={() => onDejarDeSeguir && onDejarDeSeguir(autor.url)}
                  title={t('authors.unfollow')}
                  className="shrink-0 whitespace-nowrap hover:!border-destructive/50 hover:!text-destructive"
                >
                  {t('authors.unfollow')}
                </SecondaryButton>
              </header>

              {suyas.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                  {suyas.map(obra => (
                    <div
                      key={obra.id}
                      {...pulsable(() => onDetalle && onDetalle(obra), obra.title)}
                      className="cursor-pointer rounded-md overflow-hidden aspect-[2/3] transition-transform duration-300 hover:scale-105 hover:z-10 hover:shadow-xl hover:shadow-black/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
                    >
                      <Cover story={obra} className="w-full h-full" imgClassName="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              ) : (

                <p className="text-small text-text-tertiary">{t('authors.no_works')}</p>
              )}
            </motion.section>
          );
        })}
      </div>
    </main>
  );
}
