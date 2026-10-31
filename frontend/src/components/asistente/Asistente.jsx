import { useState, useRef, useEffect } from 'react';
import { Loader2, Square } from 'lucide-react';
import useAsistente from '../../hooks/useAsistente';
import TextoConFormato from './TextoConFormato';
import TarjetaPendiente from './TarjetaPendiente';
import Historial from './Historial';
import CajaMensaje from './CajaMensaje';
import { useI18n } from '../../i18n/I18nContext';
import ResultadosWeb from './ResultadosWeb';
import CapturasWeb from './CapturasWeb';

function accionesLegibles(acciones, t) {
  const grupos = new Map();
  for (const a of acciones) {
    const clave = `${a.name}:${a.ok}`;
    grupos.set(clave, { ...a, n: (grupos.get(clave)?.n || 0) + 1 });
  }
  return [...grupos.values()].map(a => {
    const clave = `assistant.action.${a.name}`;
    const etiqueta = t(clave) === clave ? a.name : t(clave);
    return `${a.ok ? '✓' : '✗'} ${etiqueta}${a.n > 1 ? ` ×${a.n}` : ''}${a.ok ? '' : ` (${t('assistant.action.failed')})`}`;
  }).join(' · ');
}

const REFERENCIA = /\[\d+:(\d+):(\d+)(?:-(\d+))?\]/g;
const sinReferencias = (texto) => String(texto || '')
  .replace(REFERENCIA, (_, c, p, hasta) => `(¶${Number(p) + 1}${hasta ? `–${Number(hasta) + 1}` : ''})`);
function lugarDe(ref) {
  const [, c, p] = String(ref).split(':').map(Number);
  return Number.isFinite(p) ? `Cap. ${c + 1}, ¶${p + 1}` : `[${ref}]`;
}

function Mensaje({ mensaje, alDecidir }) {
  const { t } = useI18n();
  const mio = mensaje.rol === 'user';

  return (
    <div className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        mio ? 'bg-red-600/90 text-white' : 'bg-white/5 text-gray-200'
      }`}>
        {mio
          ? <p className="whitespace-pre-wrap leading-relaxed text-sm">{mensaje.texto}</p>
          : <TextoConFormato texto={sinReferencias(mensaje.texto)} />}

        {!!mensaje.citas?.length && (
          <div className="mt-3 pt-3 border-t border-white/10 space-y-1">
            {mensaje.citas.map(c => (
              <p key={c.ref} className="text-[11px] opacity-60 leading-snug">
                <span className="opacity-80">{lugarDe(c.ref)}</span>{' '}
                {String(c.text || '').slice(0, 160)}
              </p>
            ))}
          </div>
        )}

        {(mensaje.pendientes || []).map(p => <TarjetaPendiente key={p.id} pendiente={p} alDecidir={alDecidir} />)}

        <CapturasWeb capturas={mensaje.capturas} />

        <ResultadosWeb obras={mensaje.obras} coste={mensaje.costeEstimado} />

        {!!mensaje.acciones?.length && (
          <p className="mt-2 text-[11px] opacity-50">{accionesLegibles(mensaje.acciones, t)}</p>
        )}
      </div>
    </div>
  );
}

export default function Asistente(props) {
  return <Conversacion key={props.punto?.workId || 'library'} {...props} />;
}

function Conversacion({ punto = null, alCerrar }) {
  const { t } = useI18n();
  const { hilo, hiloId, vista, abrirHilo, borrarHilo, pensando, respondiendo, nuevas, sinLeer, progreso, error, disponible, preguntar, cancelar, decidir } = useAsistente(punto);
  const [texto, setTexto] = useState('');

  const [fuera, setFuera] = useState(false);
  const finRef = useRef(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [hilo.length, pensando]);

  const enviar = () => {
    if (!texto.trim() || pensando) return;
    preguntar(texto, { fuera });
    setTexto('');
  };

  if (!disponible) {
    return (
      <div className="p-8 text-center text-gray-400">
        <p>{t('assistant.unavailable')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Historial conversaciones={vista?.threads} actual={hiloId} ocupado={pensando} respondiendo={respondiendo}
        nuevas={nuevas} sinLeer={sinLeer} alAbrir={abrirHilo} alBorrar={borrarHilo} />
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 md:px-6 py-6 space-y-4">
        {hilo.length === 0 && !pensando && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-2">{t(punto ? 'assistant.empty_title_reading' : 'assistant.empty_title')}</p>
            <p className="text-sm opacity-70">
              {punto ? t('assistant.empty_reading') : t('assistant.empty_library')}
            </p>
          </div>
        )}

        {hilo.map(m => <Mensaje key={m.id} mensaje={m} alDecidir={decidir} />)}

        {pensando && <Pensando cancelar={cancelar} progreso={progreso} />}

        {error && (
          <div className="text-center text-sm text-amber-400/90 px-4" role="alert">
            {error}
          </div>
        )}

        <div ref={finRef} />
      </div>

      <CajaMensaje {...{ texto, setTexto, pensando, punto, fuera, setFuera, enviar }} />

      {alCerrar && (
        <button onClick={alCerrar} className="sr-only">{t('common.close')}</button>
      )}
    </div>
  );
}

function Pensando({ cancelar, progreso }) {
  const { t } = useI18n();
  return (
          <div className="flex items-center gap-3 text-gray-400 text-sm px-1">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{progreso ? t('assistant.research.progress', { pages: progreso.paginas, max: progreso.maxPaginas,
              state: t(`assistant.research.${progreso.estado}`) }) : t('assistant.thinking')}</span>
            <button
              onClick={cancelar}
              className="ml-2 flex items-center gap-1 min-h-[44px] px-2 text-[11px] opacity-60 hover:opacity-100 transition-opacity"
            >
              <Square className="w-3 h-3" /> {t('assistant.stop')}
            </button>
          </div>
  );
}
