import { useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { DestructiveButton, SecondaryButton } from '../ui/Buttons';
import { Notice, Tag } from '../ui/Feedback';

export default function Historial({ conversaciones = [], actual, ocupado, respondiendo = [], nuevas = [], sinLeer = [], alAbrir, alBorrar }) {
  const { t } = useI18n();
  const [confirmar, setConfirmar] = useState(null);
  const marca = (id) => (respondiendo.includes(id) ? '… ' : sinLeer.includes(id) ? '● ' : '');

  const lista = sinLeer.find(id => id !== actual);
  const ordenadas = [...conversaciones].sort((a, b) =>
    (b.messages?.at(-1)?.at || b.createdAt) - (a.messages?.at(-1)?.at || a.createdAt));
  return (
    <div className="px-4 py-2 border-b border-separator space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <select aria-label={t('assistant.history')} value={actual || ''}
          onChange={e => { setConfirmar(null); alAbrir(e.target.value); }}
          className="min-w-0 flex-1 max-md:basis-full rounded-md bg-surface-secondary border border-border/60 px-2 min-h-[var(--control-btn-h)] text-small text-text-primary focus:outline-none focus:border-accent">
          <option value="">{t('assistant.new_chat')}</option>
          {nuevas.map(h => <option key={h.id} value={h.id}>
            {marca(h.id)}{h.title || t('assistant.new_chat')}
          </option>)}
          {ordenadas.map(h => <option key={h.id} value={h.id}>
            {marca(h.id)}{new Date(h.createdAt).toLocaleDateString()} · {h.title}
          </option>)}
        </select>

        {actual && <SecondaryButton size="sm" className="whitespace-nowrap" onClick={() => { alAbrir(null); setConfirmar(null); }}>+ {t('assistant.new_short')}</SecondaryButton>}
        {actual && <DestructiveButton size="sm" disabled={ocupado} onClick={() => setConfirmar(actual)}>{t('assistant.delete_chat')}</DestructiveButton>}
      </div>
      {lista && <Tag tone="success" onClick={() => { setConfirmar(null); alAbrir(lista); }}>● {t('assistant.reply_ready')}</Tag>}
      {confirmar && (
        <Notice tone="warning" compact action={(
          <span className="flex gap-2">
            <DestructiveButton size="sm" disabled={ocupado} onClick={async () => { if (await alBorrar(confirmar)) setConfirmar(null); }}>{t('assistant.delete_chat')}</DestructiveButton>
            <SecondaryButton size="sm" onClick={() => setConfirmar(null)}>{t('common.cancel')}</SecondaryButton>
          </span>
        )}>{t('assistant.delete_question')}</Notice>
      )}
    </div>
  );
}
