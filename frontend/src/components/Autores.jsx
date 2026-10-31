import { motion } from 'framer-motion';
import { Bell, BellOff, Clock } from 'lucide-react';
import Cover from './Cover';
import { useI18n } from '../i18n/I18nContext';
import { PAGINA, TITULO_PAGINA, SUBTITULO_PAGINA } from './pagina';
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
        <h2 className={TITULO_PAGINA}>{t('nav.authors')}</h2>
        <div className="flex flex-col items-center justify-center py-32 text-gray-500">
          <Bell className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-xl font-medium">{t('authors.empty')}</p>
          <p className="text-sm mt-2 max-w-md text-center">{t('authors.empty_hint')}</p>
        </div>
      </main>
    );
  }

  return (
    <main className={PAGINA}>
      <h2 className={TITULO_PAGINA}>{t('nav.authors')}</h2>
      <p className={SUBTITULO_PAGINA}>{t('authors.count', { n: autores.length })}</p>

      <div className="space-y-12">
        {autores.map(autor => {
          const suyas = library.filter(o => o.autorUrl && o.autorUrl === autor.url);

          return (
            <motion.section
              key={autor.url}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <header className="flex items-start justify-between gap-6 mb-4 pb-3 border-b border-white/10">
                <div className="min-w-0">
                  <h3 className="text-xl font-bold text-white truncate">{autor.nombre}</h3>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                    <span>{autor.fuente}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {haceCuanto(t, autor.comprobadoEn)}
                    </span>

                    {suyas.length > 0 && <span>{t('authors.works_in_library', { n: suyas.length })}</span>}
                  </p>
                </div>
                <button
                  onClick={() => onDejarDeSeguir && onDejarDeSeguir(autor.url)}
                  title={t('authors.unfollow')}
                  className="shrink-0 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap border border-gray-700 text-gray-400 hover:border-red-500/50 hover:text-red-400 transition-colors"
                >
                  <BellOff className="w-4 h-4" /> {t('authors.unfollow')}
                </button>
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

                <p className="text-sm text-gray-600">{t('authors.no_works')}</p>
              )}
            </motion.section>
          );
        })}
      </div>
    </main>
  );
}
