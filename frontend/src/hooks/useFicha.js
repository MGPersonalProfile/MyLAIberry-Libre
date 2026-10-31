import { useState, useEffect } from 'react';
import { avisar, motivo, exigir } from '../avisos';

export default function useFicha() {
  const [obra, setObra] = useState(null);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(null);

  const [otrosSitios, setOtrosSitios] = useState(null);
  const [glosario, setGlosario] = useState([]);

  const [glosarioTocado, setGlosarioTocado] = useState(false);

  useEffect(() => {
    const id = obra?.id;
    let vivo = true;

    const pedir = id && window.api?.getGlossary
      ? window.api.getGlossary(id).catch(() => [])
      : Promise.resolve([]);

    pedir.then(g => {
      if (!vivo) return;
      setGlosario(g || []);
      setGlosarioTocado(false);
    });

    return () => { vivo = false; };
  }, [obra?.id]);

  useEffect(() => {
    const id = obra?.id;
    if (!id || !window.api?.getGlossary) return undefined;
    const alFundir = (e) => {
      if (String(e.detail?.id) !== String(id)) return;
      window.api.getGlossary(id).then(g => setGlosario(g || [])).catch(() => {});

      window.api.getLibrary?.().then(lista => {
        const fresca = (lista || []).find(o => String(o.id) === String(id));
        if (fresca) setObra(fresca);
      }).catch(() => {});
    };
    window.addEventListener('mylaiberry-obra-fundida', alFundir);
    return () => window.removeEventListener('mylaiberry-obra-fundida', alFundir);
  }, [obra?.id]);

  const buscarEnOtrosSitios = async (fanfic) => {
    setOtrosSitios('buscando');
    try {
      const r = await window.api?.buscarEnOtrosSitios?.(fanfic.id);
      setOtrosSitios(exigir(r)?.resultados || []);
    } catch (err) {

      setOtrosSitios([]);
      avisar(motivo(err), 'error');
    }
  };

  const quitarDelGlosario = async (termino) => {
    const nuevo = glosario.filter(g => g.termino !== termino);
    setGlosario(nuevo);
    setGlosarioTocado(true);
    exigir(await window.api?.setGlossary?.(obra.id, nuevo));
  };

  const anadirAlGlosario = async (termino, valor) => {
    const entrada = valor ? { termino, accion: 'fijar', valor, origen: 'mano' } : { termino, accion: 'no-traducir', origen: 'mano' };
    const nuevo = [...glosario.filter(g => g.termino.toLowerCase() !== termino.toLowerCase()), entrada];
    exigir(await window.api?.setGlossary?.(obra.id, nuevo));
    setGlosario(nuevo);
    setGlosarioTocado(true);
  };

  const rehacerTraducciones = async (id) => {
    exigir(await window.api?.redoTranslations?.(id));
    setGlosarioTocado(false);
  };

  return {
    obra, setObra, confirmandoBorrado, setConfirmandoBorrado,
    otrosSitios, buscarEnOtrosSitios,
    glosario, glosarioTocado, quitarDelGlosario, anadirAlGlosario, rehacerTraducciones,

    generos: (obra?.tags || []).filter(x => x.category === 'genre'),
    propuestos: obra?.generosPropuestos || []
  };
}
