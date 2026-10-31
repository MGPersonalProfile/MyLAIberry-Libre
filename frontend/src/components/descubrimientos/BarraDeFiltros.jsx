import { useState } from 'react';
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';

import { hayFiltro, FILTRO_VACIO } from './filtros';
import { useI18n } from '../../i18n/I18nContext';

function Pastilla({ activa, onClick, children, titulo }) {
  return (
    <button
      onClick={onClick}
      title={titulo}
      aria-pressed={activa}
      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
        activa
          ? 'border-red-500 text-red-400 bg-red-500/10'
          : 'border-white/10 text-gray-400 hover:border-white/30 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function Minimo({ etiqueta, valor, opciones, onCambiar, formato = (n) => n.toLocaleString() }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">{etiqueta}</p>
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
        <div className="relative flex-1 min-w-[14rem] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            value={filtro.texto}
            onChange={(e) => poner({ texto: e.target.value })}
            placeholder={t('discover.search_placeholder')}
            aria-label={t('discover.search_placeholder')}
            className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-8 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30"
          />
          {filtro.texto && (
            <button
              onClick={() => poner({ texto: '' })}
              aria-label={t('discover.search_clear')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 text-xs uppercase tracking-wide">{t('discover.sort')}</span>
          <select
            value={filtro.orden}
            onChange={(e) => poner({ orden: e.target.value })}
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
          >
            {ORDENES.map(([id, texto]) => <option key={id} value={id}>{texto}</option>)}
          </select>
        </label>

        <button
          onClick={() => setAbierto(a => !a)}
          aria-expanded={abierto}
          className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors border ${
            abierto || puesto
              ? 'border-white/30 text-white'
              : 'border-white/10 text-gray-400 hover:border-white/30 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {t('discover.filters')}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${abierto ? 'rotate-180' : ''}`} />
        </button>

        {puesto && (
          <button
            onClick={() => alCambiar({ ...FILTRO_VACIO })}
            className="px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
          >
            {t('discover.clear')}
          </button>
        )}

        <p className="text-sm text-gray-500 ml-auto whitespace-nowrap">
          {mostrados === total
            ? t('discover.count', { n: total })
            : t('discover.count_filtered', { n: mostrados, total })}
        </p>
      </div>

      {abierto && (
        <div className="mt-4 p-5 rounded-xl bg-white/[0.03] border border-white/10 space-y-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">{t('discover.source')}</p>
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
              <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">{t('discover.state')}</p>
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
                <p className="text-[11px] text-gray-600 mt-2 leading-snug">{t('discover.state_note')}</p>
              )}
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">{t('discover.availability')}</p>
              <div className="flex gap-1.5 flex-wrap">
                {[['todas', t('discover.state_all')], ['leibles', t('discover.readable')]].map(([id, texto]) => (
                  <Pastilla key={id} activa={filtro.disponible === id} onClick={() => poner({ disponible: id })}>
                    {texto}
                  </Pastilla>
                ))}
              </div>
              <p className="text-[11px] text-gray-600 mt-2 leading-snug">{t('discover.readable_note')}</p>
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
              <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">
                {t('discover.tags')}
                {filtro.etiquetas.length > 1 && (
                  <span className="ml-2 normal-case tracking-normal text-gray-600">{t('discover.tags_all')}</span>
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
