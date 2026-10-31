import { useState } from 'react';
import { Copy } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';

export default function RevisarCapitulos({ obraId, total }) {
  const { t } = useI18n();
  const [estado, setEstado] = useState(null);

  const [reparacion, setReparacion] = useState(null);
  if (!window.api?.revisarCapitulosRepetidos || !total) return null;

  const reparar = async () => {
    setReparacion('reparando');
    try {
      const r = await window.api.repararObra(obraId);
      setReparacion(r?.status === 'error' ? { texto: r.message || t('repeated.failed'), error: true } : { texto: r?.message || '' });
    } catch (e) {
      setReparacion({ texto: e?.message || t('repeated.failed'), error: true });
    }
  };

  const revisar = async () => {
    setEstado('revisando');
    try {
      const r = await window.api.revisarCapitulosRepetidos(obraId, total);
      setEstado(r?.status === 'ok' ? r : { error: r?.message || t('repeated.failed') });
    } catch (e) {
      setEstado({ error: e?.message || t('repeated.failed') });
    }
  };

  const hallazgos = estado?.repetidos ? [
    ...estado.repetidos.map(r => t(r.identicos ? 'repeated.same' : 'repeated.pair', { a: r.capitulos[0], b: r.capitulos[1], parte: r.parteCompartida })),
    ...estado.conTramosRepetidos.map(r => t('repeated.inner', { a: r.capitulo, parte: r.parteRepetida }))
  ] : [];

  return (
    <div className="mt-6" data-revisar-capitulos>
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">{t('repeated.title')}</h3>
      <button onClick={revisar} disabled={estado === 'revisando'}
              className="text-xs px-3 py-1 rounded-full border border-white/15 text-gray-400 hover:text-gray-200 disabled:opacity-50 flex items-center gap-1.5">
        <Copy className="w-3 h-3" /> {estado === 'revisando' ? t('repeated.checking') : t('repeated.check')}
      </button>
      {estado?.error && <p className="text-xs text-red-400 mt-2" role="alert">{estado.error}</p>}
      {estado?.repetidos && (hallazgos.length
        ? <ul className="mt-2 space-y-1 text-sm text-amber-300/90">{hallazgos.map(h => <li key={h}>{h}</li>)}</ul>
        : <p className="mt-2 text-xs text-gray-500">{t('repeated.none', { n: estado.revisados.length })}</p>)}

      {window.api?.repararObra && estado?.repetidos?.some(r => r.identicos) && (
        <div className="mt-3" data-reparar-obra>
          {reparacion === null && (
            <button onClick={() => setReparacion('confirmando')}
                    className="text-xs px-3 py-1 rounded-full border border-amber-300/30 text-amber-300/90 hover:text-amber-200">
              {t('repeated.repair')}
            </button>
          )}
          {reparacion === 'confirmando' && (
            <div className="text-xs text-gray-300 space-y-2">
              <p>{t('repeated.repair_confirm')}</p>
              <div className="flex gap-2">
                <button onClick={reparar} className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-200 border border-amber-300/30">{t('repeated.repair_yes')}</button>
                <button onClick={() => setReparacion(null)} className="px-3 py-1 rounded-full border border-white/15 text-gray-400">{t('repeated.repair_no')}</button>
              </div>
            </div>
          )}
          {reparacion === 'reparando' && <p className="text-xs text-gray-400">{t('repeated.repairing')}</p>}
          {reparacion?.texto && <p className={`text-xs ${reparacion.error ? 'text-red-400' : 'text-gray-300'}`} role={reparacion.error ? 'alert' : undefined}>{reparacion.texto}</p>}
        </div>
      )}
    </div>
  );
}
