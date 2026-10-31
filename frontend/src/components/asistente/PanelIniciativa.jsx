import { Bell, Search, Eye, Brain, Languages, Pause, Play, X, Check, Download, Library, PenLine } from 'lucide-react';
import useIniciativa from '../../hooks/useIniciativa';
import Recuerdos from './Recuerdos';
import Estanterias from './Estanterias';
import Pistas from './Pistas';
import NuevaInvestigacion from './NuevaInvestigacion';
import ReglasGenerales from './ReglasGenerales';
import ColaDeTrabajos from './ColaDeTrabajos';
import { useI18n } from '../../i18n/I18nContext';

function Seccion({ icono: Icono, titulo, cuantos, children }) {
  if (!cuantos) return null;
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-50">
        <Icono className="w-3.5 h-3.5" /> {titulo}
      </h3>
      {children}
    </section>
  );
}

function Accion({ onClick, children, icono: Icono }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
    >
      {Icono && <Icono className="w-3 h-3" />} {children}
    </button>
  );
}

const tarjeta = 'rounded-xl bg-white/5 px-3 py-2.5 text-sm [overflow-wrap:anywhere]';

function Candidatas({ job, accion, t }) {
  const rescate = job.kind === 'lost' && !!job.contrastadas?.length;
  const lista = rescate ? job.contrastadas : (job.findings || []);
  if (!lista.length) return null;

  return (
    <ul className="mt-2 space-y-1.5 border-t border-white/10 pt-2">
      {lista.slice(0, 6).map(f => (
        <li key={f.url} className="text-[12px]">
          <div className="flex items-center justify-between gap-2">
            <span className={`truncate ${f.veredicto === 'descartada' ? 'opacity-40 line-through' : 'opacity-80'}`}>
              {f.title || f.url}
            </span>
            <Accion onClick={() => accion('excludeFinding', { id: job.id, url: f.url })} icono={X}>
              {t('initiative.dismiss')}
            </Accion>
          </div>

          {rescate && (
            <p className="text-[11px] opacity-60 mt-0.5">
              {f.veredicto === 'descartada'
                ? t('initiative.contradicts', { pista: f.contradicen[0] })
                : t('initiative.matches', { n: f.concuerdan.length, dudas: f.sinComprobar.length })}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function PanelIniciativa() {
  const { t } = useI18n();
  const {
    disponible, cargando, error, accion, consumo, ajustes,
    avisos, investigaciones, radar, memoria, reglas,
    estanterias, deshacibles, operaciones, propuestas, buzon
  } = useIniciativa();

  if (!disponible) return <p className="p-6 text-center text-gray-400">{t('assistant.unavailable')}</p>;
  if (cargando) return <p className="p-6 text-center text-gray-500">…</p>;

  const activas = investigaciones.filter(i => i.status !== 'closed');
  const vigiladas = radar.filter(r => r.status === 'active');
  const muertas = reglas.filter(r => r.aplicable === false);
  const enCurso = operaciones.filter(o => o.estado === 'descargando');
  const borradores = propuestas.filter(c => c.status === 'draft');
  const vacio = !avisos.length && !activas.length && !vigiladas.length && !memoria.length
    && !enCurso.length && !estanterias.length && !borradores.length && !buzon.length;

  return (
    <div className="h-full overflow-y-auto px-6 py-6 space-y-7 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg">{t('initiative.title')}</h2>
        <Accion
          onClick={() => accion('settings', { paused: !ajustes?.paused })}
          icono={ajustes?.paused ? Play : Pause}
        >
          {ajustes?.paused ? t('initiative.resume_all') : t('initiative.pause_all')}
        </Accion>
      </div>

      {ajustes?.paused && (
        <p className="text-sm text-amber-400/90" role="status">{t('initiative.paused_all')}</p>
      )}
      {error && <p className="text-sm text-amber-400/90" role="alert">{error}</p>}
      {vacio && <p className="text-sm opacity-50">{t('initiative.empty')}</p>}

      <Seccion icono={Bell} titulo={t('initiative.inbox')} cuantos={avisos.length}>
        {avisos.map(aviso => (
          <div key={aviso.id} className={`${tarjeta} flex items-start justify-between gap-3`}>
            <p className="leading-snug">{aviso.text}</p>
            <Accion onClick={() => accion('dismiss', { id: aviso.id })} icono={Check}>
              {t('initiative.dismiss')}
            </Accion>
          </div>
        ))}
      </Seccion>

      <Seccion icono={Search} titulo={t('initiative.research')} cuantos={1}>
        <NuevaInvestigacion accion={accion} tarjeta={tarjeta} />
        {activas.map(job => (
          <div key={job.id} className={tarjeta}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate">{job.query}</p>
                <p className="text-[11px] opacity-50 mt-0.5">
                  {t('initiative.findings', { n: job.findings?.length || 0 })}
                  {job.kind === 'lost' && ' · ' + t('initiative.lost')}
                  {job.status === 'paused' && ' · ' + t('initiative.paused')}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Accion
                  onClick={() => accion('investigationStatus', { id: job.id, status: job.status === 'paused' ? 'active' : 'paused' })}
                  icono={job.status === 'paused' ? Play : Pause}
                >
                  {job.status === 'paused' ? t('initiative.resume') : t('initiative.pause')}
                </Accion>
                <Accion onClick={() => accion('investigationStatus', { id: job.id, status: 'closed' })} icono={X}>
                  {t('initiative.close')}
                </Accion>
              </div>
            </div>

            {!!job.errors?.length && (
              <p className="text-[11px] text-amber-400/80 mt-2">{job.errors.join(' · ')}</p>
            )}

            <Candidatas job={job} accion={accion} t={t} />
            {job.kind === 'lost' && <Pistas job={job} accion={accion} />}
          </div>
        ))}
      </Seccion>

      <Seccion icono={Download} titulo={t('initiative.operations')} cuantos={enCurso.length}>
        {enCurso.map(op => (
          <div key={op.id} className={tarjeta}>
            <p className="truncate">{op.title}</p>
            <p className="text-[11px] opacity-50 mt-0.5">
              {t('initiative.downloading', { n: op.descargados, total: op.total })}
              {op.traducir && ' · ' + t('initiative.also_translating')}
            </p>
          </div>
        ))}
      </Seccion>

      <Seccion icono={Download} titulo={t('queue.title')} cuantos={1}>
        <ColaDeTrabajos Accion={Accion} tarjeta={tarjeta} />
      </Seccion>

      <Seccion icono={Library} titulo={t('initiative.shelves')} cuantos={1}>
        <Estanterias estanterias={estanterias} deshacibles={deshacibles} accion={accion} Accion={Accion} tarjeta={tarjeta} />
      </Seccion>

      <Seccion icono={PenLine} titulo={t('initiative.changes')} cuantos={borradores.length + buzon.length}>

        {buzon.map(n => (
          <div key={n.id} className={tarjeta}>
            <p className="leading-snug">
              {n.tipo === 'fallo' && <span className="text-amber-400/90">{t('initiative.mailbox_failure')} · </span>}
              {n.texto}{n.veces > 1 ? ` ×${n.veces}` : ''}
            </p>
          </div>
        ))}
        {borradores.map(c => (
          <div key={c.id} className={`${tarjeta} flex items-start justify-between gap-3`}>
            <p className="leading-snug">{c.request}</p>
            <Accion onClick={() => accion('sendChange', { id: c.id })} icono={Check}>
              {t('initiative.change_send')}
            </Accion>
          </div>
        ))}
      </Seccion>

      <Seccion icono={Eye} titulo={t('initiative.radar')} cuantos={vigiladas.length}>
        {vigiladas.map(r => (
          <div key={r.id} className={`${tarjeta} flex items-start justify-between gap-3`}>
            <div className="min-w-0">

              <p className="leading-snug">{r.title || r.reason}</p>
              {r.title && r.reason && <p className="text-[12px] opacity-70 mt-0.5">{r.reason}</p>}
              <p className="text-[11px] opacity-50 mt-0.5">
                {r.condition === 'complete'
                  ? t('initiative.radar_complete')
                  : t('initiative.radar_chapters', { n: r.chapters })}
              </p>
            </div>
            <Accion onClick={() => accion('stopWatch', { id: r.id })} icono={X}>{t('watch.stop')}</Accion>
          </div>
        ))}
      </Seccion>

      <Seccion icono={Brain} titulo={t('initiative.memory')} cuantos={1}>
        <Recuerdos memoria={memoria} accion={accion} Accion={Accion} tarjeta={tarjeta} />
      </Seccion>

      <Seccion icono={Languages} titulo={t('initiative.rules_general')} cuantos={1}>
        <ReglasGenerales reglas={reglas} accion={accion} Accion={Accion} tarjeta={tarjeta} />
      </Seccion>

      <Seccion icono={Languages} titulo={t('initiative.rules')} cuantos={muertas.length}>
        {muertas.map(r => (
          <div key={r.id} className={`${tarjeta} flex items-start justify-between gap-3`}>
            <div className="min-w-0">
              <p className="leading-snug opacity-80">{r.text}</p>
              <p className="text-[11px] text-amber-400/70 mt-0.5">{t('initiative.rule_dead')}</p>
            </div>
            {r.id && <Accion onClick={() => accion('removeRule', { id: r.id })} icono={X}>{t('initiative.rule_remove')}</Accion>}
          </div>
        ))}
      </Seccion>

      <section className="pt-2 border-t border-white/10 text-[11px] opacity-50 space-y-0.5">
        <p>{t('initiative.limits')}</p>
        <p>{t('initiative.calls', { n: consumo.calls, tope: ajustes?.dailyCalls ?? 0 })}</p>
        <p>{t('initiative.background', { n: consumo.background, tope: ajustes?.backgroundCalls ?? 0 })}</p>
      </section>
    </div>
  );
}
