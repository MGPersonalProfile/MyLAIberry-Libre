import { useEffect, useState } from 'react';
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
      <span className="block text-sm text-white font-medium">{t('settings.assistant_key')}</span>
      <span className="block text-xs text-gray-500 mt-0.5 mb-2">{t('settings.assistant_key_desc')}</span>
      <div className="flex gap-2 flex-wrap">
        <input
          type="password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          onBlur={guardar}
          placeholder={estado.tiene ? '••••••••••••' : 'sk-…'}
          spellCheck={false}
          aria-label={t('settings.assistant_key')}
          className="flex-1 min-w-[16rem] bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30 font-mono"
        />
        <button
          onClick={probar}
          disabled={probando || (!estado.tiene && !nueva.trim())}
          className="px-4 py-2 rounded-lg bg-white text-black font-semibold text-sm hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {probando ? t('settings.ai_testing') : t('settings.ai_test')}
        </button>
      </div>
      <button
        onClick={() => window.api?.abrirEnNavegador?.(DONDE_SACARLA)}
        className="text-xs text-gray-400 hover:text-white underline underline-offset-2 mt-2 inline-block"
      >
        {t('settings.ai_get_key')} ↗
      </button>

      {!estado.tiene && <p className="text-xs text-amber-400/90 mt-2">{t('settings.assistant_key_missing')}</p>}
      {estado.ilegible && <p className="text-xs text-amber-400/90 mt-2">{t(estado.tiene ? 'settings.ai_key_other_device_file' : 'settings.ai_key_other_device')}</p>}
      {estado.tiene && estado.origen === 'fichero' && !estado.ilegible && <p className="text-xs text-gray-500 mt-2">{t('settings.ai_key_from_file')}</p>}
      {estado.tiene && estado.origen === 'ajustes' && (
        <p className="text-xs text-gray-500 mt-2">
          {t('settings.ai_key_saved')}{' '}
          <span className="text-gray-600">{t('settings.ai_key_replace')}</span>
          {' · '}
          <button onClick={borrar} className="text-gray-400 hover:text-red-400 underline underline-offset-2">
            {t('settings.ai_key_clear')}
          </button>
        </p>
      )}
      {prueba && (
        <p className={`text-xs mt-2 ${prueba.ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {prueba.ok ? t('settings.assistant_key_ok') : t('settings.ai_test_fail') + (prueba.message || '')}
        </p>
      )}
    </div>
  );
}
