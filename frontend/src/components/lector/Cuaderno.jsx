import { useState } from 'react';
import { Lightbulb, FileText, PenLine, X, Check, Plus, NotebookPen } from 'lucide-react';
import useIniciativa from '../../hooks/useIniciativa';
import { useI18n } from '../../i18n/I18nContext';
import { IconButton, PrimaryButton, SecondaryButton } from '../ui/Buttons';
import { SegmentedControl } from '../ui/Controls';
import { Card, SectionHeader } from '../ui/Layout';
import { EmptyState } from '../ui/Feedback';

export default function Cuaderno({ punto }) {
  const { t } = useI18n();
  const { notas, teorias, cargando, accion } = useIniciativa(punto);

  if (cargando) return <p className="p-6 text-center text-text-secondary">…</p>;

  const porCapitulo = agrupar([
    ...teorias.map(x => ({ ...x, esTeoria: x.type !== 'fact' })),
    ...notas.map(x => ({ ...x, esTeoria: false }))
  ]);

  return (
    <div className="dark h-full overflow-y-auto px-5 py-5 space-y-5 text-text-primary">
      <Apuntar accion={accion} />

      {!porCapitulo.length && <EmptyState icon={NotebookPen} description={t('notebook.empty')} className="py-8" />}

      {porCapitulo.map(([capitulo, entradas]) => (
        <section key={capitulo} className="space-y-1.5">
          <SectionHeader title={t('notebook.chapter', { n: Number(capitulo) + 1 })} className="!mb-1.5" />

          {entradas.map(entrada => <Entrada key={entrada.id} entrada={entrada} accion={accion} />)}
        </section>
      ))}
    </div>
  );
}

function Apuntar({ accion }) {
  const { t } = useI18n();
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState('note');
  const enviar = async (e) => {
    e.preventDefault();
    if (!texto.trim()) return;
    const r = await accion('note', { text: texto.trim(), type: tipo });
    if (r?.ok) setTexto('');
  };
  return (
    <Card as="form" onSubmit={enviar} className="flex flex-col gap-3">
      <input value={texto} onChange={e => setTexto(e.target.value)} maxLength={1000}
             placeholder={t('notebook.add_placeholder')} aria-label={t('notebook.add_placeholder')}
             className="w-full min-h-[var(--control-search-h)] px-3.5 rounded-md bg-surface-secondary border border-border/60 text-base md:text-body text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl ariaLabel={t('notebook.title')} value={tipo} onChange={setTipo} options={[
          { id: 'note', etiqueta: t('notebook.fact') },
          { id: 'theory', etiqueta: t('notebook.theory') }
        ]} />
        <PrimaryButton type="submit" size="sm" icon={Plus} disabled={!texto.trim()}>{t('notebook.add')}</PrimaryButton>
      </div>
    </Card>
  );
}

function Entrada({ entrada, accion }) {
  const { t } = useI18n();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(entrada.text);

  if (editando) {
    const guardar = async (e) => {
      e.preventDefault();
      if (texto.trim() && texto.trim() !== entrada.text) {
        const r = await accion('editNote', { id: entrada.id, text: texto.trim() });
        if (!r?.ok) return;
      }
      setEditando(false);
    };
    const cancelar = () => { setTexto(entrada.text); setEditando(false); };
    return (
      <Card as="form" onSubmit={guardar} className="flex flex-col gap-3">
        <input value={texto} onChange={e => setTexto(e.target.value)} autoFocus maxLength={1000}
               aria-label={t('notebook.edit')} onKeyDown={e => { if (e.key === 'Escape') cancelar(); }}
               className="w-full min-h-[var(--control-search-h)] px-3.5 rounded-md bg-surface-secondary border border-border/60 text-base md:text-body text-text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25" />
        <div className="flex justify-end gap-2">
          <SecondaryButton size="sm" onClick={cancelar}>{t('notebook.cancel')}</SecondaryButton>
          <PrimaryButton type="submit" size="sm" icon={Check}>{t('notebook.save')}</PrimaryButton>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex gap-2.5 !p-3">

      {entrada.esTeoria
        ? <Lightbulb className="w-4 h-4 mt-0.5 shrink-0 text-warning" aria-label={t('notebook.theory')} />
        : <FileText className="w-4 h-4 mt-0.5 shrink-0 text-text-tertiary" aria-label={t('notebook.fact')} />}

      <p className="flex-1 min-w-0 text-body">{entrada.text}</p>

      <div className="flex gap-1 shrink-0 self-start">
        <IconButton size="sm" icon={PenLine} label={t('notebook.edit')} onClick={() => { setTexto(entrada.text); setEditando(true); }} />
        <IconButton size="sm" icon={X} label={t('notebook.delete')} onClick={() => accion('deleteNote', { id: entrada.id })} />
      </div>
    </Card>
  );
}

function agrupar(entradas) {
  const mapa = new Map();
  for (const entrada of entradas) {
    const capitulo = entrada.point?.chapter ?? 0;
    if (!mapa.has(capitulo)) mapa.set(capitulo, []);
    mapa.get(capitulo).push(entrada);
  }

  return [...mapa.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([capitulo, lista]) => [
      capitulo,
      lista.sort((a, b) => (a.point?.paragraph ?? 0) - (b.point?.paragraph ?? 0))
    ]);
}
