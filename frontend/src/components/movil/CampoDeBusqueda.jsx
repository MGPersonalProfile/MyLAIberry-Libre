import { useI18n } from '../../i18n/I18nContext';
import { SearchField } from '../ui/Controls';

export default function CampoDeBusqueda({ consulta, alBuscar }) {
  const { t } = useI18n();
  return (
    <div className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-30 -mx-4 px-4 py-2 mb-4 bg-background/90 backdrop-blur-md">
      <SearchField
        value={consulta}
        onChange={alBuscar}
        placeholder={t('nav.search_placeholder')}
        clearLabel={t('explore.clear')}
      />
    </div>
  );
}
