import { equipoActual } from '../../equipo.js';

const CLAVE_PREFIJO = 'mylaiberry-conflicto-idioma-';

export function textosConflicto(equipo = equipoActual()) {
  return {
    aviso: `El idioma elegido en este móvil es distinto del elegido en el ${equipo.nombre}.`,
    conservarMovil: 'Conservar el de este móvil',
    usarPC: `Usar el del ${equipo.nombre}`
  };
}

export async function guardarConflictoLocal(almacen, obraId, conflicto) {
  if (!almacen || !obraId) return;
  const clave = CLAVE_PREFIJO + String(obraId);
  await almacen.guardar(clave, conflicto);
}

export async function leerConflictoLocal(almacen, obraId) {
  if (!almacen || !obraId) return null;
  const clave = CLAVE_PREFIJO + String(obraId);
  return almacen.leer(clave);
}

export async function resolverUsandoPC(almacen, obraId) {
  if (!almacen || !obraId) return;
  const clave = CLAVE_PREFIJO + String(obraId);
  if (typeof almacen.borrar === 'function') {
    await almacen.borrar(clave);
  } else {
    await almacen.guardar(clave, null);
  }
}

export async function resolverConservandoMovil(almacen, obraId, api, aparatoId = 'movil') {
  const conflicto = await leerConflictoLocal(almacen, obraId);
  if (!conflicto || !api?.aplicarEleccionIdioma) return null;
  const operacion = {
    obraId: String(obraId),
    idioma: conflicto.local?.idioma,
    revisionBase: conflicto.pc?.revision ?? 0,
    aparatoId,
    operacionId: 'res-' + (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now()))
  };
  const res = await api.aplicarEleccionIdioma(operacion);
  if (res?.status === 'ok') {
    await resolverUsandoPC(almacen, obraId);
  }
  return res;
}
