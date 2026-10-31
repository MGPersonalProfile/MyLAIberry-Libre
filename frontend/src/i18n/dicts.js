import { BIBLIOTECA } from './textos/biblioteca';
import { LECTOR } from './textos/lector';
import { IMPORTAR } from './textos/importar';
import { ASISTENTE } from './textos/asistente';
import { AJUSTES } from './textos/ajustes';

export const LANGS = ['es', 'en'];
export const DEFAULT_LANG = 'es';

export const UI = { ...BIBLIOTECA, ...LECTOR, ...IMPORTAR, ...ASISTENTE, ...AJUSTES };

function interpolate(text, params) {
  return text.replace(/\{(\w+):([^|}]*)\|([^}]*)\}/g, (match, name, uno, varios) =>
    Object.prototype.hasOwnProperty.call(params, name) ? (Number(params[name]) === 1 ? uno : varios) : match
  ).replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  );
}

export function lookupT(key, lang, params) {
  const entry = UI[key];
  if (!entry) {
    if (import.meta.env.DEV) console.warn(`[i18n] clave desconocida: ${key}`);
    return key;
  }
  const raw = entry[lang] || entry[DEFAULT_LANG] || key;
  return params ? interpolate(raw, params) : raw;
}
