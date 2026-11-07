import { crearAnclaTextual, resolverAnclaTextual } from './components/lector/anclaTexto.js';

export async function anclaDeAudio({ lector, textos, meta }) {
  const frase = lector.frases[lector.frase];
  const bloque = frase ? frase.parrafo : lector.indice;
  const ancla = await crearAnclaTextual(textos, bloque, frase ? frase.desde : 0, meta);
  if (!ancla) return null;
  return { ancla, t: lector.audio?.currentTime ?? 0, velocidad: lector.velocidad || 1 };
}

export async function retomarAudio(guardada, { textos, variante, lector }) {
  if (!guardada?.ancla) return null;
  const r = await resolverAnclaTextual(guardada.ancla, textos, variante);
  if (!r) return null;
  if (r.modo === 'aproximado') {
    const inicio = lector.marcas[r.bloque];
    return { t: inicio ?? 0, exacta: false, modo: 'aproximado', bloque: r.bloque };
  }
  const delTexto = lector.frases.find(f => f.parrafo === r.bloque && r.caracter >= f.desde && r.caracter < f.hasta);
  const encaja = !delTexto || (guardada.t >= delTexto.inicio - 0.05 && guardada.t < delTexto.fin);
  const t = encaja ? guardada.t : delTexto.inicio;
  return { t, exacta: encaja && r.modo === 'texto', modo: r.modo, bloque: r.bloque };
}

const clave = ({ obra, capitulo, variante }) => `voz-pos:${obra}:${capitulo}:${variante || 'original'}`;

export function guardarPosicion(almacen, meta, posicion) {
  if (!posicion) return;
  try { almacen.setItem(clave(meta), JSON.stringify(posicion)); } catch {  }
}

export function leerPosicion(almacen, meta) {
  try {
    const p = JSON.parse(almacen.getItem(clave(meta)));
    return p && p.ancla && Number.isFinite(p.t) ? p : null;
  } catch { return null; }
}
