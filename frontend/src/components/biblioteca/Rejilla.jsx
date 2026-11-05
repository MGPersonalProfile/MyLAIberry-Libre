import { useState } from 'react';
import { Search, LayoutGrid, List } from 'lucide-react';
import Baldosa from './Baldosa';
import Cover from '../Cover';
import { useI18n } from '../../i18n/I18nContext';
import useIniciativa from '../../hooks/useIniciativa';
import { PAGINA, REJILLA } from '../pagina';
import { PageHeader } from '../ui/Layout';
import { SearchField, SegmentedControl } from '../ui/Controls';
import { InsetGroupedList, ActionCell, Divider } from '../ui/List';
import { EmptyState, Tag } from '../ui/Feedback';

const SOLO = ['shelves'];
const ESTADOS = [['en pausa', 'reading_status.paused'], ['abandonada', 'reading_status.dropped'], ['leída fuera', 'reading_status.read_elsewhere']];

function ListaDeObras({ obras, alAbrir }) {
  return (
    <InsetGroupedList>
      {obras.map((obra, idx) => {
        const capActual = (obra.currentChapter || 0) + 1;
        const capTotal = obra.totalChapters || '?';
        return (
          <div key={obra.id}>
            {idx > 0 && <Divider inset />}
            <ActionCell
              icon={() => (
                <div className="w-10 h-14 rounded-sm overflow-hidden shrink-0 border border-border/60">
                  <Cover story={obra} className="w-full h-full" imgClassName="w-full h-full object-cover" />
                </div>
              )}
              title={obra.title}
              subtitle={obra.author}
              detail={obra.totalChapters > 0 ? `${capActual}/${capTotal}` : undefined}
              chevron
              onClick={() => alAbrir(obra)}
            />
          </div>
        );
      })}
    </InsetGroupedList>
  );
}

export default function Rejilla({ obras, consulta, alBuscar, alAbrir }) {
  const { t } = useI18n();
  const { estanterias } = useIniciativa(null, { solo: SOLO });
  const [filtro, setFiltro] = useState(null);
  const [modoVista, setModoVista] = useState('rejilla');

  const estados = ESTADOS.filter(([e]) => obras.some(o => o.estadoLectura === e));
  const conObras = estanterias.filter(e => e.ids.length);
  const estante = filtro?.estanteria && conObras.find(e => e.id === filtro.estanteria);

  const vigente = filtro && (filtro.estado ? estados.some(([e]) => e === filtro.estado) : !!estante) ? filtro : null;
  const vistas = !vigente ? obras
    : vigente.estado ? obras.filter(o => o.estadoLectura === vigente.estado)
    : obras.filter(o => estante.ids.map(String).includes(String(o.id)));

  const subtitulo = `${vistas.length} ${vistas.length === 1 ? t('library.story_one') : t('library.story_other')}`;

  return (
    <main className={PAGINA}>
      <PageHeader
        title={consulta ? t('library.results_for', { q: consulta }) : t('library.mine')}
        subtitle={subtitulo}
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            {alBuscar && (
              <SearchField
                value={consulta}
                onChange={alBuscar}
                placeholder={t('nav.search_placeholder')}
                className="w-56 md:w-64"
              />
            )}
            <SegmentedControl
              value={modoVista}
              onChange={setModoVista}
              options={[
                { id: 'rejilla', label: t('library.view_grid'), icon: LayoutGrid },
                { id: 'lista', label: t('library.view_list'), icon: List }
              ]}
            />
          </div>
        }
      />

      {(estados.length > 0 || conObras.length > 0) && (
        <div className="flex flex-wrap gap-2 mb-6" data-filtros-biblioteca>
          <Tag onClick={() => setFiltro(null)} active={!vigente}>{t('library.filter_all')}</Tag>
          {estados.map(([e, clave]) => (
            <Tag key={e} onClick={() => setFiltro({ estado: e })} active={vigente?.estado === e}>
              {t(clave)}
            </Tag>
          ))}
          {conObras.map(e => (
            <Tag key={e.id} onClick={() => setFiltro({ estanteria: e.id })} active={vigente?.estanteria === e.id}>
              {e.name}
            </Tag>
          ))}
        </div>
      )}

      {vistas.length > 0 ? (
        modoVista === 'lista' ? (
          <ListaDeObras obras={vistas} alAbrir={alAbrir} />
        ) : (
          <div className={REJILLA}>
            {vistas.map(obra => <Baldosa key={obra.id} obra={obra} alAbrir={alAbrir} />)}
          </div>
        )
      ) : (
        <EmptyState
          icon={Search}
          title={t('library.no_results')}
          description={t('library.no_results_hint')}
        />
      )}
    </main>
  );
}
