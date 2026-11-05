import { useState } from 'react';
import { Bell, X, ChevronDown } from 'lucide-react';

import { Seccion } from './piezas';
import { PrimaryButton, SecondaryButton, IconButton } from '../ui/Buttons';
import { Tag } from '../ui/Feedback';
import { Card } from '../ui/Layout';
import { useI18n } from '../../i18n/I18nContext';

const DEFECTO = { kudosMinimos: 500, palabrasMinimas: 20000, capitulosMinimos: 1, soloCompletas: false };

function Liston({ etiqueta, ayuda, valor, opciones, onCambiar, formato }) {
  return (
    <div>
      <p className="text-caption uppercase tracking-wide text-text-secondary">{etiqueta}</p>
      {ayuda && <p className="text-caption text-text-tertiary mb-2 leading-snug">{ayuda}</p>}
      <div className="flex gap-1.5 flex-wrap mt-1.5">
        {opciones.map(n => (
          <Tag
            key={n}
            onClick={() => onCambiar(n)}
            active={valor === n}
            tone="accent"
          >
            {formato(n)}
          </Tag>
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
              <li key={s.id} className="flex items-center justify-between gap-4 bg-surface-secondary border border-border rounded-md px-4 py-3">
                <div className="min-w-0">
                  <p className="text-callout font-medium text-text-primary truncate">{s.consulta}</p>
                  <p className="text-footnote text-text-secondary mt-0.5">
                    {t('settings.watching_threshold', {
                      kudos: (s.umbral?.kudosMinimos ?? 0).toLocaleString(),
                      palabras: (s.umbral?.palabrasMinimas ?? 0).toLocaleString()
                    })}
                    {(s.umbral?.capitulosMinimos ?? 0) > 1 && ` · ${t('settings.watching_chapters', { n: s.umbral.capitulosMinimos })}`}
                    {s.umbral?.soloCompletas && ` · ${t('settings.watching_only_done')}`}
                  </p>
                </div>
                <IconButton
                  icon={X}
                  label={t('settings.watching_remove')}
                  onClick={() => alQuitar(s.id)}
                  size="sm"
                />
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
              className="flex-1 min-w-[16rem] bg-surface-secondary border border-border rounded-md px-4 py-2 text-callout text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent"
            />
            <SecondaryButton
              type="button"
              onClick={() => setAbierto(a => !a)}
              aria-expanded={abierto}
            >
              {t('settings.watching_bar')}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${abierto ? 'rotate-180' : ''}`} />
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={!nueva.trim()}>
              {t('settings.watching_add')}
            </PrimaryButton>
          </div>

          {!abierto && (
            <p className="text-caption text-text-tertiary">
              {t('settings.watching_bar_summary', {
                kudos: umbral.kudosMinimos.toLocaleString(),
                palabras: umbral.palabrasMinimas.toLocaleString()
              })}
            </p>
          )}

          {abierto && (
            <Card className="bg-surface-secondary space-y-5">
              <p className="text-footnote text-text-secondary leading-relaxed max-w-2xl">
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
                  className="mt-0.5 accent-accent w-4 h-4"
                />
                <span>
                  <span className="text-callout text-text-primary">{t('settings.watching_only_done')}</span>
                  <span className="block text-caption text-text-tertiary leading-snug mt-0.5">
                    {t('settings.watching_only_done_help')}
                  </span>
                </span>
              </label>
            </Card>
          )}
        </form>
      </div>
    </Seccion>
  );
}
