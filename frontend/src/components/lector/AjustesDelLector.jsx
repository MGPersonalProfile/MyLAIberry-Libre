import { motion } from 'framer-motion';
import { Moon, Sun, BookOpen, Type } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';
import AjustesDeVoz from '../AjustesDeVoz';
import BajarAudio from './BajarAudio';
import ObraEnteraEnMp3 from './ObraEnteraEnMp3';
import { IconButton } from '../ui/Buttons';
import { SegmentedControl } from '../ui/Controls';

const TITULO = 'text-xs text-text-secondary font-bold uppercase tracking-wider mb-3';

function Seccion({ titulo, children }) {
  return (
    <div>
      <p className={TITULO}>{titulo}</p>
      {children}
    </div>
  );
}

function Tamano({ cuerpo, alCambiarCuerpo }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between rounded-lg bg-surface-secondary p-1 border border-border/50">
      <IconButton icon={Type} size="sm" label={t('reader.size_smaller')} onClick={() => alCambiarCuerpo(-2)} />
      <span className="font-mono text-lg tabular-nums">{cuerpo}px</span>
      <IconButton icon={Type} label={t('reader.size_larger')} onClick={() => alCambiarCuerpo(2)} />
    </div>
  );
}

function TemaYTipografia({ tema, alCambiarTema, fuente, alCambiarFuente }) {
  const { t } = useI18n();
  return (
    <>
      <Seccion titulo={t('reader.theme')}>
        <SegmentedControl stretch ariaLabel={t('reader.theme')} value={tema} onChange={alCambiarTema} options={[
          { id: 'dark', etiqueta: t('reader.theme_dark'), icono: Moon },
          { id: 'sepia', etiqueta: t('reader.theme_sepia'), icono: BookOpen },
          { id: 'light', etiqueta: t('reader.theme_light'), icono: Sun }
        ]} />
      </Seccion>
      <Seccion titulo={t('reader.typography')}>
        <SegmentedControl stretch ariaLabel={t('reader.typography')} value={fuente} onChange={alCambiarFuente} options={[
          { id: 'serif', etiqueta: t('reader.font_serif') },
          { id: 'sans', etiqueta: t('reader.font_sans') }
        ]} />
      </Seccion>
    </>
  );
}

function VelocidadAutomatica({ valor, alCambiar }) {
  const { t } = useI18n();
  return (
    <Seccion titulo={t('reader.auto_speed')}>
      <SegmentedControl stretch ariaLabel={t('reader.auto_speed')} value={Number(valor)} onChange={alCambiar} options={[
        { id: 20, etiqueta: t('reader.auto_slow') },
        { id: 30, etiqueta: t('reader.auto_normal') },
        { id: 45, etiqueta: t('reader.auto_fast') }
      ]} />
    </Seccion>
  );
}

export default function AjustesDelLector({
  tema, alCambiarTema,
  fuente, alCambiarFuente,
  cuerpo, alCambiarCuerpo,
  hayVoz, vocesDelIdioma, ajustesVoz, alCambiarVoz,
  autoVelocidad, alCambiarAutoVelocidad,

  audio,

  enHoja
}) {
  const { t } = useI18n();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      className={enHoja ? 'dark flex flex-col gap-6 text-text-primary' : 'dark absolute right-0 top-12 w-80 bg-surface text-text-primary border border-border rounded-xl p-4 shadow-2xl flex flex-col gap-6'}
    >
      <TemaYTipografia tema={tema} alCambiarTema={alCambiarTema} fuente={fuente} alCambiarFuente={alCambiarFuente} />
      <Seccion titulo={t('reader.size')}>
        <Tamano cuerpo={cuerpo} alCambiarCuerpo={alCambiarCuerpo} />
      </Seccion>
      {hayVoz && <AjustesDeVoz voces={vocesDelIdioma} ajustes={ajustesVoz} alCambiar={alCambiarVoz} />}
      {audio && (
        <div className="empty:hidden">
          <BajarAudio key={`${audio.obraId}:${audio.capitulo}:${audio.idioma || ''}`} {...audio} />
          <ObraEnteraEnMp3 key={`${audio.obraId}:${audio.idioma || ''}`} obraId={audio.obraId} idioma={audio.idioma} />
        </div>
      )}
      {enHoja && <VelocidadAutomatica valor={autoVelocidad} alCambiar={alCambiarAutoVelocidad} />}
    </motion.div>
  );
}
