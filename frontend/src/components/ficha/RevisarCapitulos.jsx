import { useState } from 'react';
import { Copy } from 'lucide-react';
import { PrimaryButton, SecondaryButton } from '../ui/Buttons';
import { Notice } from '../ui/Feedback';
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
      <h3 className="text-caption font-semibold text-text-secondary uppercase tracking-wider mb-2">
        {t('repeated.title')}
      </h3>
      <SecondaryButton icon={Copy} onClick={revisar} disabled={estado === 'revisando'}>
        {estado === 'revisando' ? t('repeated.checking') : t('repeated.check')}
      </SecondaryButton>
      {estado?.error && <Notice variant="error" compact className="mt-2">{estado.error}</Notice>}
      {estado?.repetidos && (hallazgos.length
        ? <ul className="mt-2 space-y-1 text-small text-warning">{hallazgos.map(h => <li key={h}>{h}</li>)}</ul>
        : <p className="mt-2 text-footnote text-text-secondary">{t('repeated.none', { n: estado.revisados.length })}</p>)}
      {window.api?.repararObra && estado?.repetidos?.some(r => r.identicos) && (
        <div className="mt-3" data-reparar-obra>
          {reparacion === null && (
            <SecondaryButton onClick={() => setReparacion('confirmando')}>
              {t('repeated.repair')}
            </SecondaryButton>
          )}
          {reparacion === 'confirmando' && (
            <div className="text-footnote text-text-primary space-y-2">
              <p>{t('repeated.repair_confirm')}</p>
              <div className="flex gap-2">
                <PrimaryButton onClick={reparar}>{t('repeated.repair_yes')}</PrimaryButton>
                <SecondaryButton onClick={() => setReparacion(null)}>{t('repeated.repair_no')}</SecondaryButton>
              </div>
            </div>
          )}
          {reparacion === 'reparando' && <p className="text-footnote text-text-secondary">{t('repeated.repairing')}</p>}
          {reparacion?.texto && (
            <Notice variant={reparacion.error ? 'error' : 'info'} compact className="mt-2">
              {reparacion.texto}
            </Notice>
          )}
        </div>
      )}
    </div>
  );
}
