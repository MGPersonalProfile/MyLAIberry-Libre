import { useEffect, useState } from 'react';
import { Link2, Copy, Check } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { Seccion } from './piezas';
import { SecondaryButton } from '../ui/Buttons';
import { enElMovil } from '../../vistaGuardada';

function marcadorDelMovil() {
  const app = `${window.location.origin}${window.__MYLAIBERRY_BASE__ || ''}/app/`;
  return `javascript:(function(){location.href='${app}?compartido_url='+encodeURIComponent(location.href)})()`;
}

export default function SeccionMarcador() {
  const { t } = useI18n();
  const pc = window.mylaiberryPC;
  const movil = enElMovil() && !pc;
  const [marcador, setMarcador] = useState(() => (movil ? marcadorDelMovil() : pc?.marcador || ''));
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (movil || pc) return;
    window.api?.marcadorDeNavegador?.().then(m => { if (m) setMarcador(m); }).catch(() => {});
  }, [movil, pc]);

  const copiar = async () => {
    if (!marcador) return;
    try {
      await navigator.clipboard.writeText(marcador);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {  }
  };

  return (
    <Seccion icono={Link2} titulo={t('settings.bookmarklet')} descripcion={t(movil ? 'settings.bookmarklet_desc_mobile' : 'settings.bookmarklet_desc')}>
      <div className="max-w-2xl">
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={marcador || '#'}
            draggable
            onClick={(e) => e.preventDefault()}
            title={t('settings.bookmarklet_drag')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-surface-secondary border border-border text-callout font-semibold text-text-primary cursor-grab active:cursor-grabbing hover:bg-surface-tertiary transition-colors select-none"
          >
            <Link2 className="w-4 h-4" />
            {t('settings.bookmarklet_name')}
          </a>
          <SecondaryButton
            onClick={copiar}
            disabled={!marcador}
            icon={copiado ? Check : Copy}
          >
            {copiado ? t('settings.bookmarklet_copied') : t('settings.bookmarklet_copy')}
          </SecondaryButton>
        </div>
        {movil ? (
          <p className="text-footnote text-text-secondary mt-3 max-w-xl">{t('settings.bookmarklet_how_mobile')}</p>
        ) : (
          <>
            <p className="text-footnote text-text-secondary mt-3 max-w-xl">{t('settings.bookmarklet_how')}</p>
            <p className="text-footnote text-text-tertiary mt-2 max-w-xl">{t('settings.bookmarklet_firefox')}</p>
          </>
        )}
      </div>
    </Seccion>
  );
}
