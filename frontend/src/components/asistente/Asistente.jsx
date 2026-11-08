import { useState, useRef, useEffect } from 'react';
import { Square, MessageCircle } from 'lucide-react';
import { SecondaryButton } from '../ui/Buttons';
import { EmptyState, Girando, Notice } from '../ui/Feedback';
import useAsistente from '../../hooks/useAsistente';
import TextoConFormato from './TextoConFormato';
import TarjetaPendiente from './TarjetaPendiente';
import Historial from './Historial';
import CajaMensaje from './CajaMensaje';
import { useI18n } from '../../i18n/I18nContext';
import ResultadosWeb from './ResultadosWeb';
import CapturasWeb from './CapturasWeb';
import RetoPendiente from './RetoPendiente';
import { useAlPedirAlAsistente, tomarPregunta } from '../../preguntaAlAsistente';

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
        mio ? 'bg-accent text-white' : 'bg-surface-secondary text-text-primary'
      }`}>
        {mio
          ? <p className="whitespace-pre-wrap leading-relaxed text-sm">{mensaje.texto}</p>
          : <TextoConFormato texto={sinReferencias(mensaje.texto)} />}

        {!!mensaje.citas?.length && (
          <div className="mt-3 pt-3 border-t border-border/60 space-y-1">
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

function usePreguntaExterna({ punto, disponible, pensando, preguntar }) {
  const [aviso, setAviso] = useState(0);
  useAlPedirAlAsistente(() => setAviso(n => n + 1), !punto);
  useEffect(() => {
    if (punto || !disponible || pensando) return;
    const pedida = tomarPregunta();
    if (pedida) preguntar(pedida, { fuera: false });
  }, [punto, disponible, pensando, aviso]);
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

  usePreguntaExterna({ punto, disponible, pensando, preguntar });

  const enviar = () => {
    if (!texto.trim() || pensando) return;
    preguntar(texto, { fuera });
    setTexto('');
  };

  if (!disponible) {
    return (
      <EmptyState icon={MessageCircle} description={t('assistant.unavailable')} />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Historial conversaciones={vista?.threads} actual={hiloId} ocupado={pensando} respondiendo={respondiendo}
        nuevas={nuevas} sinLeer={sinLeer} alAbrir={abrirHilo} alBorrar={borrarHilo} />
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 md:px-6 py-6 space-y-4">
        {hilo.length === 0 && !pensando && (
          <EmptyState icon={MessageCircle} title={t(punto ? 'assistant.empty_title_reading' : 'assistant.empty_title')}
            description={punto ? t('assistant.empty_reading') : t('assistant.empty_library')} />
        )}

        {hilo.map(m => <Mensaje key={m.id} mensaje={m} alDecidir={decidir} />)}

        {pensando && <Pensando cancelar={cancelar} progreso={progreso} />}

        {error && (
          <Notice tone="warning" compact>{error}</Notice>
        )}

        <div ref={finRef} />
      </div>

      {!punto && <RetoPendiente />}

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
          <div className="flex items-center gap-3 text-text-secondary text-small px-1" role="status">
            <Girando className="w-4 h-4" />
            <span>{progreso ? (progreso.mensaje || t('assistant.research.progress', { pages: progreso.paginas, max: progreso.maxPaginas,
              state: t(`assistant.research.${progreso.estado}`) })) : t('assistant.thinking')}</span>
            <SecondaryButton size="sm" icon={Square} onClick={cancelar}>{t('assistant.stop')}</SecondaryButton>
          </div>
  );
}
