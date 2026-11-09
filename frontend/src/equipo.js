import { EQUIPO } from './i18n/textos/equipo.js';

const CLAVE = 'mylaiberry.equipo';
const NEUTRO = { tipo: 'desconocido', nombre: 'equipo', name: 'host' };
let recordado = null;

const valido = (e) => !!e && typeof e.tipo === 'string' && typeof e.nombre === 'string' && typeof e.name === 'string';

export function fijarEquipo(e) {
  if (!valido(e)) return;
  recordado = e;
  try { globalThis.localStorage?.setItem(CLAVE, JSON.stringify(e)); } catch {  }
}

export function equipoActual() {
  if (recordado) return recordado;
  try {
    const guardado = JSON.parse(globalThis.localStorage?.getItem(CLAVE) || 'null');
    if (valido(guardado)) return guardado;
  } catch {  }
  return NEUTRO;
}

export const idiomaActual = () => (globalThis.document?.documentElement?.lang === 'en' ? 'en' : 'es');

export function textoDelEquipo(clave, params = {}, lang = idiomaActual()) {
  const e = equipoActual();
  const datos = { equipo: lang === 'en' ? e.name : e.nombre, ...params };
  const crudo = EQUIPO[clave]?.[lang] || EQUIPO[clave]?.es || clave;
  return crudo.replace(/\{(\w+)\}/g, (_, k) => (k in datos ? String(datos[k]) : `{${k}}`));
}

export const movilSinInternet = () => globalThis.navigator?.onLine === false;

export function textoSinConexion({ lang = idiomaActual(), sufijo = '' } = {}) {
  const motivo = movilSinInternet()
    ? textoDelEquipo('offline.sin_red', {}, lang)
    : textoDelEquipo('offline.sin_servidor', {}, lang) + (equipoActual().tipo === 'pc' ? textoDelEquipo('offline.pc_encendido', {}, lang) : '');
  return motivo + (sufijo ? textoDelEquipo(sufijo, {}, lang) : '');
}
