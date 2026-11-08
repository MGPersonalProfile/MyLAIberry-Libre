import { useState, useMemo } from 'react';
import { Compass, X } from 'lucide-react';
import { PAGINA, SUBTITULO_PAGINA, REJILLA } from './pagina';
import { PageHeader, SectionHeader } from './ui/Layout';
import { SecondaryButton } from './ui/Buttons';
import { EmptyState, Tag } from './ui/Feedback';
import Baldosa from './biblioteca/Baldosa';
import { useI18n } from '../i18n/I18nContext';
import useEsMovil from '../hooks/useEsMovil';
import CampoDeBusqueda from './movil/CampoDeBusqueda';
import { fandomsAgrupados, claveDeFandom } from '../fandom';

const CAT_FANDOM = 'fandom';
const CAT_GENERO = 'genre';

function facetas(library, categoria) {
  const cuenta = new Map();
  for (const obra of library) {

    const suyas = new Set(
      (obra.tags || [])
        .filter(t => t.category === categoria && t.name)
        .map(t => String(t.name).trim())
    );
    for (const nombre of suyas) cuenta.set(nombre, (cuenta.get(nombre) || 0) + 1);
  }
  return [...cuenta.entries()]
    .map(([nombre, n]) => ({ nombre, n }))
    .sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre));
}

function Chips({ items, activo, onElegir }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ nombre, n, clave = nombre }) => {
        const puesto = activo === clave;
        return (
          <Tag key={clave} active={puesto} onClick={() => onElegir(puesto ? null : clave)} className="!px-3 !py-1.5 !text-small">
            <span className="truncate max-w-[16rem]">{nombre}</span>
            <span className="opacity-60 text-caption">{n}</span>
          </Tag>
        );
      })}
    </div>
  );
}

export default function Explorar({ library = [], onDetalle, consulta = '', alBuscar, resultados = [] }) {
  const { t } = useI18n();
  const esMovil = useEsMovil();
  const buscando = esMovil && consulta.trim() !== '';
  const [fandom, setFandom] = useState(null);
  const [genero, setGenero] = useState(null);

  const fandoms = useMemo(() => fandomsAgrupados(library, CAT_FANDOM), [library]);
  const generos = useMemo(() => facetas(library, CAT_GENERO), [library]);

  const filtradas = useMemo(() => {
    if (!fandom && !genero) return [];
    return library.filter(obra => {
      const tiene = (cat, nombre) => (obra.tags || [])
        .some(x => x.category === cat && String(x.name).trim() === nombre);

      if (fandom && !(obra.tags || []).some(x => x.category === CAT_FANDOM && claveDeFandom(x.name) === fandom)) return false;
      if (genero && !tiene(CAT_GENERO, genero)) return false;
      return true;
    });
  }, [library, fandom, genero]);

  const hayFiltro = !!(fandom || genero);

  return (
    <main className={PAGINA}>
      <PageHeader
        title={esMovil ? t('mobile.search') : t('nav.explore')}
        subtitle={esMovil ? undefined : t('explore.subtitle')}
        className={esMovil ? '!mb-3' : '!mb-6'}
      />
      {esMovil && <CampoDeBusqueda consulta={consulta} alBuscar={alBuscar} />}
      {buscando ? (
        <>
          <p className={SUBTITULO_PAGINA}>{t('explore.results', { n: resultados.length })}</p>
          <div className={REJILLA}>
            {resultados.map(item => <Baldosa key={item.id} obra={item} alAbrir={(o) => onDetalle && onDetalle(o)} />)}
          </div>
        </>
      ) : (<>

      <section className="mb-8">
        <SectionHeader title={`${t('explore.by_fandom')} · ${fandoms.length}`} />
        {fandoms.length > 0
          ? <Chips items={fandoms} activo={fandom} onElegir={setFandom} />
          : <p className="text-small text-text-tertiary px-1">{t('explore.none_yet')}</p>}
      </section>

      <section className="mb-10">
        <SectionHeader title={`${t('explore.by_genre')} · ${generos.length}`} />
        {generos.length > 0
          ? <Chips items={generos} activo={genero} onElegir={setGenero} />
          : <p className="text-small text-text-tertiary px-1">{t('explore.none_yet')}</p>}
      </section>

      {hayFiltro ? (
        <>
          <div className="flex items-baseline gap-4 mb-6 pt-6 border-t border-separator">
            <p className="text-text-secondary">
              {t('explore.results', { n: filtradas.length })}
            </p>
            <SecondaryButton size="sm" icon={X} onClick={() => { setFandom(null); setGenero(null); }}>
              {t('explore.clear')}
            </SecondaryButton>
          </div>

          <div className={REJILLA}>
            {filtradas.map(item => <Baldosa key={item.id} obra={item} alAbrir={(o) => onDetalle && onDetalle(o)} />)}
          </div>
        </>
      ) : (
        <div className="border-t border-separator">
          <EmptyState icon={Compass} title={t('explore.pick')} />
        </div>
      )}
      </>)}
    </main>
  );
}
