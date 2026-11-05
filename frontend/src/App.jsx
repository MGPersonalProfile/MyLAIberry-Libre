import BarraSuperior from './components/BarraSuperior';
import AvisoDeConflicto from './components/AvisoDeConflicto';
import AvisoDeVersion from './components/AvisoDeVersion';
import CapasDeApp from './components/CapasDeApp';
import PestanasDeApp from './components/PestanasDeApp';
import useEstadoDeApp from './hooks/useEstadoDeApp';
import useEsMovil from './hooks/useEsMovil';
import CabeceraMovil from './components/movil/CabeceraMovil';
import BarraDePestanas from './components/movil/BarraDePestanas';
import AvisoSinConexion from './components/movil/AvisoSinConexion';
import AvisoBreve from './components/AvisoBreve';
import useAvisoAsistente from './hooks/useAvisoAsistente';

function App() {
  const app = useEstadoDeApp();
  const { nav, bib, lector, importador, idioma } = app;

  const esMovil = useEsMovil(); const tapado = lector.abierto || importador.abierto;
  const avisoAsistente = useAvisoAsistente();

  const sinRellenoAbajo = esMovil || nav.vista === 'asistente';

  return (
    <div
      className={`min-h-screen bg-background text-text-primary font-sans selection:bg-accent selection:text-white overflow-x-hidden ${sinRellenoAbajo ? '' : 'pb-20'}`}
      style={esMovil ? { paddingBottom: 'calc(49px + env(safe-area-inset-bottom) + 24px)' } : undefined}
    >
      <AvisoDeConflicto equipo={bib.conflictoSync} alCerrar={() => bib.setConflictoSync(null)} />
      <AvisoDeVersion />
      {esMovil && <AvisoSinConexion />}
      <AvisoBreve />

      <CapasDeApp app={app} />

      <div className={`transition-opacity duration-150 ${tapado ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {esMovil ? (
          <CabeceraMovil
            scrolled={nav.scrolled}
            vista={nav.vista}
            alIrA={nav.irA}
            alImportar={importador.abrir}
          />
        ) : (<>

        <div className="h-8 w-full drag-region fixed top-0 z-[100]" style={{ WebkitAppRegion: 'drag' }} />

        <BarraSuperior
          vista={nav.vista}
          alIrA={nav.irA}
          scrolled={nav.scrolled}
          consulta={nav.consulta}
          alBuscar={nav.setConsulta}
          buscadorAbierto={nav.buscadorAbierto}
          alAlternarBuscador={nav.alternarBuscador}
          alImportar={importador.abrir}
          lang={idioma.lang}
          alCambiarIdioma={idioma.setLang}
          avisoAsistente={avisoAsistente}
        />
        </>)}

        <PestanasDeApp app={app} />
        {esMovil && !tapado && <BarraDePestanas vista={nav.vista} alIrA={nav.irA} avisoAsistente={avisoAsistente} />}
      </div>
    </div>
  );
}

export default App;
