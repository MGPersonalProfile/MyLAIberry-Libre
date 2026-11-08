import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Eye, MessageSquare, NotebookPen } from 'lucide-react';

import Asistente from '../asistente/Asistente';
import Cuaderno from './Cuaderno';
import { useI18n } from '../../i18n/I18nContext';
import { IconButton } from '../ui/Buttons';
import { SegmentedControl } from '../ui/Controls';

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
      className="dark fixed top-0 right-0 bottom-0 w-full sm:w-[420px] z-[215] bg-background text-text-primary border-l border-border shadow-2xl shadow-black/60 flex flex-col"
      role="complementary"
      aria-label={t('assistant.panel_aria')}
    >
      <header className="flex items-center justify-between px-5 pt-10 pb-4 border-b border-separator">
        <div>
          <h2 className="text-headline text-text-primary">{t('assistant.panel')}</h2>

          <p className="flex items-center gap-1.5 text-caption text-text-secondary mt-0.5">
            <Eye className="w-3 h-3" />
            {alcance}
          </p>
        </div>

        <IconButton icon={X} onClick={alCerrar} label={t('assistant.panel_close')} />
      </header>

      <div className="px-4 pt-3 shrink-0">
        <SegmentedControl ariaLabel={t('assistant.panel')} value={vista} onChange={setVista} options={[
          { id: 'chat', etiqueta: t('notebook.talk'), icono: MessageSquare },
          { id: 'cuaderno', etiqueta: t('notebook.title'), icono: NotebookPen }
        ]} />
      </div>

      <div className="flex-1 min-h-0">
        {vista === 'chat' ? <Asistente punto={punto} /> : <Cuaderno punto={punto} />}
      </div>
    </motion.aside>
  );
}
