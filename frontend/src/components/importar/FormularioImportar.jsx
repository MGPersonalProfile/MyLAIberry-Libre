import { useState } from 'react';
import { Link2, FileUp, Zap, Server, Globe } from 'lucide-react';
import { PrimaryButton, SecondaryButton } from '../ui/Buttons';
import { SegmentedControl } from '../ui/Controls';
import { Tag } from '../ui/Feedback';
import { InsetGroupedList } from '../ui/List';
import ImportarWeb from '../ImportarWeb';
import { useI18n } from '../../i18n/I18nContext';

const SITIOS = ['RoyalRoad', 'AO3', 'FanFiction.net', 'SpaceBattles', 'Project Gutenberg'];

function InsigniaSitio({ detectedSite, t }) {
  if (!detectedSite) {
    return (
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-1.5">
          {SITIOS.map(s => <Tag key={s}>{s}</Tag>)}
        </div>
        <p className="text-caption text-text-tertiary">{t('import.supports')}</p>
      </div>
    );
  }
  const iconos = {
    1: <Zap className="w-3.5 h-3.5 text-success" />,
    2: <Server className="w-3.5 h-3.5 text-accent" />,
    3: <Globe className="w-3.5 h-3.5 text-text-secondary" />
  };
  const etiquetas = {
    1: t('import.tier_native'),
    2: t('import.tier_fichub'),
    3: t('import.tier_universal')
  };
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-surface-secondary text-footnote text-text-primary">
      {iconos[detectedSite.tier]}
      <span className="font-semibold">{detectedSite.name}</span>
      <span className="text-text-tertiary">·</span>
      <span className="text-text-secondary">{etiquetas[detectedSite.tier]}</span>
    </div>
  );
}

export default function FormularioImportar({
  url, setUrl, status, detectedSite,
  puedeDisco, puedeSubir,
  onImport, onImportarLibro, onPedirSubida,
  onImportSuccess, onClose, children
}) {
  const { t } = useI18n();
  const [modo, setModo] = useState('todo');
  const mostrarUrl = modo === 'todo' || modo === 'enlace';
  const mostrarOtros = (modo === 'todo' || modo === 'archivo') && status === 'idle';

  return (
    <div className="space-y-5">
      <SegmentedControl
        value={modo}
        onChange={setModo}
        ariaLabel={t('import.title')}
        className="w-full grid grid-cols-3"
        options={[
          { id: 'todo', etiqueta: t('import.mode_all') },
          { id: 'enlace', icono: Link2, etiqueta: t('import.mode_link') },
          { id: 'archivo', icono: FileUp, etiqueta: t('import.mode_file') }
        ]}
      />

      {mostrarUrl && (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 w-full min-h-[var(--control-search-h)] max-md:min-h-11 px-3.5 rounded-md bg-surface-secondary border border-border focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 transition-all">
            <Link2 className="w-4 h-4 text-text-secondary shrink-0" />
            <input
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              enterKeyHint="go"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={status === 'scraping'}
              placeholder={t('import.placeholder')}
              className="flex-1 min-w-0 bg-transparent text-body text-text-primary placeholder:text-text-tertiary focus:outline-none disabled:opacity-50"
              onKeyDown={(e) => e.key === 'Enter' && onImport()}
            />
          </div>

          {status === 'idle' && <InsigniaSitio detectedSite={detectedSite} t={t} />}

          {status === 'idle' && (
            <PrimaryButton onClick={onImport} className="w-full">
              {t('import.extract')}
            </PrimaryButton>
          )}
        </div>
      )}

      {children}

      {mostrarOtros && (
        <InsetGroupedList padded>
          <div className="space-y-2">
            {puedeDisco && (
              <SecondaryButton icon={FileUp} onClick={onImportarLibro} className="w-full">
                {t('import.from_disk')}
              </SecondaryButton>
            )}
            {puedeSubir && (
              <SecondaryButton icon={FileUp} onClick={onPedirSubida} className="w-full">
                {t('import.from_phone')}
              </SecondaryButton>
            )}
            <ImportarWeb
              url={url.trim()}
              alImportar={() => { onImportSuccess?.(); onClose(); }}
            />
          </div>
        </InsetGroupedList>
      )}
    </div>
  );
}
