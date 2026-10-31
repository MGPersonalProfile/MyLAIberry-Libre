import { motion } from 'framer-motion';
import { Bookmark, BookmarkX } from 'lucide-react';
import Baldosa from './biblioteca/Baldosa';
import { useI18n } from '../i18n/I18nContext';
import { estaEmpezada, porLecturaReciente } from '../lecturas';
import { PAGINA, TITULO_PAGINA, SUBTITULO_PAGINA, REJILLA } from './pagina';

function loQueMasLees(library, excluir = new Set(), tope = 12) {
  return library
    .filter(o => !excluir.has(o.id))
    .filter(estaEmpezada)
    .sort(porLecturaReciente)
    .slice(0, tope);
}

function Rejilla({ obras, onDetalle, onQuitar, t }) {
  return (
    <div className={REJILLA}>
      {obras.map(item => (
        <motion.div key={item.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Baldosa obra={item} alAbrir={(o) => onDetalle && onDetalle(o)}>

            {onQuitar && (
              <button
                onClick={(e) => { e.stopPropagation(); onQuitar(item); }}
                title={t('mylist.remove')}
                aria-label={t('mylist.remove_aria', { title: item.title })}
                className="absolute top-1 right-1 md:top-2 md:right-2 p-3 md:p-2 rounded-full bg-black/70 text-gray-300 md:opacity-0 md:group-hover:opacity-100 hover:text-white transition-all"
              >
                <BookmarkX className="w-4 h-4" />
              </button>
            )}
          </Baldosa>
        </motion.div>
      ))}
    </div>
  );
}

export default function MiLista({ library = [], onDetalle, onQuitar }) {
  const { t } = useI18n();

  const marcadas = library
    .filter(o => o.enMiLista)
    .sort((a, b) => b.enMiLista - a.enMiLista);

  const yaEstan = new Set(marcadas.map(o => o.id));

  const sugeridas = marcadas.length < 6 ? loQueMasLees(library, yaEstan) : [];

  return (
    <main className={PAGINA}>
      <h2 className={TITULO_PAGINA}>{t('nav.mylist')}</h2>
      <p className={SUBTITULO_PAGINA}>
        {marcadas.length === 0
          ? t('mylist.empty_hint')
          : marcadas.length === 1
            ? t('mylist.count_one')
            : t('mylist.count', { n: marcadas.length })}
      </p>

      {marcadas.length > 0 ? (
        <Rejilla obras={marcadas} onDetalle={onDetalle} onQuitar={onQuitar} t={t} />
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <Bookmark className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-xl font-medium">{t('mylist.empty')}</p>
        </div>
      )}

      {sugeridas.length > 0 && (
        <section className="mt-16">
          <h3 className="text-xl font-bold mb-1">{t('mylist.most_read')}</h3>
          <p className="text-sm text-gray-500 mb-6">{t('mylist.most_read_desc')}</p>
          <Rejilla obras={sugeridas} onDetalle={onDetalle} t={t} />
        </section>
      )}
    </main>
  );
}
