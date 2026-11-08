import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { DestructiveButton, SecondaryButton } from '../ui/Buttons';
import { Notice } from '../ui/Feedback';

const base = () => window.__MYLAIBERRY_BASE__ || window.location.pathname.split('/app/')[0];
async function pedir(accion, dato) {
  const r = await fetch(`${base()}/push/${accion}`, dato ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dato)
  } : { cache: 'no-store' });
  const cuerpo = await r.json();
  if (!r.ok) throw new Error(cuerpo.error || 'Push no disponible');
  return cuerpo;
}
function bytesBase64Url(texto) {
  const base64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(binario, c => c.charCodeAt(0));
}
const registroListo = () => Promise.race([
  navigator.serviceWorker.ready,
  new Promise((_, mal) => setTimeout(() => mal(new Error('push-timeout')), 10000))
]);
const textoError = (error, t) => error.message === 'push-timeout' ? t('settings.push_timeout') : error.message;

export default function AvisosPush() {
  const { t } = useI18n();
  const [estado, setEstado] = useState('cargando');
  const [error, setError] = useState('');
  const [publicKey, setPublicKey] = useState(null);
  const disponible = typeof window !== 'undefined' && window.isSecureContext
    && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const estadoVisible = disponible ? estado : 'incompatible';

  useEffect(() => {
    if (!disponible) return;
    let vivo = true;
    (async () => {

      const [registro, { publicKey: clave }] = await Promise.all([registroListo(), pedir('publica')]);
      if (vivo) setPublicKey(clave);
      const sub = await registro.pushManager.getSubscription();
      const activa = sub && (await pedir('estado', { endpoint: sub.endpoint })).activa;
      if (vivo) setEstado(activa ? 'activa' : 'inactiva');
    })().catch(e => { if (vivo) { setError(textoError(e, t)); setEstado('inactiva'); } });
    return () => { vivo = false; };
  }, [disponible, t]);

  const activar = async () => {
    setEstado('ocupado'); setError('');
    try {
      if (!publicKey) throw new Error(t('settings.push_unavailable'));
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') { setEstado('denegado'); return; }
      const registro = await registroListo();
      let sub = await registro.pushManager.getSubscription();
      if (sub) { await sub.unsubscribe(); sub = null; }
      sub ||= await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytesBase64Url(publicKey) });
      try { await pedir('suscribir', sub.toJSON()); }
      catch (e) { await sub.unsubscribe(); throw e; }
      setEstado('activa');
    } catch (e) { setError(textoError(e, t)); setEstado('inactiva'); }
  };

  const desactivar = async () => {
    setEstado('ocupado'); setError('');
    try {
      const registro = await registroListo();
      const sub = await registro.pushManager.getSubscription();
      if (sub) { await pedir('cancelar', { endpoint: sub.endpoint }); await sub.unsubscribe(); }
      setEstado('inactiva');
    } catch (e) { setError(textoError(e, t)); setEstado('activa'); }
  };

  return <div className="space-y-2 border-t border-border pt-3">
    <p className="text-footnote text-text-secondary">{t('settings.push_desc')}</p>
    {estadoVisible === 'incompatible' && <Notice compact>{t('settings.push_https')}</Notice>}
    {estadoVisible === 'denegado' && <Notice tone="warning" compact>{t('settings.push_denied')}</Notice>}
    {estadoVisible === 'activa' && <Notice tone="success" compact>{t('settings.push_active')}</Notice>}
    {error && <Notice tone="error" compact>{error}</Notice>}
    {estadoVisible === 'activa' && <DestructiveButton size="sm" onClick={desactivar}>{t('settings.push_disable')}</DestructiveButton>}
    {['inactiva', 'denegado'].includes(estadoVisible) && <SecondaryButton size="sm" onClick={activar} disabled={!publicKey}>{t('settings.push_enable')}</SecondaryButton>}
  </div>;
}
