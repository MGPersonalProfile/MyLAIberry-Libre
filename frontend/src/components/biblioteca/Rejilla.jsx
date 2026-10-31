import { useState } from 'react';
import { Search } from 'lucide-react';
import Baldosa from './Baldosa';
import { useI18n } from '../../i18n/I18nContext';
import useIniciativa from '../../hooks/useIniciativa';
import { PAGINA, TITULO_PAGINA, SUBTITULO_PAGINA, REJILLA } from '../pagina';

const SOLO = ['shelves'];
const ESTADOS = [['en pausa', 'reading_status.paused'], ['abandonada', 'reading_status.dropped'], ['leída fuera', 'reading_status.read_elsewhere']];

export default function Rejilla({ obras, consulta, alAbrir }) {
  const { t } = useI18n();
  const { estanterias } = useIniciativa(null, { solo: SOLO });
  const [filtro, setFiltro] = useState(null);

  const estados = ESTADOS.filter(([e]) => obras.some(o => o.estadoLectura === e));
  const conObras = estanterias.filter(e => e.ids.length);
  const estante = filtro?.estanteria && conObras.find(e => e.id === filtro.estanteria);

  const vigente = filtro && (filtro.estado ? estados.some(([e]) => e === filtro.estado) : !!estante) ? filtro : null;
  const vistas = !vigente ? obras
    : vigente.estado ? obras.filter(o => o.estadoLectura === vigente.estado)
    : obras.filter(o => estante.ids.map(String).includes(String(o.id)));
  const chip = (activo) => `px-3 py-1 rounded-full border text-xs transition-colors ${activo
    ? 'border-white/40 bg-white/10 text-white' : 'border-white/15 text-gray-400 hover:border-white/30 hover:text-gray-200'}`;

  return (
    <main className={PAGINA}>
      <h2 className={TITULO_PAGINA}>
        {consulta ? t('library.results_for', { q: consulta }) : t('library.mine')}
      </h2>
      <p className={SUBTITULO_PAGINA}>
        {vistas.length} {vistas.length === 1 ? t('library.story_one') : t('library.story_other')}
      </p>

      {(estados.length > 0 || conObras.length > 0) && (
        <div className="flex flex-wrap gap-2 mb-6" data-filtros-biblioteca>
          <button onClick={() => setFiltro(null)} aria-pressed={!vigente} className={chip(!vigente)}>{t('library.filter_all')}</button>
          {estados.map(([e, clave]) => (
            <button key={e} onClick={() => setFiltro({ estado: e })} aria-pressed={vigente?.estado === e} className={chip(vigente?.estado === e)}>
              {t(clave)}
            </button>
          ))}
          {conObras.map(e => (
            <button key={e.id} onClick={() => setFiltro({ estanteria: e.id })} aria-pressed={vigente?.estanteria === e.id}
                    className={chip(vigente?.estanteria === e.id)}>
              {e.name}
            </button>
          ))}
        </div>
      )}

      {vistas.length > 0 ? (
        <div className={REJILLA}>
          {vistas.map(obra => <Baldosa key={obra.id} obra={obra} alAbrir={alAbrir} />)}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-32 text-gray-500">
          <Search className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-xl font-medium">{t('library.no_results')}</p>
          <p className="text-sm mt-2">{t('library.no_results_hint')}</p>
        </div>
      )}
    </main>
  );
}
