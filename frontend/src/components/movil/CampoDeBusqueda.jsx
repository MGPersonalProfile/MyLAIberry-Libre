import { Search, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

export default function CampoDeBusqueda({ consulta, alBuscar }) {
  const { t } = useI18n();
  return (
    <div className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-30 -mx-4 px-4 py-2 mb-4 bg-[#141414]/90 backdrop-blur-xl">
      <label className="relative block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        <input
          type="search"
          value={consulta}
          onChange={(e) => alBuscar(e.target.value)}
          placeholder={t('nav.search_placeholder')}
          enterKeyHint="search"
          className="w-full h-11 rounded-xl bg-white/10 pl-10 pr-10 text-base text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600 [&::-webkit-search-cancel-button]:hidden"
        />
        {consulta && (
          <button type="button" onClick={() => alBuscar('')} aria-label={t('explore.clear')} className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center text-gray-400 active:text-white">
            <X className="w-4 h-4" />
          </button>
        )}
      </label>
    </div>
  );
}
