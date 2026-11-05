import { Plus } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import Baya from '../Baya';
import { IconButton } from '../ui/Buttons';

export default function CabeceraMovil({ scrolled, alIrA, alImportar }) {
  const { t } = useI18n();
  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-[background-color,backdrop-filter] duration-300 ${
        scrolled
          ? 'bg-background/55 backdrop-blur-xl backdrop-saturate-150'
          : 'bg-gradient-to-b from-black/70 to-transparent'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="h-14 px-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => alIrA('inicio')}
          className="flex items-center gap-1.5 text-title-3 text-text-primary tracking-tight mr-auto"
        >
          <Baya className="w-6 h-6 -mt-0.5 text-accent" />
          MyLAIberry
        </button>
        <IconButton
          icon={Plus}
          onClick={alImportar}
          aria-label={t('nav.import')}
        />
      </div>
    </header>
  );
}
