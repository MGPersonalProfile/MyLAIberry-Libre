import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Eye, MessageSquare, NotebookPen } from 'lucide-react';

import Asistente from '../asistente/Asistente';
import Cuaderno from './Cuaderno';
import { useI18n } from '../../i18n/I18nContext';

export default function PanelAsistente({ punto, parrafos, alCerrar }) {
  const { t } = useI18n();
  const [vista, setVista] = useState('chat');

  const alcance = punto
    ? t(parrafos ? 'assistant.panel_sees' : 'assistant.panel_sees_short',
        { cap: punto.chapter + 1, par: punto.paragraph + 1, total: parrafos })
    : t('assistant.panel_nothing');

  return (
    <motion.aside
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.25 }}
      className="fixed top-0 right-0 bottom-0 w-full sm:w-[420px] z-[215] bg-[#141414] border-l border-white/10 shadow-2xl shadow-black/60 flex flex-col"
      role="complementary"
      aria-label={t('assistant.panel_aria')}
    >
      <header className="flex items-center justify-between px-5 pt-10 pb-4 border-b border-white/10">
        <div>
          <h2 className="font-bold text-white">{t('assistant.panel')}</h2>

          <p className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-0.5">
            <Eye className="w-3 h-3" />
            {alcance}
          </p>
        </div>

        <button
          onClick={alCerrar}
          aria-label={t('assistant.panel_close')}
          className="p-3 rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      <nav className="flex gap-1 px-4 pt-2 shrink-0" aria-label={t('assistant.panel')}>
        <Solapa activa={vista === 'chat'} onClick={() => setVista('chat')} icono={MessageSquare}>
          {t('notebook.talk')}
        </Solapa>
        <Solapa activa={vista === 'cuaderno'} onClick={() => setVista('cuaderno')} icono={NotebookPen}>
          {t('notebook.title')}
        </Solapa>
      </nav>

      <div className="flex-1 min-h-0">
        {vista === 'chat' ? <Asistente punto={punto} /> : <Cuaderno punto={punto} />}
      </div>
    </motion.aside>
  );
}

function Solapa({ activa, onClick, icono: Icono, children }) {
  return (
    <button
      onClick={onClick}
      aria-current={activa ? 'page' : undefined}
      className={`flex items-center gap-1.5 px-3 min-h-[44px] rounded-t-lg text-[12px] transition-colors ${
        activa ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-200'
      }`}
    >
      <Icono className="w-3.5 h-3.5" /> {children}
    </button>
  );
}
