import { useState } from 'react';
import { Layers } from 'lucide-react';
import { PrimaryButton, SecondaryButton } from '../ui/Buttons';
import { Notice } from '../ui/Feedback';
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
      <h3 className="text-caption font-semibold text-text-secondary uppercase tracking-wider mb-2">
        {t('copies.title')}
      </h3>
      <SecondaryButton icon={Layers} onClick={buscar} disabled={copias === 'buscando'}>
        {copias === 'buscando' ? t('copies.checking') : t('copies.check')}
      </SecondaryButton>
      {copias?.error && <Notice variant="error" compact className="mt-2">{copias.error}</Notice>}
      {Array.isArray(copias) && !copias.length && (
        <p className="mt-2 text-footnote text-text-secondary">{t('copies.none')}</p>
      )}
      {Array.isArray(copias) && copias.length > 0 && (
        <ul className="mt-3 space-y-3 text-small">
          {copias.map(({ otra, motivo }) => (
            <li key={otra.id} className="p-3 rounded-lg bg-surface-secondary border border-border/70 text-text-primary space-y-2">
              <p>
                {t('copies.one', {
                  titulo: otra.titulo,
                  sitio: otra.sitio || '—',
                  capitulos: otra.capitulos ?? '?',
                  motivo: t(motivo === 'direccion' ? 'copies.why_url' : 'copies.why_title')
                })}
              </p>
              {fundir?.id !== otra.id && (
                <SecondaryButton onClick={() => setFundir({ id: otra.id, fase: 'confirmando' })}>
                  {t('copies.merge')}
                </SecondaryButton>
              )}
              {fundir?.id === otra.id && fundir.fase === 'confirmando' && (
                <div className="text-footnote text-text-secondary space-y-2">
                  <p>{t('copies.merge_confirm')}</p>
                  <div className="flex gap-2">
                    <PrimaryButton onClick={() => fundirla(otra.id)}>{t('copies.merge_yes')}</PrimaryButton>
                    <SecondaryButton onClick={() => setFundir(null)}>{t('copies.cancel')}</SecondaryButton>
                  </div>
                </div>
              )}
              {fundir?.id === otra.id && fundir.fase === 'fundiendo' && (
                <p className="text-footnote text-text-secondary">{t('copies.merging')}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {fundir?.texto && (
        <Notice variant={fundir.error ? 'error' : 'success'} compact className="mt-2">
          {fundir.texto}
        </Notice>
      )}
    </div>
  );
}
