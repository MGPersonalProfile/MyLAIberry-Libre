import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LANG, LANGS, lookupT } from './dicts';

const Ctx = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(DEFAULT_LANG);

  const haySettings = typeof window !== 'undefined' && !!window.api;
  const [resuelto, setResuelto] = useState(!haySettings);

  useEffect(() => {
    if (!haySettings) return;
    let cancelado = false;

    Promise.race([
      Promise.resolve().then(() => window.api.getSettings()),
      new Promise(resolve => setTimeout(() => resolve(null), 1500))
    ])
      .then(settings => {
        if (!cancelado && settings && LANGS.includes(settings.lang)) setLangState(settings.lang);
      })
      .catch(() => {  })
      .finally(() => { if (!cancelado) setResuelto(true); });
    return () => { cancelado = true; };
  }, [haySettings]);

  useEffect(() => window.api?.alCambiarAjustes?.((cambio) => {
    if (LANGS.includes(cambio?.lang)) setLangState(cambio.lang);
  }), []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((nuevo) => {
    if (!LANGS.includes(nuevo)) return;
    setLangState(nuevo);
    if (typeof window !== 'undefined' && window.api) window.api.updateSettings({ lang: nuevo });
  }, []);

  const value = useMemo(() => ({
    lang,
    setLang,
    t: (key, params) => lookupT(key, lang, params)
  }), [lang, setLang]);

  if (!resuelto) return null;

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n fuera de I18nProvider');
  return ctx;
}
