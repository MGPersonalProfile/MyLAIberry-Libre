import { useState } from 'react';
import { Bell, X, ChevronDown } from 'lucide-react';

import { Seccion } from './piezas';
import { useI18n } from '../../i18n/I18nContext';

const DEFECTO = { kudosMinimos: 500, palabrasMinimas: 20000, capitulosMinimos: 1, soloCompletas: false };

function Liston({ etiqueta, ayuda, valor, opciones, onCambiar, formato }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{etiqueta}</p>
      {ayuda && <p className="text-[11px] text-gray-600 mb-2 leading-snug">{ayuda}</p>}
      <div className="flex gap-1.5 flex-wrap mt-1.5">
        {opciones.map(n => (
          <button
            key={n}
            onClick={() => onCambiar(n)}
            aria-pressed={valor === n}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
              valor === n
                ? 'border-red-500 text-red-400 bg-red-500/10'
                : 'border-white/10 text-gray-400 hover:border-white/30 hover:text-white'
            }`}
          >
            {formato(n)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SeccionVigiladas({ suscripciones, nueva, alEscribir, alAnadir, alQuitar }) {
  const { t } = useI18n();
  const [umbral, setUmbral] = useState(DEFECTO);
  const [abierto, setAbierto] = useState(false);

  const poner = (cambios) => setUmbral(u => ({ ...u, ...cambios }));
  const miles = (n) => (n >= 1000 ? `${n / 1000}k` : String(n));

  return (
    <Seccion icono={Bell} titulo={t('settings.watching')} descripcion={t('settings.watching_desc')}>
      <div className="space-y-4">
        {suscripciones.length > 0 && (
          <ul className="space-y-2">
            {suscripciones.map(s => (
              <li key={s.id} className="flex items-center justify-between gap-4 bg-white/[0.03] border border-white/10 rounded-lg px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{s.consulta}</p>

                  <p className="text-xs text-gray-500 mt-0.5">
                    {t('settings.watching_threshold', {
                      kudos: (s.umbral?.kudosMinimos ?? 0).toLocaleString(),
                      palabras: (s.umbral?.palabrasMinimas ?? 0).toLocaleString()
                    })}
                    {(s.umbral?.capitulosMinimos ?? 0) > 1 && ` · ${t('settings.watching_chapters', { n: s.umbral.capitulosMinimos })}`}
                    {s.umbral?.soloCompletas && ` · ${t('settings.watching_only_done')}`}
                  </p>
                </div>
                <button
                  onClick={() => alQuitar(s.id)}
                  title={t('settings.watching_remove')}
                  aria-label={t('settings.watching_remove')}
                  className="p-2 rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); alAnadir(umbral); }}
          className="space-y-3"
        >
          <div className="flex gap-2 flex-wrap">
            <input
              value={nueva}
              onChange={(e) => alEscribir(e.target.value)}
              placeholder={t('settings.watching_placeholder')}
              aria-label={t('settings.watching_placeholder')}
              className="flex-1 min-w-[16rem] bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30"
            />
            <button
              type="button"
              onClick={() => setAbierto(a => !a)}
              aria-expanded={abierto}
              className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors border border-white/10 text-gray-400 hover:border-white/30 hover:text-white"
            >
              {t('settings.watching_bar')}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${abierto ? 'rotate-180' : ''}`} />
            </button>
            <button
              type="submit"
              disabled={!nueva.trim()}
              className="px-4 py-2 rounded-lg bg-white text-black font-semibold text-sm hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('settings.watching_add')}
            </button>
          </div>

          {!abierto && (
            <p className="text-[11px] text-gray-600">
              {t('settings.watching_bar_summary', {
                kudos: umbral.kudosMinimos.toLocaleString(),
                palabras: umbral.palabrasMinimas.toLocaleString()
              })}
            </p>
          )}

          {abierto && (
            <div className="p-5 rounded-xl bg-white/[0.03] border border-white/10 space-y-5">
              <p className="text-xs text-gray-500 leading-relaxed max-w-2xl">
                {t('settings.watching_bar_why')}
              </p>

              <div className="grid sm:grid-cols-3 gap-5">
                <Liston
                  etiqueta={t('settings.watching_kudos')}
                  ayuda={t('settings.watching_kudos_help')}
                  valor={umbral.kudosMinimos}
                  opciones={[0, 100, 500, 2000, 10000]}
                  onCambiar={(n) => poner({ kudosMinimos: n })}
                  formato={(n) => (n === 0 ? t('settings.watching_any') : miles(n))}
                />
                <Liston
                  etiqueta={t('settings.watching_words')}
                  ayuda={t('settings.watching_words_help')}
                  valor={umbral.palabrasMinimas}
                  opciones={[0, 20000, 50000, 150000, 400000]}
                  onCambiar={(n) => poner({ palabrasMinimas: n })}
                  formato={(n) => (n === 0 ? t('settings.watching_any') : miles(n))}
                />
                <Liston
                  etiqueta={t('settings.watching_chapters_label')}
                  valor={umbral.capitulosMinimos}
                  opciones={[1, 5, 20, 50]}
                  onCambiar={(n) => poner({ capitulosMinimos: n })}
                  formato={(n) => (n === 1 ? t('settings.watching_any') : String(n))}
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={umbral.soloCompletas}
                  onChange={(e) => poner({ soloCompletas: e.target.checked })}
                  className="mt-0.5 accent-red-600 w-4 h-4"
                />
                <span>
                  <span className="text-sm text-white">{t('settings.watching_only_done')}</span>

                  <span className="block text-[11px] text-gray-600 leading-snug mt-0.5">
                    {t('settings.watching_only_done_help')}
                  </span>
                </span>
              </label>
            </div>
          )}
        </form>
      </div>
    </Seccion>
  );
}
