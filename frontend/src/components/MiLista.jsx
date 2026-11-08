import { motion } from 'framer-motion';
import { Bookmark, BookmarkX } from 'lucide-react';
import Baldosa from './biblioteca/Baldosa';
import { useI18n } from '../i18n/I18nContext';
import { estaEmpezada, porLecturaReciente } from '../lecturas';
import { PAGINA, REJILLA } from './pagina';
import { PageHeader, SectionHeader } from './ui/Layout';
import { IconButton } from './ui/Buttons';
import { EmptyState } from './ui/Feedback';

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
              <IconButton
                icon={BookmarkX}
                size="sm"
                onClick={(e) => { e.stopPropagation(); onQuitar(item); }}
                title={t('mylist.remove')}
                aria-label={t('mylist.remove_aria', { title: item.title })}
                className="absolute bottom-3 right-1 md:bottom-auto md:top-2 md:right-2 !p-3 md:!p-2 !rounded-full !bg-black/70 !text-gray-300 md:opacity-0 md:group-hover:opacity-100 hover:!text-white transition-all"
              />
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
      <PageHeader
        title={t('nav.mylist')}
        subtitle={marcadas.length === 0
          ? t('mylist.empty_hint')
          : marcadas.length === 1
            ? t('mylist.count_one')
            : t('mylist.count', { n: marcadas.length })}
      />

      {marcadas.length > 0 ? (
        <Rejilla obras={marcadas} onDetalle={onDetalle} onQuitar={onQuitar} t={t} />
      ) : (
        <EmptyState icon={Bookmark} title={t('mylist.empty')} />
      )}

      {sugeridas.length > 0 && (
        <section className="mt-16">
          <SectionHeader title={t('mylist.most_read')} description={t('mylist.most_read_desc')} className="mb-6" />
          <Rejilla obras={sugeridas} onDetalle={onDetalle} t={t} />
        </section>
      )}
    </main>
  );
}
