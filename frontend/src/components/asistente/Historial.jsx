import { useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';

export default function Historial({ conversaciones = [], actual, ocupado, respondiendo = [], nuevas = [], sinLeer = [], alAbrir, alBorrar }) {
  const { t } = useI18n();
  const [confirmar, setConfirmar] = useState(null);
  const marca = (id) => (respondiendo.includes(id) ? '… ' : sinLeer.includes(id) ? '● ' : '');

  const lista = sinLeer.find(id => id !== actual);
  const ordenadas = [...conversaciones].sort((a, b) =>
    (b.messages?.at(-1)?.at || b.createdAt) - (a.messages?.at(-1)?.at || a.createdAt));
  return (
    <div className="px-4 py-2 border-b border-white/10 space-y-2">
      <div className="flex gap-2 items-center">
        <select aria-label={t('assistant.history')} value={actual || ''}
          onChange={e => { setConfirmar(null); alAbrir(e.target.value); }}
          className="min-w-0 flex-1 bg-[#181818] rounded-lg p-2 text-sm">
          <option value="">{t('assistant.new_chat')}</option>
          {nuevas.map(h => <option key={h.id} value={h.id}>
            {marca(h.id)}{h.title || t('assistant.new_chat')}
          </option>)}
          {ordenadas.map(h => <option key={h.id} value={h.id}>
            {marca(h.id)}{new Date(h.createdAt).toLocaleDateString()} · {h.title}
          </option>)}
        </select>

        {actual && <button onClick={() => { alAbrir(null); setConfirmar(null); }}
          className="p-2 text-sm whitespace-nowrap disabled:opacity-40">+ {t('assistant.new_short')}</button>}
        {actual && <button disabled={ocupado} onClick={() => setConfirmar(actual)}
          className="p-2 text-sm text-gray-400 disabled:opacity-40">{t('assistant.delete_chat')}</button>}
      </div>
      {lista && <button onClick={() => { setConfirmar(null); alAbrir(lista); }}
        className="block text-left text-xs text-emerald-400 py-1">● {t('assistant.reply_ready')}</button>}
      {confirmar && <div className="flex gap-3 items-center text-sm" role="alert">
        <span>{t('assistant.delete_question')}</span>
        <button disabled={ocupado} className="text-red-400 p-2" onClick={async () => {
          if (await alBorrar(confirmar)) setConfirmar(null);
        }}>{t('assistant.delete_chat')}</button>
        <button onClick={() => setConfirmar(null)} className="p-2">{t('common.cancel')}</button>
      </div>}
    </div>
  );
}
