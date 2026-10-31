import { useState } from 'react';
import { Layers } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';

export default function CopiasDeLaObra({ obraId }) {
  const { t } = useI18n();
  const [copias, setCopias] = useState(null);

  const [fundir, setFundir] = useState(null);
  if (!window.api?.copiasDeLaObra || !window.api?.fundirObras) return null;

  const buscar = async () => {
    setCopias('buscando');
    setFundir(null);
    try {
      const r = await window.api.copiasDeLaObra(obraId);
      setCopias(Array.isArray(r) ? r : { error: r?.message || t('copies.failed') });
    } catch (e) {
      setCopias({ error: e?.message || t('copies.failed') });
    }
  };

  const fundirla = async (id) => {
    setFundir({ id, fase: 'fundiendo' });
    try {
      const r = await window.api.fundirObras(obraId, id);
      const ok = r?.status === 'ok';
      if (ok) {
        setCopias(cs => Array.isArray(cs) ? cs.filter(c => c.otra.id !== id) : cs);

        window.dispatchEvent(new CustomEvent('mylaiberry-obra-fundida', { detail: { id: obraId } }));
      }
      setFundir({ id, texto: ok ? t('copies.merged') : (r?.message || t('copies.failed')), error: !ok });
    } catch (e) {
      setFundir({ id, texto: e?.message || t('copies.failed'), error: true });
    }
  };

  return (
    <div className="mt-6" data-copias-obra>
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">{t('copies.title')}</h3>
      <button onClick={buscar} disabled={copias === 'buscando'}
              className="text-xs px-3 py-1 rounded-full border border-white/15 text-gray-400 hover:text-gray-200 disabled:opacity-50 flex items-center gap-1.5">
        <Layers className="w-3 h-3" /> {copias === 'buscando' ? t('copies.checking') : t('copies.check')}
      </button>
      {copias?.error && <p className="text-xs text-red-400 mt-2" role="alert">{copias.error}</p>}
      {Array.isArray(copias) && !copias.length && <p className="mt-2 text-xs text-gray-500">{t('copies.none')}</p>}
      {Array.isArray(copias) && copias.length > 0 && (
        <ul className="mt-2 space-y-3 text-sm">
          {copias.map(({ otra, motivo }) => (
            <li key={otra.id} className="text-amber-300/90">
              <p>{t('copies.one', { titulo: otra.titulo, sitio: otra.sitio || '—', capitulos: otra.capitulos ?? '?', motivo: t(motivo === 'direccion' ? 'copies.why_url' : 'copies.why_title') })}</p>
              {fundir?.id !== otra.id && (
                <button onClick={() => setFundir({ id: otra.id, fase: 'confirmando' })}
                        className="mt-1 text-xs px-3 py-1 rounded-full border border-amber-300/30 text-amber-300/90 hover:text-amber-200">
                  {t('copies.merge')}
                </button>
              )}
              {fundir?.id === otra.id && fundir.fase === 'confirmando' && (
                <div className="mt-1 text-xs text-gray-300 space-y-2">
                  <p>{t('copies.merge_confirm')}</p>
                  <div className="flex gap-2">
                    <button onClick={() => fundirla(otra.id)} className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-200 border border-amber-300/30">{t('copies.merge_yes')}</button>
                    <button onClick={() => setFundir(null)} className="px-3 py-1 rounded-full border border-white/15 text-gray-400">{t('copies.cancel')}</button>
                  </div>
                </div>
              )}
              {fundir?.id === otra.id && fundir.fase === 'fundiendo' && <p className="mt-1 text-xs text-gray-400">{t('copies.merging')}</p>}
            </li>
          ))}
        </ul>
      )}
      {fundir?.texto && <p className={`mt-2 text-xs ${fundir.error ? 'text-red-400' : 'text-gray-300'}`} role={fundir.error ? 'alert' : undefined}>{fundir.texto}</p>}
    </div>
  );
}
