import { useEffect, useState } from 'react';
import { PrimaryButton } from '../ui/Buttons';
import { Notice } from '../ui/Feedback';
import { useI18n } from '../../i18n/I18nContext';

const DONDE_SACARLA = 'https://platform.deepseek.com/api_keys';

export default function ClaveDeepSeek() {
  const { t } = useI18n();
  const [estado, setEstado] = useState(null);
  const [nueva, setNueva] = useState('');
  const [probando, setProbando] = useState(false);
  const [prueba, setPrueba] = useState(null);

  const releer = async () => {
    const s = await window.api?.getSettings?.();
    if (s) setEstado({ tiene: !!s.tieneClaveDeepSeek, origen: s.claveDeepSeekOrigen, ilegible: !!s.claveDeepSeekIlegible });
  };
  useEffect(() => {
    let vivo = true;
    window.api?.getSettings?.().then(s => {
      if (vivo && s) setEstado({ tiene: !!s.tieneClaveDeepSeek, origen: s.claveDeepSeekOrigen, ilegible: !!s.claveDeepSeekIlegible });
    });
    return () => { vivo = false; };
  }, []);

  const guardar = async () => {
    const clave = nueva.trim();
    if (!clave) return;
    setPrueba(null);
    await window.api?.updateSettings?.({ claveDeepSeek: clave });
    setNueva('');
    await releer();
  };
  const borrar = async () => {
    setPrueba(null);
    await window.api?.updateSettings?.({ claveDeepSeek: '' });
    await releer();
  };
  const probar = async () => {
    setProbando(true);
    setPrueba(null);
    try {
      if (nueva.trim()) await guardar();
      setPrueba(await window.api?.probarClaveDeepSeek?.());
    } catch (err) {
      setPrueba({ ok: false, message: err?.message });
    } finally {
      setProbando(false);
    }
  };

  if (!estado) return null;
  return (
    <div className="max-w-xl" data-clave-deepseek>
      <span className="block text-callout text-text-primary font-medium">{t('settings.assistant_key')}</span>
      <span className="block text-footnote text-text-secondary mt-0.5 mb-2">{t('settings.assistant_key_desc')}</span>
      <div className="flex gap-2 flex-wrap">
        <input
          type="password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          onBlur={guardar}
          placeholder={estado.tiene ? '••••••••••••' : 'sk-…'}
          spellCheck={false}
          aria-label={t('settings.assistant_key')}
          className="flex-1 min-w-[16rem] bg-surface-secondary border border-border rounded-md px-4 py-2 text-callout text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent font-mono"
        />
        <PrimaryButton
          onClick={probar}
          disabled={probando || (!estado.tiene && !nueva.trim())}
        >
          {probando ? t('settings.ai_testing') : t('settings.ai_test')}
        </PrimaryButton>
      </div>
      <button
        onClick={() => window.api?.abrirEnNavegador?.(DONDE_SACARLA)}
        className="text-footnote text-text-secondary hover:text-text-primary underline underline-offset-2 mt-2 inline-block"
      >
        {t('settings.ai_get_key')} ↗
      </button>

      {!estado.tiene && <Notice tone="warning" className="mt-2">{t('settings.assistant_key_missing')}</Notice>}
      {estado.ilegible && <Notice tone="warning" className="mt-2">{t(estado.tiene ? 'settings.ai_key_other_device_file' : 'settings.ai_key_other_device')}</Notice>}
      {estado.tiene && estado.origen === 'fichero' && !estado.ilegible && <p className="text-footnote text-text-secondary mt-2">{t('settings.ai_key_from_file')}</p>}
      {estado.tiene && estado.origen === 'ajustes' && (
        <p className="text-footnote text-text-secondary mt-2">
          {t('settings.ai_key_saved')}{' '}
          <span className="text-text-tertiary">{t('settings.ai_key_replace')}</span>
          {' · '}
          <button onClick={borrar} className="text-text-secondary hover:text-danger underline underline-offset-2">
            {t('settings.ai_key_clear')}
          </button>
        </p>
      )}
      {prueba && (
        <Notice tone={prueba.ok ? 'success' : 'danger'} className="mt-2">
          {prueba.ok ? t('settings.assistant_key_ok') : t('settings.ai_test_fail') + (prueba.message || '')}
        </Notice>
      )}
    </div>
  );
}
