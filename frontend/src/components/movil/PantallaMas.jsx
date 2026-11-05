import { Bookmark, Users, Compass, Settings, Download } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { InsetGroupedList, ActionCell } from '../ui/List';

export default function PantallaMas({ alIrA, alImportar }) {
  const { t } = useI18n();
  return (
    <main className="px-4 pt-24 pb-8 space-y-6 max-w-[var(--container-compact)] mx-auto">
      <h1 className="text-title-1 text-text-primary">{t('mobile.more')}</h1>
      <InsetGroupedList>
        <ActionCell
          icon={Bookmark}
          iconBg="bg-accent text-white"
          title={t('nav.mylist')}
          navigation
          onClick={() => alIrA('milista')}
        />
        <ActionCell
          icon={Users}
          iconBg="bg-accent-soft text-accent"
          title={t('nav.authors')}
          navigation
          onClick={() => alIrA('autores')}
        />
        <ActionCell
          icon={Compass}
          iconBg="bg-warning/15 text-warning"
          title={t('carousel.discoveries')}
          navigation
          onClick={() => alIrA('descubrimientos')}
        />
      </InsetGroupedList>
      <InsetGroupedList>
        <ActionCell
          icon={Download}
          iconBg="bg-success/15 text-success"
          title={t('mobile.import')}
          navigation
          onClick={alImportar}
        />
        <ActionCell
          icon={Settings}
          iconBg="bg-surface-secondary text-text-secondary"
          title={t('settings.nav')}
          navigation
          onClick={() => alIrA('ajustes')}
        />
      </InsetGroupedList>
    </main>
  );
}
