import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { IconButton, SecondaryButton } from '../ui/Buttons';
import { Notice } from '../ui/Feedback';
import { normalizarToque } from './retoRemotoGeometria';
import useRetoRemoto from '../../hooks/useRetoRemoto';
import { useI18n } from '../../i18n/I18nContext';

const dosCifras = n => String(n).padStart(2, '0');
const tiempo = ms => `${Math.floor(ms / 60000)}:${dosCifras(Math.floor(ms / 1000) % 60)}`;

export default function RetoRemoto({ reto, terminado = false, alCerrar }) {
  const { t } = useI18n();
  const { estado, imagen, imagenVieja, puedeTocar, tocar, motivo, error, restanteMs } = useRetoRemoto(reto);
  const caja = useRef(null);
  const [marca, setMarca] = useState(null);

  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = antes; };
  }, []);

  const alTocar = (e) => {
    if (!puedeTocar || !imagen?.viewport) return;
    e.preventDefault();
    const r = caja.current.getBoundingClientRect();
    const punto = normalizarToque({ x: e.clientX, y: e.clientY }, r, imagen.viewport);
    if (!punto) return;
    setMarca({ x: e.clientX - r.left, y: e.clientY - r.top, en: Date.now() });
    setTimeout(() => setMarca(m => (m && Date.now() - m.en >= 600 ? null : m)), 650);
    tocar(punto);
  };

  const cerrada = estado === 'cerrada' || terminado;
  return (
    <div className="dark fixed inset-0 z-[230] flex flex-col bg-background text-text-primary font-sans" role="dialog" aria-label={t('assistant.reto.remote_title', { site: reto.sitio })}
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <header className="flex items-center justify-between gap-3 px-4 py-2 border-b border-separator">
        <div className="min-w-0">
          <p className="text-headline truncate">{t('assistant.reto.remote_title', { site: reto.sitio })}</p>
          <p className="text-caption text-text-secondary" role="status">
            {estado === 'abriendo' ? t('assistant.reto.remote_connecting') : (imagenVieja ? t('assistant.reto.remote_stale') : t('assistant.reto.remote_connected'))}
            {restanteMs != null && !cerrada ? ` · ${t('assistant.reto.remote_left', { tiempo: tiempo(restanteMs) })}` : ''}
          </p>
        </div>
        <IconButton icon={X} onClick={alCerrar} label={t('assistant.reto.remote_close')} />
      </header>
      <div className="flex-1 min-h-0 p-2">
        {terminado && <Notice tone="success" role="status">{t('assistant.reto.remote_done')}</Notice>}
        {!terminado && estado === 'cerrada' && <Notice tone="warning">{t('assistant.reto.remote_ended', { motivo: t(`assistant.reto.remote_why.${motivo}`) === `assistant.reto.remote_why.${motivo}` ? t('assistant.reto.remote_why.otro') : t(`assistant.reto.remote_why.${motivo}`) })}</Notice>}
        {!cerrada && (
          <div ref={caja} className="relative h-full w-full touch-none select-none overscroll-contain" onPointerUp={alTocar}>
            {imagen && <img src={imagen.url} alt={t('assistant.reto.remote_image')} draggable={false}
              className={`h-full w-full object-contain ${puedeTocar ? '' : 'opacity-50'}`} />}
            {marca && <span aria-hidden className="pointer-events-none absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent" style={{ left: marca.x, top: marca.y }} />}
          </div>
        )}
      </div>
      <footer className="px-4 py-2 border-t border-separator space-y-2">
        {error && <Notice tone="error" compact>{t('assistant.reto.remote_error', { error })}</Notice>}
        {!cerrada && <p className="text-footnote text-text-secondary">{t('assistant.reto.remote_hint')}</p>}
        {cerrada && <SecondaryButton onClick={alCerrar}>{t('assistant.reto.remote_close')}</SecondaryButton>}
      </footer>
    </div>
  );
}
