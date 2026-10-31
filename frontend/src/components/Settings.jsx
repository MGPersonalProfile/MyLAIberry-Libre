import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Globe, Languages, Download, BellRing } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { Seccion, Interruptor, Opciones } from './ajustes/piezas';
import SeccionBiblioteca from './ajustes/SeccionBiblioteca';
import SeccionLectura from './ajustes/SeccionLectura';
import SeccionIA from './ajustes/SeccionIA';
import SeccionAsistente from './ajustes/SeccionAsistente';
import SeccionVersion from './ajustes/SeccionVersion';
import SeccionSesiones from './ajustes/SeccionSesiones';
import SeccionLan from './ajustes/SeccionLan';
import SeccionVigiladas from './ajustes/SeccionVigiladas';
import { enElMovil } from '../vistaGuardada';
import SeccionAlmacenamiento from './ajustes/SeccionAlmacenamiento';
import SeccionMarcador from './ajustes/SeccionMarcador';

export default function Settings({ onClose }) {
  const { t, lang, setLang } = useI18n();
  const movil = enElMovil();

  const [stats, setStats] = useState(null);
  const [almacen, setAlmacen] = useState(null);
  const [moviendo, setMoviendo] = useState(false);
  const [aviso, setAviso] = useState(null);

  const [suscripciones, setSuscripciones] = useState([]);
  const [nuevaBusqueda, setNuevaBusqueda] = useState('');

  const [urlMarcadores, setUrlMarcadores] = useState('');
  const [importando, setImportando] = useState(false);
  const [avisoMarcadores, setAvisoMarcadores] = useState(null);

  const importarMarcadores = async () => {
    const url = urlMarcadores.trim();
    if (!url) return;
    setImportando(true);
    setAvisoMarcadores(null);
    try {
      const r = await window.api?.importBookmarks?.(url);
      if (r?.status === 'ok') {
        setUrlMarcadores('');
        setAvisoMarcadores({ texto: t('settings.import_queued') });
      } else {
        setAvisoMarcadores({ texto: r?.message || t('settings.import_failed'), error: true });
      }
    } catch (err) {
      setAvisoMarcadores({ texto: err?.message || t('settings.import_failed'), error: true });
    } finally {
      setImportando(false);
    }
  };

  const cargarSuscripciones = () => {
    window.api?.getSubscriptions?.().then(s => setSuscripciones(s || [])).catch(() => {});
  };

  const anadirSuscripcion = async (umbral) => {
    const texto = nuevaBusqueda.trim();
    if (!texto) return;
    const r = await window.api?.addSubscription?.(texto, umbral);
    if (r?.status === 'ok') { setNuevaBusqueda(''); cargarSuscripciones(); }
  };

  const quitarSuscripcion = async (id) => {
    await window.api?.removeSubscription?.(id);
    cargarSuscripciones();
  };
  const [ajustes, setAjustes] = useState({
    theme: 'dark', font: 'serif', fontSize: 18,
    autoTranslate: true, readTranslated: false,
    vozNarracion: '', vozDialogo: '', vozMujer: '', vozHombre: '', vocesPorPersonaje: {}, velocidadVoz: 1
  });

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  const guardar = (parche) => {
    setAjustes(a => ({ ...a, ...parche }));
    window.api?.updateSettings?.(parche);
  };

  const pendiente = useRef(null);
  const temporizador = useRef(null);

  const volcarPendiente = () => {
    clearTimeout(temporizador.current);
    if (!pendiente.current) return;
    window.api?.updateSettings?.(pendiente.current);
    pendiente.current = null;
  };

  const guardarDiferido = (parche) => {
    setAjustes(a => ({ ...a, ...parche }));
    pendiente.current = { ...pendiente.current, ...parche };
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(volcarPendiente, 300);
  };

  const [sitios, setSitios] = useState([]);
  const [entrandoEn, setEntrandoEn] = useState(null);

  const entrarEn = async (id) => {
    setEntrandoEn(id);
    try {

      const pc = window.mylaiberryPC && await window.mylaiberryPC.entrarEnSitio(id);
      const r = pc ? (pc.dentro ? await window.api?.importarSesionSitio?.(id, pc.cookies) : null)
        : await window.api?.iniciarSesionSitio?.(id);
      if (r) setSitios(prev => prev.map(s => (s.id === id ? { ...s, ...r } : s)));
    } finally {
      setEntrandoEn(null);
    }
  };

  const salirDe = async (id) => {
    const r = await window.api?.cerrarSesionSitio?.(id);
    if (r) setSitios(prev => prev.map(s => (s.id === id ? { ...s, ...r } : s)));
  };

  const [puedeAvisar, setPuedeAvisar] = useState(true);

  const [viaAviso, setViaAviso] = useState(null);

  const [lan, setLan] = useState({ encendido: false, redes: [] });
  const [lanCambiando, setLanCambiando] = useState(false);
  const [lanError, setLanError] = useState(null);

  const accionLan = async (accion) => {
    setLanCambiando(true);
    setLanError(null);
    try {
      const r = await accion();
      if (r && r.ok === false) setLanError(r.message || r.error);
      const estado = await window.api?.lanEstado?.();
      if (estado) setLan(estado);
    } catch (err) {
      setLanError(err?.message);
    } finally {
      setLanCambiando(false);
    }
  };
  const alternarLan = () => accionLan(() => (lan.encendido
    ? window.api?.lanApagar?.()
    : window.api?.lanEncender?.()));
  const nuevoCodigoLan = () => accionLan(() => window.api?.lanNuevoCodigo?.());

  const [proveedores, setProveedores] = useState([]);
  const [claveNueva, setClaveNueva] = useState('');
  const [probando, setProbando] = useState(false);
  const [pruebaIA, setPruebaIA] = useState(null);

  const proveedorActual = proveedores.find(p => p.id === (ajustes.proveedorIA || 'gemini'));

  const releerAjustes = async () => {
    const s = await window.api?.getSettings?.();
    if (s) setAjustes(a => ({ ...a, ...s }));
  };

  const guardarClave = async () => {
    const clave = claveNueva.trim();
    if (!clave) return;
    setPruebaIA(null);
    await window.api?.updateSettings?.({ claveIA: clave });
    setClaveNueva('');
    await releerAjustes();
  };

  const borrarClave = async () => {
    setPruebaIA(null);
    await window.api?.updateSettings?.({ claveIA: '' });
    setClaveNueva('');
    await releerAjustes();
  };

  const probarIA = async () => {
    setProbando(true);
    setPruebaIA(null);
    try {
      volcarPendiente();
      if (claveNueva.trim()) await guardarClave();
      setPruebaIA(await window.api?.probarIA?.());
    } catch (err) {
      setPruebaIA({ ok: false, message: err?.message });
    } finally {
      setProbando(false);
    }
  };

  useEffect(() => {

    const alPulsarEscape = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', alPulsarEscape);

    if (window.api) {
      window.api.getStats?.().then(setStats);
      window.api.getDataLocation?.().then(setAlmacen);
      window.api.getSettings?.().then(s => s && setAjustes(a => ({ ...a, ...s })));
      window.api.listarProveedoresIA?.().then(p => setProveedores(p || [])).catch(() => {});
      window.api.lanEstado?.().then(e => { if (e) setLan(e); }).catch(() => {});
      window.api.avisosDisponibles?.().then(p => setPuedeAvisar(p !== false)).catch(() => {});
      window.api.avisosVia?.().then(setViaAviso).catch(() => {});

      window.api.listarSesiones?.()
        .then(s => { if (s) setSitios(s); })
        .then(() => window.api.comprobarSesiones?.())
        .then(s => { if (s) setSitios(s); })
        .catch(() => {});
      cargarSuscripciones();
    }

    return () => {
      window.removeEventListener('keydown', alPulsarEscape);
      volcarPendiente();
    };
  }, []);

  const cambiarCarpeta = async () => {
    setMoviendo(true);
    setAviso(null);
    try {
      const r = await window.api.chooseDataLocation();
      if (r?.status === 'ok' || r?.status === 'unchanged') {
        setAlmacen(await window.api.getDataLocation());
        window.api.getStats?.().then(setStats);

        if (r.origenConservado) setAviso({ tipo: 'movida', ruta: r.origenConservado });
      } else if (r?.status === 'error') {
        setAviso({ tipo: 'error', texto: r.message });
      }
    } catch (err) {

      setAviso({ tipo: 'error', texto: err?.message });
    } finally {
      setMoviendo(false);
    }
  };

  const pct = stats && stats.capitulosListados
    ? Math.min(100, Math.round((stats.capitulosEnDisco / stats.capitulosListados) * 100))
    : 0;

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-3xl mx-auto px-4 pt-[calc(env(safe-area-inset-top)+4.25rem)] pb-8 md:px-8 md:pt-32 md:pb-24"
    >
      <header className="mb-6 md:mb-10">
        <h2 className="text-[28px] md:text-3xl font-black text-white tracking-tight">{t('settings.title')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('settings.subtitle')}</p>
      </header>

        <SeccionBiblioteca stats={stats} pct={pct} onCambio={() => window.api.getStats?.().then(setStats)} />

        <Seccion icono={Globe} titulo={t('settings.language')} descripcion={t('settings.language_desc')}>
          <Opciones
            valor={lang}
            onChange={setLang}
            opciones={[
              { id: 'es', etiqueta: 'Español' },
              { id: 'en', etiqueta: 'English' }
            ]}
          />
        </Seccion>

        <Seccion icono={Languages} titulo={t('settings.translation')} descripcion={t('settings.translation_desc')}>
          <div className="space-y-5">
            <Interruptor
              activo={ajustes.autoTranslate !== false}
              onChange={(v) => guardar({ autoTranslate: v })}
              titulo={t('settings.auto_translate')}
              descripcion={t('settings.auto_translate_desc')}
            />
            <Interruptor
              activo={!!ajustes.readTranslated}
              onChange={(v) => guardar({ readTranslated: v })}
              titulo={t('settings.read_translated')}
              descripcion={t('settings.read_translated_desc')}
            />
          </div>
        </Seccion>

        <SeccionLectura
          ajustes={ajustes}
          alGuardar={guardar}
          alGuardarDiferido={guardarDiferido}
          alVolcar={volcarPendiente}
        />

        <Seccion icono={Download} titulo={t('settings.import_bookmarks')} descripcion={t('settings.import_bookmarks_desc')}>
          <form
            onSubmit={(e) => { e.preventDefault(); importarMarcadores(); }}
            className="flex gap-2 flex-wrap"
          >
            <input
              value={urlMarcadores}
              onChange={(e) => setUrlMarcadores(e.target.value)}
              placeholder="https://archiveofourown.org/users/…"
              className="flex-1 min-w-[18rem] bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30"
            />
            <button
              type="submit"
              disabled={!urlMarcadores.trim() || importando}
              className="px-4 py-2 rounded-lg bg-white text-black font-semibold text-sm hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {importando ? t('settings.import_running') : t('settings.import_start')}
            </button>
          </form>
          {avisoMarcadores && (
            <p className={`text-xs mt-3 ${avisoMarcadores.error ? 'text-red-400' : 'text-gray-500'}`}>
              {avisoMarcadores.texto}
            </p>
          )}
        </Seccion>

        <Seccion icono={BellRing} titulo={t('settings.alerts')} descripcion={t('settings.alerts_desc')}>
          <div className="space-y-5 max-w-2xl">
            <Interruptor
              activo={ajustes.avisarCapitulos !== false && puedeAvisar}
              onChange={(v) => guardar({ avisarCapitulos: v })}
              titulo={t('settings.alerts_chapters')}
              descripcion={t('settings.alerts_chapters_desc')}
            />
            {!puedeAvisar && (
              <p className="text-xs text-amber-400/80 pl-[3.75rem]">{t('settings.alerts_unsupported')}</p>
            )}
            {puedeAvisar && viaAviso === 'ntfy' && (
              <p className="text-xs text-gray-400 pl-[3.75rem] max-w-xl">{t('settings.alerts_via_ntfy')}</p>
            )}
            {puedeAvisar && movil && viaAviso === 'escritorio' && (
              <p className="text-xs text-gray-400 pl-[3.75rem] max-w-xl">{t('settings.alerts_on_pc')}</p>
            )}

            {movil ? (
              <p className="text-xs text-gray-500 pl-[3.75rem] max-w-xl">{t('settings.alerts_mobile_always')}</p>
            ) : (<>
            <Interruptor
              activo={!!ajustes.seguirEnSegundoPlano}
              onChange={(v) => guardar({ seguirEnSegundoPlano: v })}
              titulo={t('settings.alerts_background')}
              descripcion={t('settings.alerts_background_desc')}
            />
            <p className="text-xs text-gray-500 pl-[3.75rem] max-w-xl">{t('settings.alerts_no_autostart')}</p>
            </>)}
          </div>
        </Seccion>

        <SeccionMarcador />

        <SeccionLan
          lan={lan}
          cambiando={lanCambiando}
          error={lanError}
          alAlternar={alternarLan}
          alCambiarCodigo={nuevoCodigoLan}
          ajustes={ajustes}
          alGuardar={guardar}
          movil={movil}
        />
        <SeccionSesiones
          sitios={sitios}
          entrandoEn={entrandoEn}
          alEntrar={entrarEn}
          alSalir={salirDe}
          movil={movil && !window.mylaiberryPC}
        />
        <SeccionIA
          proveedores={proveedores}
          proveedorActual={proveedorActual}
          ajustes={ajustes}
          claveNueva={claveNueva}
          alEscribirClave={setClaveNueva}
          probando={probando}
          prueba={pruebaIA}
          alGuardarAjuste={guardar}
          alGuardarDiferido={guardarDiferido}
          alVolcar={volcarPendiente}
          alGuardarClave={guardarClave}
          alBorrarClave={borrarClave}
          alProbar={probarIA}
          alAbrirEnNavegador={(url) => window.api?.abrirEnNavegador?.(url)}
        />
        <SeccionAsistente />
        <SeccionVersion />
        <SeccionVigiladas
          suscripciones={suscripciones}
          nueva={nuevaBusqueda}
          alEscribir={setNuevaBusqueda}
          alAnadir={anadirSuscripcion}
          alQuitar={quitarSuscripcion}
        />
        <SeccionAlmacenamiento
          almacen={almacen}
          bytes={stats?.bytes}
          moviendo={moviendo}
          aviso={aviso}
          alCambiarCarpeta={cambiarCarpeta}
          alAbrirCarpeta={() => window.api.openDataLocation()}
          movil={movil}
        />
    </motion.main>
  );
}
