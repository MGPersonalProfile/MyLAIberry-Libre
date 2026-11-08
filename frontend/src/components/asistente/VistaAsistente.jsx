import { useState } from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';
import Asistente from './Asistente';
import PanelIniciativa from './PanelIniciativa';
import { SegmentedControl } from '../ui/Controls';
import { useI18n } from '../../i18n/I18nContext';
import { useAlPedirAlAsistente } from '../../preguntaAlAsistente';

export default function VistaAsistente() {
  const { t } = useI18n();
  const [vista, setVista] = useState('chat');

  useAlPedirAlAsistente(() => setVista('chat'));

  return (
    <div className="flex flex-col h-full">
      <nav className="shrink-0 px-6 pt-3 max-md:px-4" aria-label={t('nav.assistant')}>
        <SegmentedControl value={vista} onChange={setVista} ariaLabel={t('nav.assistant')} className="max-md:w-full" stretch={false} options={[
          { id: 'chat', etiqueta: t('nav.assistant'), icono: MessageSquare },
          { id: 'iniciativa', etiqueta: t('initiative.title'), icono: Sparkles }
        ]} />
      </nav>

      <div className="flex-1 min-h-0">
        {vista === 'chat' ? <Asistente punto={null} /> : <PanelIniciativa />}
      </div>
    </div>
  );
}
