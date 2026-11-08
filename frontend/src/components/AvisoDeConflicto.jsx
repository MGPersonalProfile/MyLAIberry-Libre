import { X } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { IconButton } from './ui/Buttons';
import { Notice } from './ui/Feedback';

export default function AvisoDeConflicto({ equipo, alCerrar }) {
  const { t } = useI18n();
  if (!equipo) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[300] w-[calc(100%-2rem)] max-w-xl rounded-lg bg-surface shadow-2xl">
      <Notice tone="warning" action={<IconButton size="sm" icon={X} onClick={alCerrar} label={t('common.close')} />}>
        {t('sync.conflict', { equipo })}
      </Notice>
    </div>
  );
}
