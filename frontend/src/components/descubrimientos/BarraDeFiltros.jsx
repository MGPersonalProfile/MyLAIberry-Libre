import { useState } from 'react';
import { SlidersHorizontal, ChevronDown } from 'lucide-react';

import { hayFiltro, FILTRO_VACIO } from './filtros';
import { useI18n } from '../../i18n/I18nContext';
import { SearchField } from '../ui/Controls';
import { SecondaryButton } from '../ui/Buttons';
import { Tag } from '../ui/Feedback';

function Pastilla({ activa, onClick, children, titulo }) {
  return <Tag active={activa} onClick={onClick} title={titulo} className="whitespace-nowrap">{children}</Tag>;
}

function Minimo({ etiqueta, valor, opciones, onCambiar, formato = (n) => n.toLocaleString() }) {
  return (
    <div>
      <p className="text-caption uppercase tracking-wide text-text-secondary mb-2">{etiqueta}</p>
      <div className="flex gap-1.5 flex-wrap">
        {opciones.map(n => (
          <Pastilla key={n} activa={valor === n} onClick={() => onCambiar(valor === n ? 0 : n)}>
            {n === 0 ? '—' : formato(n)}
          </Pastilla>
        ))}
      </div>
    </div>
  );
}

export default function BarraDeFiltros({ filtro, alCambiar, resumen, total, mostrados }) {
  const { t } = useI18n();
  const [abierto, setAbierto] = useState(false);

  const poner = (cambios) => alCambiar({ ...filtro, ...cambios });
  const alternarEn = (lista, valor) =>
    lista.includes(valor) ? lista.filter(x => x !== valor) : [...lista, valor];

  const puesto = hayFiltro(filtro);

  const ORDENES = [
    ['afinidad', t('discover.sort_affinity')],
    ['reciente', t('discover.sort_recent')],
    ['kudos', t('discover.sort_kudos')],
    ['palabras', t('discover.sort_words')],
    ['capitulos', t('discover.sort_chapters')],
    ['titulo', t('discover.sort_title')]
  ];

  return (
    <div className="mb-8">

      <div className="flex items-center gap-3 flex-wrap">
        <SearchField
          value={filtro.texto}
          onChange={(texto) => poner({ texto })}
          placeholder={t('discover.search_placeholder')}
          clearLabel={t('discover.search_clear')}
          className="flex-1 min-w-[14rem] max-w-md"
        />

        <label className="flex items-center gap-2 text-sm">
          <span className="text-text-secondary text-footnote uppercase tracking-wide">{t('discover.sort')}</span>
          <select
            value={filtro.orden}
            onChange={(e) => poner({ orden: e.target.value })}
            className="bg-surface-secondary border border-border/60 rounded-md px-3 min-h-[var(--control-search-h)] text-body text-text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
          >
            {ORDENES.map(([id, texto]) => <option key={id} value={id}>{texto}</option>)}
          </select>
        </label>

        <SecondaryButton
          onClick={() => setAbierto(a => !a)}
          aria-expanded={abierto}
          icon={SlidersHorizontal}
          className={abierto || puesto ? 'border-accent/60' : ''}
        >
          {t('discover.filters')}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${abierto ? 'rotate-180' : ''}`} />
        </SecondaryButton>

        {puesto && (
          <SecondaryButton onClick={() => alCambiar({ ...FILTRO_VACIO })}>
            {t('discover.clear')}
          </SecondaryButton>
        )}

        <p className="text-small text-text-secondary ml-auto whitespace-nowrap">
          {mostrados === total
            ? t('discover.count', { n: total })
            : t('discover.count_filtered', { n: mostrados, total })}
        </p>
      </div>

      {abierto && (
        <div className="mt-4 p-5 rounded-lg bg-surface border border-border/70 space-y-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <p className="text-caption uppercase tracking-wide text-text-secondary mb-2">{t('discover.source')}</p>
              <div className="flex gap-1.5 flex-wrap">
                {resumen.fuentes.map(([nombre, cuantas]) => (
                  <Pastilla
                    key={nombre}
                    activa={filtro.fuentes.includes(nombre)}
                    onClick={() => poner({ fuentes: alternarEn(filtro.fuentes, nombre) })}
                  >
                    {nombre} <span className="opacity-50">{cuantas}</span>
                  </Pastilla>
                ))}
              </div>
            </div>

            <div>
              <p className="text-caption uppercase tracking-wide text-text-secondary mb-2">{t('discover.state')}</p>
              <div className="flex gap-1.5 flex-wrap">
                {[['todas', t('discover.state_all')],
                  ['completas', t('discover.state_done')],
                  ['en-curso', t('discover.state_ongoing')]].map(([id, texto]) => (
                  <Pastilla key={id} activa={filtro.estado === id} onClick={() => poner({ estado: id })}>
                    {texto}
                  </Pastilla>
                ))}
              </div>

              {filtro.estado !== 'todas' && (
                <p className="text-caption text-text-tertiary mt-2 leading-snug">{t('discover.state_note')}</p>
              )}
            </div>

            <div>
              <p className="text-caption uppercase tracking-wide text-text-secondary mb-2">{t('discover.availability')}</p>
              <div className="flex gap-1.5 flex-wrap">
                {[['todas', t('discover.state_all')], ['leibles', t('discover.readable')]].map(([id, texto]) => (
                  <Pastilla key={id} activa={filtro.disponible === id} onClick={() => poner({ disponible: id })}>
                    {texto}
                  </Pastilla>
                ))}
              </div>
              <p className="text-caption text-text-tertiary mt-2 leading-snug">{t('discover.readable_note')}</p>
            </div>

            <Minimo
              etiqueta={t('discover.min_chapters')}
              valor={filtro.capitulosMin}
              opciones={[0, 5, 20, 50, 100]}
              onCambiar={(n) => poner({ capitulosMin: n })}
              formato={(n) => `${n}+`}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <Minimo
              etiqueta={t('discover.min_words')}
              valor={filtro.palabrasMin}
              opciones={[0, 20000, 50000, 150000, 400000]}
              onCambiar={(n) => poner({ palabrasMin: n })}
              formato={(n) => (n >= 1000 ? `${n / 1000}k+` : `${n}+`)}
            />
            <Minimo
              etiqueta={t('discover.min_kudos')}
              valor={filtro.kudosMin}
              opciones={[0, 100, 500, 2000, 10000]}
              onCambiar={(n) => poner({ kudosMin: n })}
              formato={(n) => (n >= 1000 ? `${n / 1000}k+` : `${n}+`)}
            />
          </div>

          {resumen.etiquetas.length > 0 && (
            <div>
              <p className="text-caption uppercase tracking-wide text-text-secondary mb-2">
                {t('discover.tags')}
                {filtro.etiquetas.length > 1 && (
                  <span className="ml-2 normal-case tracking-normal text-text-tertiary">{t('discover.tags_all')}</span>
                )}
              </p>
              <div className="flex gap-1.5 flex-wrap max-h-32 overflow-y-auto">
                {resumen.etiquetas.map(([nombre, cuantas]) => (
                  <Pastilla
                    key={nombre}
                    activa={filtro.etiquetas.includes(nombre)}
                    onClick={() => poner({ etiquetas: alternarEn(filtro.etiquetas, nombre) })}
                  >
                    {nombre} <span className="opacity-50">{cuantas}</span>
                  </Pastilla>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
