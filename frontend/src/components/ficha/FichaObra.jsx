import { useI18n } from '../../i18n/I18nContext';
import useEsMovil from '../../hooks/useEsMovil';
import { DialogSheet, Card } from '../ui/Layout';
import { SecondaryButton } from '../ui/Buttons';
import { Notice } from '../ui/Feedback';
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

function BloqueSinopsis({ obra, sinopsis, t }) {
  return (
    <Card className="bg-surface-secondary/45">
      <h3 className="text-caption font-semibold text-text-secondary uppercase tracking-wider mb-2">
        {t('detail.synopsis')}
      </h3>
      <p className="text-body text-text-primary leading-relaxed whitespace-pre-line">
        {sinopsis.texto || t('detail.no_synopsis')}
      </p>
      {sinopsis.fallo && (
        <p className="text-footnote text-warning mt-2 flex items-center gap-2 flex-wrap">
          {t(sinopsis.fallo === 'ritmo' ? 'synopsis.rate_limited' : 'synopsis.failed')}
          <button
            type="button"
            onClick={sinopsis.reintentar}
            className="underline underline-offset-2 hover:text-text-primary transition-colors"
          >
            {t('synopsis.retry')}
          </button>
        </p>
      )}
      {obra.porque?.length > 0 && (
        <p className="text-footnote text-text-secondary mt-3">
          {t('suggest.because', { tags: obra.porque.join(', ') })}
        </p>
      )}
    </Card>
  );
}

function PieDeFicha({ obra, otrosSitios, avisoAutor, avisoEpub, alBuscarEnOtrosSitios, alImportarDeOtroSitio, alMostrarFichero, t }) {
  return (
    <>
      {avisoAutor && <Notice variant="info" compact className="mt-4">{avisoAutor}</Notice>}
      <OtrosSitios
        dePago={obra.capitulosDePago || 0}
        libres={obra.capitulosLibres || 0}
        total={obra.totalChapters || 0}
        resultados={otrosSitios}
        alBuscar={() => alBuscarEnOtrosSitios(obra)}
        alImportar={alImportarDeOtroSitio}
      />
      {avisoEpub && (
        <Notice
          variant={avisoEpub.error ? 'error' : 'success'}
          compact
          className="mt-4"
          action={
            avisoEpub.ruta && (
              <SecondaryButton onClick={() => alMostrarFichero(avisoEpub.ruta)}>
                {t('detail.epub_show')}
              </SecondaryButton>
            )
          }
        >
          {avisoEpub.texto}
        </Notice>
      )}
    </>
  );
}

export default function FichaObra(props) {
  const {
    obra, sinopsis, generos, propuestos, glosario, glosarioTocado, descarga, otrosSitios,
    avisoEpub, avisoAutor, alCerrar, alLeer, alDescargar, alDecidirGenero,
    alQuitarDelGlosario, alAnadirAlGlosario, alRehacerTraducciones,
    alBuscarEnOtrosSitios, alImportarDeOtroSitio, alMostrarFichero,
    alElegirCapitulos, origenDeGenero
  } = props;
  const { t } = useI18n();
  const movil = useEsMovil();
  if (!obra) return null;

  const esBiblioteca = obra.origen !== 'descubierta' && obra.origen !== 'descartada';
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
      {!movil && <div className="mb-6 space-y-3">{principales}{gestion}</div>}
      <div className="mb-6">
        <BloqueSinopsis obra={obra} sinopsis={sinopsis} t={t} />
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
        {esBiblioteca && <EstadoDeLectura key={`estado-${obra.id}`} obra={obra} />}
        {esBiblioteca && <OrganizarLaObra obraId={obra.id} />}
        {(obra.downloadedChapters || 0) > 1 && (
          <RevisarCapitulos obraId={obra.id} total={(obra.chapterList || []).length || obra.totalChapters || 0} />
        )}
        {esBiblioteca && <CopiasDeLaObra key={`copias-${obra.id}`} obraId={obra.id} />}
      </div>
      <PieDeFicha
        obra={obra}
        otrosSitios={otrosSitios}
        avisoAutor={avisoAutor}
        avisoEpub={avisoEpub}
        alBuscarEnOtrosSitios={alBuscarEnOtrosSitios}
        alImportarDeOtroSitio={alImportarDeOtroSitio}
        alMostrarFichero={alMostrarFichero}
        t={t}
      />
      {movil && <div className="mt-8"><Borrar {...props} movil /></div>}
    </>
  );

  if (movil) {
    return (
      <HojaMovil alCerrar={alCerrar} cabecera={<CabeceraFicha obra={obra} movil alCerrar={alCerrar} />}>
        {cuerpo}
      </HojaMovil>
    );
  }

  return (
    <DialogSheet
      onClose={alCerrar}
      closeLabel={t('common.close')}
      maxWidth="max-w-3xl"
      header={<CabeceraFicha obra={obra} alCerrar={alCerrar} />}
      bodyClassName="p-6 md:p-8"
    >
      {cuerpo}
    </DialogSheet>
  );
}
