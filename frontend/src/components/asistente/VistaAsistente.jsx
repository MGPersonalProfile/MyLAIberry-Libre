import { useState } from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';
import Asistente from './Asistente';
import PanelIniciativa from './PanelIniciativa';
import { useI18n } from '../../i18n/I18nContext';

export default function VistaAsistente() {
  const { t } = useI18n();
  const [vista, setVista] = useState('chat');

  return (
    <div className="flex flex-col h-full">
      <nav className="flex gap-1 px-6 pt-2 shrink-0 max-md:mx-4 max-md:mt-2 max-md:p-1 max-md:rounded-xl max-md:bg-white/[0.07]" aria-label={t('nav.assistant')}>
        <Pestana activa={vista === 'chat'} onClick={() => setVista('chat')} icono={MessageSquare}>
          {t('nav.assistant')}
        </Pestana>
        <Pestana activa={vista === 'iniciativa'} onClick={() => setVista('iniciativa')} icono={Sparkles}>
          {t('initiative.title')}
        </Pestana>
      </nav>

      <div className="flex-1 min-h-0">
        {vista === 'chat' ? <Asistente punto={null} /> : <PanelIniciativa />}
      </div>
    </div>
  );
}

function Pestana({ activa, onClick, icono: Icono, children }) {
  return (
    <button
      onClick={onClick}
      aria-current={activa ? 'page' : undefined}
      className={`flex items-center gap-2 px-4 py-2 rounded-t-xl text-sm transition-colors max-md:flex-1 max-md:justify-center max-md:rounded-lg max-md:h-11 ${
        activa ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-200'
      }`}
    >
      <Icono className="w-4 h-4" /> {children}
    </button>
  );
}
