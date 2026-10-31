import { useState } from 'react';
import { Lightbulb, FileText, PenLine, X, Check, Plus } from 'lucide-react';
import useIniciativa from '../../hooks/useIniciativa';
import { useI18n } from '../../i18n/I18nContext';

export default function Cuaderno({ punto }) {
  const { t } = useI18n();
  const { notas, teorias, cargando, accion } = useIniciativa(punto);

  if (cargando) return <p className="p-6 text-center text-gray-500">…</p>;

  const porCapitulo = agrupar([
    ...teorias.map(x => ({ ...x, esTeoria: x.type !== 'fact' })),
    ...notas.map(x => ({ ...x, esTeoria: false }))
  ]);

  return (
    <div className="h-full overflow-y-auto px-5 py-5 space-y-5">
      <Apuntar accion={accion} />

      {!porCapitulo.length && <p className="text-center text-sm text-gray-500">{t('notebook.empty')}</p>}

      {porCapitulo.map(([capitulo, entradas]) => (
        <section key={capitulo} className="space-y-1.5">
          <h3 className="text-[11px] uppercase tracking-wide opacity-40">
            {t('notebook.chapter', { n: Number(capitulo) + 1 })}
          </h3>

          {entradas.map(entrada => <Entrada key={entrada.id} entrada={entrada} accion={accion} />)}
        </section>
      ))}
    </div>
  );
}

const botonPequeno = 'flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-40';

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
    <form onSubmit={enviar} className="rounded-xl bg-white/5 px-3 py-2 flex flex-wrap items-center gap-2">
      <input value={texto} onChange={e => setTexto(e.target.value)} maxLength={1000}
             placeholder={t('notebook.add_placeholder')} aria-label={t('notebook.add_placeholder')}
             className="flex-1 min-w-40 bg-transparent text-sm outline-none placeholder-gray-500" />
      <div className="flex gap-1">
        {['note', 'theory'].map(k => (
          <button key={k} type="button" onClick={() => setTipo(k)} aria-pressed={tipo === k}
                  className={`text-[11px] px-2 py-1 rounded-lg transition-colors ${tipo === k ? 'bg-white/15 text-white' : 'bg-white/5 opacity-60 hover:opacity-100'}`}>
            {k === 'theory' ? t('notebook.theory') : t('notebook.fact')}
          </button>
        ))}
      </div>
      <button type="submit" disabled={!texto.trim()} className={botonPequeno}>
        <Plus className="w-3 h-3" /> {t('notebook.add')}
      </button>
    </form>
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
      <form onSubmit={guardar} className="rounded-xl bg-white/5 px-3 py-2 flex items-center gap-2">
        <input value={texto} onChange={e => setTexto(e.target.value)} autoFocus maxLength={1000}
               aria-label={t('notebook.edit')} onKeyDown={e => { if (e.key === 'Escape') cancelar(); }}
               className="flex-1 min-w-0 bg-transparent text-sm outline-none border-b border-white/20 focus:border-white/50" />
        <button type="submit" className={botonPequeno}><Check className="w-3 h-3" /> {t('notebook.save')}</button>
        <button type="button" onClick={cancelar} className="text-[11px] px-2 py-1 opacity-60 hover:opacity-100">{t('notebook.cancel')}</button>
      </form>
    );
  }

  return (
    <div className="rounded-xl bg-white/5 px-3 py-2 flex gap-2.5">

      {entrada.esTeoria
        ? <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400/70" aria-label={t('notebook.theory')} />
        : <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-40" aria-label={t('notebook.fact')} />}

      <p className="flex-1 min-w-0 text-sm leading-snug">{entrada.text}</p>

      <div className="flex gap-1 shrink-0 self-start">
        <button onClick={() => { setTexto(entrada.text); setEditando(true); }} className={botonPequeno}>
          <PenLine className="w-3 h-3" /> {t('notebook.edit')}
        </button>
        <button onClick={() => accion('deleteNote', { id: entrada.id })} className={botonPequeno}>
          <X className="w-3 h-3" /> {t('notebook.delete')}
        </button>
      </div>
    </div>
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
