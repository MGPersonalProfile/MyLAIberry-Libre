import { useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';

export default function SeleccionCapitulos({ obra, alGuardar }) {
  const { t } = useI18n();
  const capitulos = obra.chapterList || [];
  const [marcados, setMarcados] = useState(() => capitulos.map((_, i) => i));
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(false);
  const alternar = (i) => setMarcados(prev => prev.includes(i) ? prev.filter(n => n !== i) : [...prev, i]);
  const guardar = async () => {
    setOcupado(true);
    setError(false);
    try {
      const res = await window.api.elegirCapitulos(obra.id, marcados);
      if (res.status !== 'success') throw new Error(res.message);
      alGuardar(res.data);
    } catch {
      setError(true);
    } finally {
      setOcupado(false);
    }
  };
  return (
    <section className="mb-6 p-4 border border-amber-500/50 rounded-lg" aria-label={t('selection.title')}>
      <h3 className="font-bold text-amber-300">{t('selection.title')}</h3>
      <p className="text-sm text-gray-300 my-2">{t('selection.hint')}</p>
      <fieldset disabled={ocupado}>
        <div className="flex gap-4 mb-3">
          <button onClick={() => setMarcados(capitulos.map((_, i) => i))}>{t('selection.all')}</button>
          <button onClick={() => setMarcados([])}>{t('selection.none')}</button>
        </div>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {capitulos.map((cap, i) => (
            <label key={i} className="flex gap-3 items-start p-2 rounded bg-white/5">
              <input type="checkbox" checked={marcados.includes(i)} onChange={() => alternar(i)} />
              <span className="min-w-0 break-words">{cap.title || t('selection.chapter', { n: i + 1 })}
                <small className="block text-gray-400 break-all">{cap.url}</small>
              </span>
            </label>
          ))}
        </div>
        <button className="mt-3 px-4 py-2 bg-blue-600 rounded disabled:opacity-40" disabled={!marcados.length} onClick={guardar}>
          {t(ocupado ? 'selection.saving' : 'selection.save')}
        </button>
      </fieldset>
      {error && <p role="alert" className="text-red-400 mt-2">{t('selection.error')}</p>}
    </section>
  );
}
