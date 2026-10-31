import { useState } from 'react';
import { Search } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';

export default function BuscarEnLaObra({ obraId, idioma, actual, total, alElegir }) {
  const { t } = useI18n();
  const [texto, setTexto] = useState('');
  const [todaLaObra, setTodaLaObra] = useState(false);
  const [estado, setEstado] = useState(null);
  if (!window.api?.buscarEnLaObra) return null;

  const buscar = async (e) => {
    e.preventDefault();
    if (!texto.trim()) return;
    setEstado('buscando');
    try {
      const r = await window.api.buscarEnLaObra(obraId, texto.trim(), todaLaObra ? total : actual + 1, idioma);
      setEstado(r?.status === 'ok' ? r : { error: r?.message || t('reader.search_failed') });
    } catch (err) {
      setEstado({ error: err?.message || t('reader.search_failed') });
    }
  };

  return (
    <div className="px-6 py-3 border-b border-white/10" data-buscar-en-la-obra>
      <form onSubmit={buscar} className="flex items-center gap-2">
        <Search className="w-4 h-4 text-gray-500 shrink-0" />
        <input value={texto} onChange={e => setTexto(e.target.value)} maxLength={200}
               placeholder={t('reader.search_placeholder')} aria-label={t('reader.search_placeholder')}
               className="flex-1 min-w-0 bg-transparent text-sm text-gray-200 outline-none placeholder-gray-600" />
      </form>
      <label className="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
        <input type="checkbox" checked={todaLaObra} onChange={e => setTodaLaObra(e.target.checked)} />
        {t('reader.search_all')}
      </label>
      {estado === 'buscando' && <p className="mt-2 text-xs text-gray-500">{t('reader.searching')}</p>}
      {estado?.error && <p className="mt-2 text-xs text-red-400" role="alert">{estado.error}</p>}
      {estado?.apariciones && (
        <div className="mt-2 max-h-72 overflow-y-auto space-y-1">
          <p className="text-[11px] text-gray-500">
            {estado.capitulosConElTexto
              ? t('reader.search_found', { n: estado.capitulosConElTexto, revisados: estado.revisados })
              : t('reader.search_none', { revisados: estado.revisados })}
          </p>
          {estado.apariciones.map(a => (
            <button key={a.indice} onClick={() => alElegir(a.indice)}
                    className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors">
              <span className="text-xs text-gray-300">{t('reader.search_chapter', { n: a.capitulo, veces: a.veces })}</span>
              <span className="block text-[11px] text-gray-500 leading-snug line-clamp-2">{a.fragmento}</span>
            </button>
          ))}
          {estado.masAllaDeEstos > 0 && <p className="text-[11px] text-gray-600">{t('reader.search_more', { n: estado.masAllaDeEstos })}</p>}
        </div>
      )}
    </div>
  );
}
