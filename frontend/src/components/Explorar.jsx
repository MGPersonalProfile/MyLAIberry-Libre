import { useState, useMemo } from 'react';
import { Compass, X } from 'lucide-react';
import { PAGINA, TITULO_PAGINA, SUBTITULO_PAGINA, REJILLA } from './pagina';
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
          <button
            key={clave}
            onClick={() => onElegir(puesto ? null : clave)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors flex items-center gap-2 ${
              puesto
                ? 'border-red-500 text-red-400 bg-red-500/10'
                : 'border-white/15 text-gray-300 hover:border-gray-400 hover:text-white'
            }`}
          >
            <span className="truncate max-w-[16rem]">{nombre}</span>
            <span className={puesto ? 'text-red-500/80 text-xs' : 'text-gray-600 text-xs'}>{n}</span>
          </button>
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
      <h2 className={TITULO_PAGINA}>{esMovil ? t('mobile.search') : t('nav.explore')}</h2>
      {esMovil
        ? <CampoDeBusqueda consulta={consulta} alBuscar={alBuscar} />
        : <p className={SUBTITULO_PAGINA}>{t('explore.subtitle')}</p>}
      {buscando ? (
        <>
          <p className={SUBTITULO_PAGINA}>{t('explore.results', { n: resultados.length })}</p>
          <div className={REJILLA}>
            {resultados.map(item => <Baldosa key={item.id} obra={item} alAbrir={(o) => onDetalle && onDetalle(o)} />)}
          </div>
        </>
      ) : (<>

      <section className="mb-8">
        <h3 className="text-sm uppercase tracking-widest text-gray-500 mb-3">
          {t('explore.by_fandom')} <span className="text-gray-700">· {fandoms.length}</span>
        </h3>
        {fandoms.length > 0
          ? <Chips items={fandoms} activo={fandom} onElegir={setFandom} />
          : <p className="text-sm text-gray-600">{t('explore.none_yet')}</p>}
      </section>

      <section className="mb-10">
        <h3 className="text-sm uppercase tracking-widest text-gray-500 mb-3">
          {t('explore.by_genre')} <span className="text-gray-700">· {generos.length}</span>
        </h3>
        {generos.length > 0
          ? <Chips items={generos} activo={genero} onElegir={setGenero} />
          : <p className="text-sm text-gray-600">{t('explore.none_yet')}</p>}
      </section>

      {hayFiltro ? (
        <>
          <div className="flex items-baseline gap-4 mb-6 pt-6 border-t border-white/10">
            <p className="text-gray-400">
              {t('explore.results', { n: filtradas.length })}
            </p>
            <button
              onClick={() => { setFandom(null); setGenero(null); }}
              className="text-sm text-gray-500 hover:text-white transition-colors flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> {t('explore.clear')}
            </button>
          </div>

          <div className={REJILLA}>
            {filtradas.map(item => <Baldosa key={item.id} obra={item} alAbrir={(o) => onDetalle && onDetalle(o)} />)}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500 border-t border-white/10">
          <Compass className="w-14 h-14 mb-4 opacity-30" />
          <p className="text-lg font-medium">{t('explore.pick')}</p>
        </div>
      )}
      </>)}
    </main>
  );
}
