import { motion } from 'framer-motion';

import { useI18n } from '../../i18n/I18nContext';
import useEsMovil from '../../hooks/useEsMovil';
import CabeceraFicha from './CabeceraFicha';
import DatosDeLaObra, { Barras } from './DatosDeLaObra';
import AccionesPrincipales from './AccionesPrincipales';
import AccionesDeGestion, { Borrar } from './AccionesDeGestion';
import HojaMovil from './HojaMovil';
import GenerosDeLaObra from './GenerosDeLaObra';
import GlosarioDeLaObra from './GlosarioDeLaObra';
import OrganizarLaObra from './OrganizarLaObra';
import RevisarCapitulos from './RevisarCapitulos';
import CopiasDeLaObra from './CopiasDeLaObra';
import EstadoDeLectura from './EstadoDeLectura';
import OtrosSitios from './OtrosSitios';
import SeleccionCapitulos from './SeleccionCapitulos';
import GuardarSinConexion from './GuardarSinConexion';

export default function FichaObra(props) {

  const {
    obra, sinopsis, generos, propuestos, glosario, glosarioTocado, descarga, otrosSitios,
    avisoEpub, avisoAutor,
    alCerrar, alLeer, alDescargar, alDecidirGenero, alQuitarDelGlosario, alAnadirAlGlosario,
    alRehacerTraducciones, alBuscarEnOtrosSitios, alImportarDeOtroSitio,
    alMostrarFichero, alElegirCapitulos,

    origenDeGenero
  } = props;
  const { t } = useI18n();
  const movil = useEsMovil();
  if (!obra) return null;

  const principales = <AccionesPrincipales obra={obra} descarga={descarga} movil={movil} alLeer={alLeer} alDescargar={alDescargar} />;
  const gestion = <AccionesDeGestion {...props} movil={movil} />;
  const cuerpo = (
    <>
      {obra.needsChapterSelection && <SeleccionCapitulos key={obra.id} obra={obra} alGuardar={alElegirCapitulos} />}
      <DatosDeLaObra obra={obra} descarga={descarga} movil={movil} sinBarras={movil} />
      {movil && principales}
      {movil && <GuardarSinConexion obra={obra} />}
      {movil && <Barras obra={obra} descarga={descarga} />}
      {movil && gestion}

              <div className="mb-8">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">{t('detail.synopsis')}</h3>
                <p className="text-gray-300 leading-relaxed whitespace-pre-line">{sinopsis.texto || t('detail.no_synopsis')}</p>

                {sinopsis.fallo && (
                  <p className="text-xs text-amber-400/80 mt-2 flex items-center gap-2 flex-wrap">
                    {t(sinopsis.fallo === 'ritmo' ? 'synopsis.rate_limited' : 'synopsis.failed')}
                    <button
                      onClick={sinopsis.reintentar}
                      className="underline underline-offset-2 hover:text-amber-300 transition-colors"
                    >
                      {t('synopsis.retry')}
                    </button>
                  </p>
                )}

                {obra.porque?.length > 0 && (
                  <p className="text-sm text-gray-500 mt-3">
                    {t('suggest.because', { tags: obra.porque.join(', ') })}
                  </p>
                )}

                <GenerosDeLaObra
                  generos={generos}
                  propuestos={propuestos}
                  origenDeGenero={origenDeGenero}
                  alDecidir={(nombre, aceptar) => alDecidirGenero(obra, nombre, aceptar)}
                />
                <GlosarioDeLaObra
                  glosario={glosario}
                  tocado={glosarioTocado}
                  alQuitar={alQuitarDelGlosario}
                  alAnadir={alAnadirAlGlosario}
                  alRehacerTraducciones={() => alRehacerTraducciones(obra.id)}
                />

                {obra.origen !== 'descubierta' && obra.origen !== 'descartada' && <EstadoDeLectura key={`estado-${obra.id}`} obra={obra} />}
                {obra.origen !== 'descubierta' && obra.origen !== 'descartada' && <OrganizarLaObra obraId={obra.id} />}
                {(obra.downloadedChapters || 0) > 1 && <RevisarCapitulos obraId={obra.id} total={(obra.chapterList || []).length || obra.totalChapters || 0} />}
                {obra.origen !== 'descubierta' && obra.origen !== 'descartada' && <CopiasDeLaObra key={`copias-${obra.id}`} obraId={obra.id} />}
              </div>

      {!movil && <div className="space-y-3">{principales}{gestion}</div>}

              {avisoAutor && (
                <p className="text-xs text-amber-400/90 mt-4">{avisoAutor}</p>
              )}

              <OtrosSitios
                dePago={obra.capitulosDePago || 0}
                libres={obra.capitulosLibres || 0}
                total={obra.totalChapters || 0}
                resultados={otrosSitios}
                alBuscar={() => alBuscarEnOtrosSitios(obra)}
                alImportar={alImportarDeOtroSitio}
              />
              {avisoEpub && (
                <p className={`text-xs mt-4 flex items-center gap-3 flex-wrap ${avisoEpub.error ? 'text-red-400' : 'text-gray-400'}`}>
                  <span>{avisoEpub.texto}</span>
                  {avisoEpub.ruta && (
                    <button
                      onClick={() => alMostrarFichero(avisoEpub.ruta)}
                      className="underline underline-offset-2 hover:text-white transition-colors"
                    >
                      {t('detail.epub_show')}
                    </button>
                  )}
                </p>
              )}
      {movil && <div className="mt-10"><Borrar {...props} movil /></div>}
    </>
  );

  if (movil) {
    return <HojaMovil alCerrar={alCerrar} cabecera={<CabeceraFicha obra={obra} movil alCerrar={alCerrar} />}>{cuerpo}</HojaMovil>;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8"
      onClick={alCerrar}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-[#1e1e1e] rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <CabeceraFicha obra={obra} alCerrar={alCerrar} />
        <div className="p-8">{cuerpo}</div>
      </motion.div>
    </motion.div>
  );
}
