import { AnimatePresence } from 'framer-motion';
import Reader from './Reader';
import ImportModal from './ImportModal';
import FichaObra from './ficha/FichaObra';
import origenDeGenero from './ficha/origen';

function propsDeFicha(app) {
  const { ficha, bib, acciones, descarga, sinopsisDetalle, importador, leer } = app;

  return {
    obra: ficha.obra,
    alElegirCapitulos: (obra) => { ficha.setObra(obra); bib.fetchLibrary(); },
    sinopsis: sinopsisDetalle,
    generos: ficha.generos,
    propuestos: ficha.propuestos,
    glosario: ficha.glosario,
    glosarioTocado: ficha.glosarioTocado,
    descarga,
    autoresSeguidos: bib.autoresSeguidos,
    otrosSitios: ficha.otrosSitios,
    exportando: acciones.exportando === ficha.obra?.id,
    avisoEpub: acciones.avisoEpub,
    avisoAutor: acciones.avisoAutor,
    confirmandoBorrado: ficha.confirmandoBorrado === ficha.obra?.id,
    origenDeGenero,
    alCerrar: () => { ficha.setObra(null); ficha.setConfirmandoBorrado(null); },

    alLeer: (obra) => { (obra.origen === 'descubierta' ? acciones.abrirDescubrimiento : leer)(obra); ficha.setObra(null); },
    alDescargar: acciones.handleDownload,
    alRefrescar: acciones.handleRefresh,
    alExportar: acciones.exportarEpub,
    alBorrar: acciones.handleDelete,
    alPedirBorrado: ficha.setConfirmandoBorrado,
    alCancelarBorrado: () => ficha.setConfirmandoBorrado(null),
    alAlternarMiLista: acciones.alternarMiLista,
    alGuardar: async (obra) => { if (await acciones.guardarDescubrimiento(obra)) ficha.setObra(null); },
    alSeguirAutor: acciones.alternarSeguirAutor,
    alCambiarPortada: acciones.handlePortada,
    alDescartar: acciones.descartarDescubrimiento,
    alDecidirGenero: acciones.decidirGenero,
    alQuitarDelGlosario: ficha.quitarDelGlosario,
    alAnadirAlGlosario: ficha.anadirAlGlosario,
    alRehacerTraducciones: ficha.rehacerTraducciones,
    alBuscarEnOtrosSitios: ficha.buscarEnOtrosSitios,
    alImportarDeOtroSitio: importador.abrirCon,
    alMostrarFichero: (ruta) => window.api?.mostrarFichero?.(ruta)
  };
}

export default function CapasDeApp({ app }) {
  const { lector, importador, ficha, bib, acciones, nav } = app;

  return (
    <>
      <AnimatePresence>

        {lector.abierto && lector.obra && (
          <Reader
            key={lector.obra.id}
            story={lector.obra}
            onClose={() => { lector.cerrar(); bib.fetchLibrary(); }}
            onLeerOtra={acciones.abrirDescubrimiento}

            onAbrirAjustes={() => { lector.cerrar(); nav.irA('ajustes'); }}
          />
        )}
      </AnimatePresence>

      <ImportModal
        isOpen={importador.abierto}
        onClose={importador.cerrar}
        urlInicial={importador.url}
        onImportSuccess={bib.fetchLibrary}
      />

      <AnimatePresence>
        {ficha.obra && <FichaObra {...propsDeFicha(app)} />}
      </AnimatePresence>
    </>
  );
}
