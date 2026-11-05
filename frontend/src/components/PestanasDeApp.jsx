import Settings from './Settings';
import Descubrimientos from './Descubrimientos';
import Autores from './Autores';
import MiLista from './MiLista';
import Explorar from './Explorar';
import Inicio, { InicioVacio } from './inicio/Inicio';
import Rejilla from './biblioteca/Rejilla';
import VistaAsistente from './asistente/VistaAsistente';
import PantallaMas from './movil/PantallaMas';
import { useAlPedirAlAsistente } from '../preguntaAlAsistente';

export default function PestanasDeApp({ app }) {
  const { nav, ficha, bib, acciones, importador } = app;
  const verFicha = ficha.setObra;

  useAlPedirAlAsistente(() => { if (nav.vista !== 'asistente') nav.irA('asistente'); });

  if (nav.vista === 'mas') {
    return <PantallaMas alIrA={nav.irA} alImportar={importador.abrir} />;
  }

  if (nav.vista === 'explorar') {
    return (
      <Explorar
        library={bib.library}
        onDetalle={verFicha}
        consulta={nav.consulta}
        alBuscar={nav.setConsulta}
        resultados={app.filtradas}
      />
    );
  }

  if (nav.vista === 'milista') {
    return <MiLista library={bib.library} onDetalle={verFicha} onQuitar={acciones.alternarMiLista} />;
  }

  if (nav.vista === 'autores') {
    return (
      <Autores
        autores={bib.autoresSeguidos}
        library={bib.library}
        onDejarDeSeguir={acciones.dejarDeSeguirAutor}
        onDetalle={verFicha}
      />
    );
  }

  if (nav.vista === 'descubrimientos') {
    return (
      <Descubrimientos
        items={bib.discoveries}
        onAbrir={acciones.abrirDescubrimiento}
        onDetalle={verFicha}
        onGuardar={acciones.guardarDescubrimiento}
        onDescartar={acciones.descartarDescubrimiento}
        alCambiar={bib.fetchDiscoveries}
      />
    );
  }

  if (nav.vista === 'asistente') {

    return (
      <main className="max-md:fixed max-md:inset-x-0 max-md:top-[calc(env(safe-area-inset-top)+3.5rem)] max-md:bottom-[calc(49px+env(safe-area-inset-bottom))] md:pt-24 md:h-screen">
        <VistaAsistente />
      </main>
    );
  }

  if (nav.vista === 'ajustes') {

    return <Settings onClose={() => { nav.irA('inicio'); bib.fetchLibrary(); }} />;
  }

  if (nav.vista === 'biblioteca') {
    return (
      <Rejilla
        obras={app.filtradas}
        consulta={nav.consulta}
        alBuscar={nav.setConsulta}
        alAbrir={verFicha}
      />
    );
  }

  if (!bib.cargada && !bib.library.length) return <div className="min-h-dvh" aria-busy="true" />;

  if (!bib.library.length || !bib.hero) {
    return <InicioVacio alImportar={importador.abrir} />;
  }

  return (
    <Inicio
      hero={bib.hero}
      fondoHero={app.fondoHero}
      sinopsisHero={app.sinopsisHero}
      filas={app.filasDeInicio}
      biblioteca={bib.library}
      descubrimientos={bib.discoveries}

      acciones={{
        onSelect: app.leer,
        onDetail: verFicha,
        onDownload: acciones.handleDownload
      }}
      alAbrirDescubrimiento={acciones.abrirDescubrimiento}
      alVerFicha={verFicha}
      alLeerHero={app.leer}
      alAlternarMiLista={acciones.alternarMiLista}
    />
  );
}
