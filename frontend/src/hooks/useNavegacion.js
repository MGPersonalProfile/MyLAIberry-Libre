import { useState, useEffect } from 'react';
import { guardarVista } from '../vistaGuardada';

export default function useNavegacion() {
  const [vista, setVista] = useState('inicio');
  const [consulta, setConsulta] = useState('');
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const alHacerScroll = () => setScrolled(window.scrollY > 40);
    alHacerScroll();
    window.addEventListener('scroll', alHacerScroll, { passive: true });
    return () => window.removeEventListener('scroll', alHacerScroll);
  }, []);

  const irA = (id) => {
    setVista(id);
    setConsulta('');
    setBuscadorAbierto(false);
    guardarVista(id);
    window.scrollTo({ top: 0 });
  };

  const alternarBuscador = () => {
    const abriendo = !buscadorAbierto;
    setBuscadorAbierto(abriendo);
    if (!abriendo) setConsulta('');
    else if (vista === 'inicio') setVista('biblioteca');
  };

  return {
    vista, setVista, consulta, setConsulta, buscadorAbierto, scrolled,
    irA, alternarBuscador
  };
}
