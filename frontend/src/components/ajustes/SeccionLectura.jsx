import { useEffect, useState } from 'react';
import { BookOpen, Moon, Sun, Type } from 'lucide-react';

import { Seccion, Opciones } from './piezas';
import { Divider } from '../ui/List';
import { useI18n } from '../../i18n/I18nContext';
import RitmoDeLectura from './RitmoDeLectura';
import MiLectura from './MiLectura';
import AjustesDeVoz from '../AjustesDeVoz';
import { enElMovil } from '../../vistaGuardada';
import { letraDelAparato, guardarLetra, LETRA_MINIMA, LETRA_MAXIMA } from '../../letraDelAparato';

function useVoces(idioma) {
  const [voces, setVoces] = useState([]);
  useEffect(() => {
    const motor = window.speechSynthesis;
    if (!motor) return undefined;
    const cargar = () => setVoces(motor.getVoices());
    cargar();
    if (motor.addEventListener) {
      motor.addEventListener('voiceschanged', cargar);
      return () => motor.removeEventListener('voiceschanged', cargar);
    }
    motor.onvoiceschanged = cargar;
    return () => { if (motor.onvoiceschanged === cargar) motor.onvoiceschanged = null; };
  }, []);
  return voces.filter(voz => voz.lang.toLowerCase().startsWith(idioma));
}

function TamanoDeLetra({ ajustes, alGuardarDiferido, alVolcar }) {
  const { t } = useI18n();
  const [movil, setMovil] = useState(() => (enElMovil() ? letraDelAparato(ajustes) : null));
  const valor = movil ?? ajustes.fontSize;
  const cambiar = (n) => {
    if (enElMovil()) setMovil(guardarLetra(n));
    else alGuardarDiferido({ fontSize: n });
  };
  return (
    <div>
      <p className="text-caption uppercase tracking-wider text-text-secondary mb-2">
        {t('reader.size')} · <span className="tabular-nums text-text-primary">{valor} px</span>
      </p>
      <input
        type="range" min={LETRA_MINIMA} max={LETRA_MAXIMA} step="1"
        value={valor}
        onChange={(e) => cambiar(Number(e.target.value))}
        onPointerUp={enElMovil() ? undefined : alVolcar}
        onKeyUp={enElMovil() ? undefined : alVolcar}
        aria-label={t('reader.size')}
        className="w-full max-w-xs accent-accent"
      />
      <p className="mt-3 text-text-secondary" style={{ fontSize: `${valor}px` }}>
        {t('settings.size_preview')}
      </p>
    </div>
  );
}

export default function SeccionLectura({ ajustes, alGuardar, alGuardarDiferido, alVolcar }) {
  const { t, lang } = useI18n();
  const voces = useVoces(lang);
  const ajustesVoz = {
    vozNarracion: ajustes.vozNarracion || '',
    vozDialogo: ajustes.vozDialogo || '',
    vozMujer: ajustes.vozMujer || '',
    vozHombre: ajustes.vozHombre || '',
    vocesPorPersonaje: ajustes.vocesPorPersonaje || {},
    velocidadVoz: ajustes.velocidadVoz || 1
  };
  return (
    <Seccion icono={BookOpen} titulo={t('settings.reading')} descripcion={t('settings.reading_desc')}>
      <div className="space-y-5">
        <div>
          <p className="text-caption uppercase tracking-wider text-text-secondary mb-2">{t('reader.theme')}</p>
          <Opciones
            valor={ajustes.theme}
            onChange={(v) => alGuardar({ theme: v })}
            opciones={[
              { id: 'dark', etiqueta: t('reader.theme_dark'), icono: Moon },
              { id: 'sepia', etiqueta: t('reader.theme_sepia'), icono: BookOpen },
              { id: 'light', etiqueta: t('reader.theme_light'), icono: Sun }
            ]}
          />
        </div>
        <Divider />
        <div>
          <p className="text-caption uppercase tracking-wider text-text-secondary mb-2">{t('reader.font')}</p>
          <Opciones
            valor={ajustes.font}
            onChange={(v) => alGuardar({ font: v })}
            opciones={[
              { id: 'serif', etiqueta: t('reader.font_serif'), icono: Type },
              { id: 'sans', etiqueta: t('reader.font_sans'), icono: Type }
            ]}
          />
        </div>
        <Divider />
        <TamanoDeLetra ajustes={ajustes} alGuardarDiferido={alGuardarDiferido} alVolcar={alVolcar} />
        <Divider />
        <AjustesDeVoz voces={voces} ajustes={ajustesVoz} alCambiar={alGuardar} />
        <Divider />
        <RitmoDeLectura />
        <Divider />
        <MiLectura />
      </div>
    </Seccion>
  );
}
