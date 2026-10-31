import { useState, useEffect } from 'react';
import { letraDelAparato, guardarLetra } from '../letraDelAparato';
import { enElMovil } from '../vistaGuardada';

const CLASES_DE_TEMA = {
  dark: 'bg-[#121212] text-gray-300',
  sepia: 'bg-[#f4ecd8] text-[#5b4636]',
  light: 'bg-white text-gray-900',
};

const CLASES_DE_FUENTE = {
  serif: 'font-serif',
  sans: 'font-sans',
};

export default function useAjustesLector({ alLeerTraducido }) {
  const [tema, setTema] = useState('dark');
  const [fuente, setFuente] = useState('serif');
  const [cuerpo, setCuerpo] = useState(() => letraDelAparato(null));
  const [listos, setListos] = useState(() => !window.api);

  useEffect(() => {
    if (!window.api) return;

    window.api.getSettings()
      .then(ajustes => {
        if (!ajustes) return;
        setTema(ajustes.theme || 'dark');
        setFuente(ajustes.font || 'serif');
        setCuerpo(letraDelAparato(ajustes));
        if (ajustes.readTranslated) alLeerTraducido(true);
      })
      .catch(() => {  })
      .finally(() => setListos(true));

  }, []);

  useEffect(() => window.api?.alCambiarAjustes?.((cambio) => {
    if (cambio?.theme) setTema(cambio.theme);
    if (cambio?.font) setFuente(cambio.font);

    if (cambio?.fontSize) setCuerpo(enElMovil() ? guardarLetra(cambio.fontSize) : cambio.fontSize);
    if (typeof cambio?.readTranslated === 'boolean') alLeerTraducido(cambio.readTranslated);

  }), []);

  const guardar = (cambio) => { if (window.api) window.api.updateSettings(cambio); };

  const cambiarTema = (nuevo) => { setTema(nuevo); guardar({ theme: nuevo }); };
  const cambiarFuente = (nueva) => { setFuente(nueva); guardar({ font: nueva }); };
  const cambiarCuerpo = (delta) => {
    setCuerpo(guardarLetra(cuerpo + delta));
  };

  return {
    tema, fuente, cuerpo, listos,
    cambiarTema, cambiarFuente, cambiarCuerpo,
    clases: `${CLASES_DE_TEMA[tema]} ${CLASES_DE_FUENTE[fuente]}`
  };
}
