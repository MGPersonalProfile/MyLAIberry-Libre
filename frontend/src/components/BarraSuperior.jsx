import { Search, Plus, SlidersHorizontal } from 'lucide-react';

import { useI18n } from '../i18n/I18nContext';
import { LANGS } from '../i18n/dicts';
import { PESTANAS } from './pestanas';
import { pulsable } from '../pulsable';
import Baya from './Baya';
import { PrimaryButton, IconButton } from './ui/Buttons';
import { SearchField, SegmentedControl } from './ui/Controls';

export default function BarraSuperior({
  vista, alIrA, scrolled, consulta, alBuscar,
  buscadorAbierto, alAlternarBuscador, alImportar, lang, alCambiarIdioma, avisoAsistente
}) {
  const { t } = useI18n();
  const esInicioSinScroll = vista === 'inicio' && !scrolled;

  return (
    <nav
      className={`flex items-center justify-between gap-4 px-6 lg:px-8 pb-2.5 pt-9 fixed top-0 w-full z-50 transition-colors duration-150 ${
        esInicioSinScroll
          ? 'bg-surface/85 backdrop-blur-md border-b border-separator/60'
          : 'bg-surface/95 backdrop-blur-md border-b border-separator'
      }`}
    >
      <div className="flex items-center gap-4 lg:gap-6 min-w-0">
        <h1
          className="flex items-center gap-1.5 text-title-3 text-text-primary tracking-tight cursor-pointer shrink-0"
          {...pulsable(() => alIrA('inicio'), 'MyLAIberry — ir al inicio')}
        >
          <Baya className="w-6 h-6 -mt-0.5 text-accent" />
          MyLAIberry
        </h1>

        <ul className="flex items-center gap-1 text-body text-text-secondary whitespace-nowrap min-w-0 overflow-x-auto scrollbar-hide">
          {PESTANAS.map(p => {
            const activa = vista === p.id;
            return (
              <li
                key={p.id}
                {...pulsable(() => alIrA(p.id), t(p.clave))}
                aria-current={activa ? 'page' : undefined}
                className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent ${
                  activa
                    ? 'bg-surface-secondary text-text-primary font-semibold'
                    : 'hover:text-text-primary hover:bg-surface-hover/60'
                }`}
              >
                {t(p.clave)}{p.id === 'asistente' && avisoAsistente === 'respondiendo' && <span className="ml-1 text-warning animate-pulse" role="status" aria-label={t('assistant.replying')}>◌</span>}{p.id === 'asistente' && avisoAsistente === 'listo' && <span className="ml-1 text-success" aria-label={t('assistant.reply_ready')}>●</span>}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <div className="flex items-center gap-1.5">
          {buscadorAbierto && (
            <div className="w-56">
              <SearchField
                value={consulta}
                onChange={alBuscar}
                placeholder={t('nav.search_placeholder')}
                autoFocus
              />
            </div>
          )}
          <IconButton
            icon={Search}
            active={buscadorAbierto}
            onClick={alAlternarBuscador}
            aria-label={t('nav.search_placeholder')}
          />
        </div>

        <PrimaryButton icon={Plus} onClick={alImportar}>
          {t('nav.import')}
        </PrimaryButton>

        <IconButton
          icon={SlidersHorizontal}
          active={vista === 'ajustes'}
          onClick={() => alIrA('ajustes')}
          title={t('settings.nav')}
          aria-label={t('settings.nav')}
        />

        <SegmentedControl
          value={lang}
          onChange={alCambiarIdioma}
          ariaLabel={t('nav.language')}
          options={LANGS.map(codigo => ({
            id: codigo,
            etiqueta: codigo.toUpperCase(),
            title: t('nav.language')
          }))}
        />
      </div>
    </nav>
  );
}
