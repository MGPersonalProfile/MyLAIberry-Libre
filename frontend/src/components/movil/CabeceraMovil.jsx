import { Plus } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import Baya from '../Baya';

export default function CabeceraMovil({ scrolled, alIrA, alImportar }) {
  const { t } = useI18n();
  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${
        scrolled ? 'bg-[#141414]/90 backdrop-blur-xl' : 'bg-gradient-to-b from-black/80 to-transparent'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="h-14 px-4 flex items-center gap-2">
        <button type="button" onClick={() => alIrA('inicio')} className="flex items-center gap-1 text-2xl font-bold text-red-600 tracking-tighter mr-auto">
          <Baya className="w-6 h-6 -mt-0.5" />MyLAIberry
        </button>
        <button type="button" onClick={alImportar} aria-label={t('nav.import')} className="w-11 h-11 grid place-items-center rounded-full active:bg-white/10">
          <Plus className="w-6 h-6" />
        </button>
      </div>
    </header>
  );
}
