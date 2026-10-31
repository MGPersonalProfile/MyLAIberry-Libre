import { useState, useMemo, useEffect } from 'react';
import { repartirEnFilas } from '../components/inicio/filas';
import { ES_PESTANA } from '../components/pestanas';
import { useSinopsis } from './useSinopsis';
import { useBiblioteca } from './useBiblioteca';
import { useAcciones } from './useAcciones';
import useNavegacion from './useNavegacion';
import useFicha from './useFicha';
import useFondoHero from './useFondoHero';
import useEstadoDescarga from './useEstadoDescarga';
import { useI18n } from '../i18n/I18nContext';

function filtrar(library, consulta) {
  const busca = consulta.trim().toLowerCase();
  if (!busca) return library;
  return library.filter(item =>
    (item.title || '').toLowerCase().includes(busca) ||
    (item.author || '').toLowerCase().includes(busca)
  );
}

function enganchesDeBiblioteca({ ficha, nav, abrirImportadorCon, leer }) {
  return {

    alLlegarEnlace: abrirImportadorCon,

    alPedirObra: (obra, { leer: paraLeer = false } = {}) => (paraLeer ? leer(obra) : ficha.setObra(obra)),

    alRecuperarVista: (guardada) => { if (ES_PESTANA.has(guardada) || guardada === 'mas') nav.setVista(guardada); }
  };
}

const vistasEnLaBiblioteca = new WeakSet();

export default function useEstadoDeApp() {
  const { t, lang, setLang } = useI18n();
  const [leyendo, setLeyendo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [obraDelLector, setObraDelLector] = useState(null);

  const [urlEntrante, setUrlEntrante] = useState(null);

  const nav = useNavegacion();
  const ficha = useFicha();

  const abrirImportadorCon = (url) => { setUrlEntrante(url); setImportando(true); };

  const abrirEnLector = (obra) => { setObraDelLector(obra); setLeyendo(true); };
  const bib = useBiblioteca(enganchesDeBiblioteca({ ficha, nav, abrirImportadorCon, leer: abrirEnLector }));
  const fondoHero = useFondoHero(bib.hero?.id);

  const obraFicha = useMemo(() => {
    const o = ficha.obra;
    if (!o || o.origen === 'descartada' || !bib.cargada) return o;
    const mismo = x => String(x.id) === String(o.id);
    const fresca = bib.library.find(mismo) || (o.origen === 'descubierta' && (bib.discoveries || []).find(mismo));
    if (fresca) { vistasEnLaBiblioteca.add(o); return o; }

    return vistasEnLaBiblioteca.has(o) ? null : o;
  }, [ficha.obra, bib.library, bib.discoveries, bib.cargada]);

  const { setObra: soltarFicha } = ficha;
  useEffect(() => { if (ficha.obra && obraFicha === null) soltarFicha(null); }, [ficha.obra, obraFicha, soltarFicha]);
  const descarga = useEstadoDescarga(obraFicha, bib.downloads);

  const acciones = useAcciones({
    refrescar: {
      fetchLibrary: bib.fetchLibrary,
      fetchDiscoveries: bib.fetchDiscoveries,
      fetchAutores: bib.fetchAutores
    },
    interfaz: {
      autoresSeguidos: bib.autoresSeguidos,
      setLibrary: bib.setLibrary,
      setDownloads: bib.setDownloads,
      setShowDetail: ficha.setObra,
      setSelectedStory: setObraDelLector,
      setIsReading: setLeyendo,
      setConfirmDelete: ficha.setConfirmandoBorrado
    },
    t
  });

  const leer = (obra) => { setObraDelLector(obra); setLeyendo(true); };

  const sinopsisDetalle = useSinopsis(obraFicha, lang);
  const sinopsisHero = useSinopsis(bib.hero, lang);

  const filasDeInicio = useMemo(() => repartirEnFilas(bib.library), [bib.library]);

  return {
    idioma: { lang, setLang },
    nav, ficha: { ...ficha, obra: obraFicha }, bib, acciones, descarga,
    fondoHero, sinopsisHero, sinopsisDetalle, filasDeInicio,
    filtradas: filtrar(bib.library, nav.consulta),
    lector: { abierto: leyendo, obra: obraDelLector, cerrar: () => setLeyendo(false) },
    importador: {
      abierto: importando,
      url: urlEntrante,
      abrir: () => setImportando(true),
      abrirCon: abrirImportadorCon,
      cerrar: () => { setImportando(false); setUrlEntrante(null); }
    },
    leer
  };
}
