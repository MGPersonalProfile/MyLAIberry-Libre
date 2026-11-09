import { useEffect, useRef } from 'react';
import { Bell, Search, Eye, Brain, Languages, Pause, Play, X, Check, Download, Library, PenLine } from 'lucide-react';
import useIniciativa from '../../hooks/useIniciativa';
import Recuerdos from './Recuerdos';
import Estanterias from './Estanterias';
import Pistas from './Pistas';
import EjecucionInvestigacion from './EjecucionInvestigacion';
import useEjecucionesInvestigacion from '../../hooks/useEjecucionesInvestigacion';
import NuevaInvestigacion from './NuevaInvestigacion';
import ReglasGenerales from './ReglasGenerales';
import ColaDeTrabajos from './ColaDeTrabajos';
import { useI18n } from '../../i18n/I18nContext';
import { SecondaryButton } from '../ui/Buttons';
import { EmptyState, Notice } from '../ui/Feedback';
import { SectionHeader } from '../ui/Layout';
import { CLASE_CARD } from '../ui/clases';

function Seccion({ icono, titulo, cuantos, children }) {
  if (!cuantos) return null;
  return (
    <section className="space-y-2">
      <SectionHeader icon={icono} title={titulo} className="!mb-1" />
      {children}
    </section>
  );
}

function Accion({ onClick, children, icono }) {
  return <SecondaryButton size="sm" icon={icono} onClick={onClick} className="whitespace-nowrap">{children}</SecondaryButton>;
}

const tarjeta = `${CLASE_CARD} px-3 py-2.5 text-body [overflow-wrap:anywhere]`;

function Candidatas({ job, accion, t }) {
  const rescate = job.kind === 'lost' && !!job.contrastadas?.length;
  const lista = rescate ? job.contrastadas : (job.findings || []);
  if (!lista.length) return null;

  return (
    <ul className="mt-2 space-y-1.5 border-t border-separator pt-2">
      {lista.slice(0, 6).map(f => (
        <li key={f.url} className="text-footnote">
          <div className="flex items-center justify-between gap-2">
            <span className={`truncate ${f.veredicto === 'descartada' ? 'text-text-tertiary line-through' : 'text-text-secondary'}`}>
              {f.title || f.url}
            </span>
            <Accion onClick={() => accion('excludeFinding', { id: job.id, url: f.url })} icono={X}>
              {t('initiative.dismiss')}
            </Accion>
          </div>

          {rescate && (
            <p className="text-caption text-text-secondary mt-0.5">
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

  const refrescarRef = useRef(null);
  const ejecuciones = useEjecucionesInvestigacion({ alTerminar: () => refrescarRef.current?.() });
  const {
    disponible, cargando, error, accion, consumo, ajustes, refrescar,
    avisos, investigaciones, radar, memoria, reglas,
    estanterias, deshacibles, operaciones, propuestas, buzon
  } = useIniciativa();
  useEffect(() => { refrescarRef.current = refrescar; });

  if (!disponible) return <EmptyState description={t('assistant.unavailable')} />;
  if (cargando) return <p className="p-6 text-center text-text-secondary">…</p>;

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
        <h2 className="text-title-3 text-text-primary">{t('initiative.title')}</h2>
        <Accion
          onClick={() => accion('settings', { paused: !ajustes?.paused })}
          icono={ajustes?.paused ? Play : Pause}
        >
          {ajustes?.paused ? t('initiative.resume_all') : t('initiative.pause_all')}
        </Accion>
      </div>

      {ajustes?.paused && (
        <Notice tone="warning" compact role="status">{t('initiative.paused_all')}</Notice>
      )}
      {error && <Notice tone="warning" compact>{error}</Notice>}
      {vacio && <p className="text-small text-text-secondary">{t('initiative.empty')}</p>}

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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 basis-40">
                <p>{job.query}</p>
                <p className="text-caption text-text-secondary mt-0.5">
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
              <p className="text-caption text-warning mt-2">{job.errors.join(' · ')}</p>
            )}

            {ejecuciones.disponible && (
              <EjecucionInvestigacion job={job} ejecucion={ejecuciones.de(job.id)} desactualizado={ejecuciones.desactualizado}
                iniciar={ejecuciones.iniciar} cancelar={ejecuciones.cancelar} reintentar={ejecuciones.reintentar} />
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
            <p className="text-caption text-text-secondary mt-0.5">
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
              {n.tipo === 'fallo' && <span className="text-warning">{t('initiative.mailbox_failure')} · </span>}
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
              {r.title && r.reason && <p className="text-footnote text-text-secondary mt-0.5">{r.reason}</p>}
              <p className="text-caption text-text-secondary mt-0.5">
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
              <p className="leading-snug text-text-secondary">{r.text}</p>
              <p className="text-caption text-warning mt-0.5">{t('initiative.rule_dead')}</p>
            </div>
            {r.id && <Accion onClick={() => accion('removeRule', { id: r.id })} icono={X}>{t('initiative.rule_remove')}</Accion>}
          </div>
        ))}
      </Seccion>

      <section className="pt-2 border-t border-separator text-caption text-text-secondary space-y-0.5">
        <p>{t('initiative.limits')}</p>
        <p>{t('initiative.calls', { n: consumo.calls, tope: ajustes?.dailyCalls ?? 0 })}</p>
        <p>{t('initiative.background', { n: consumo.background, tope: ajustes?.backgroundCalls ?? 0 })}</p>
      </section>
    </div>
  );
}
