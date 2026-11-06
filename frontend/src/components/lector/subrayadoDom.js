import { hojas } from './anclaDom';
import { crearAnclaRango, resolverAnclaRango } from './anclaRango.js';

export const COLORES = ['amarillo', 'verde', 'azul', 'rosa', 'naranja'];
const LIMITE_SELECCION = 20000;

function extremosEnHoja(rango, mapa) {
  let primero = -1, ultimo = -1;
  for (let i = 0; i < mapa.puntos.length; i++) {
    const p = mapa.puntos[i];
    if (rango.comparePoint(p.nodo, p.inicio) < 0 || rango.comparePoint(p.nodoFin, p.fin) > 0) continue;
    if (primero < 0) primero = i;
    ultimo = i;
  }
  return { primero, ultimo };
}

export async function anclaDeSeleccion(caja, meta, seleccion = globalThis.getSelection?.()) {
  if (!seleccion || seleccion.isCollapsed || !seleccion.rangeCount) return null;
  const rango = seleccion.getRangeAt(0);
  const contenido = caja.querySelector('.reader-content');
  if (!contenido || !contenido.contains(rango.commonAncestorContainer)) return null;
  if (seleccion.toString().length > LIMITE_SELECCION) return null;
  const lista = hojas(caja);
  let inicio = null, fin = null;
  lista.forEach((h, bloque) => {
    if (!rango.intersectsNode(h.nodo)) return;
    let { primero, ultimo } = extremosEnHoja(rango, h.mapa);
    if (primero < 0) return;

    while (primero < ultimo && h.mapa.texto[primero] === ' ') primero++;
    while (ultimo > primero && h.mapa.texto[ultimo] === ' ') ultimo--;
    if (!inicio) inicio = { bloque, caracter: primero };
    fin = { bloque, caracter: ultimo + 1 };
  });
  if (!inicio) return null;
  return crearAnclaRango(lista.map(h => h.mapa.texto), inicio, fin, meta);
}

export function ubicarAnotaciones(caja, anotaciones, variante, capitulo) {
  const lista = hojas(caja);
  const textos = lista.map(h => h.mapa.texto);
  return anotaciones.map(anotacion => {
    const r = resolverAnclaRango(anotacion.ancla, textos, variante, capitulo);
    if (r.modo === 'sinUbicar') return { anotacion, modo: r.modo, rango: null };
    const desde = lista[r.inicio.bloque].mapa.puntos[r.inicio.caracter];
    const hasta = lista[r.fin.bloque].mapa.puntos[r.fin.caracter - 1];
    if (!desde || !hasta) return { anotacion, modo: 'sinUbicar', rango: null };
    const rango = document.createRange();
    rango.setStart(desde.nodo, desde.inicio);
    rango.setEnd(hasta.nodoFin, hasta.fin);
    return { anotacion, modo: r.modo, rango };
  });
}

export function pintarSubrayados(ubicadas) {
  const registro = globalThis.CSS?.highlights;
  if (!registro || typeof Highlight === 'undefined') return;
  for (const color of COLORES) {
    const rangos = ubicadas.filter(u => u.rango && u.anotacion.color === color).map(u => u.rango);
    if (rangos.length) registro.set(`sub-${color}`, new Highlight(...rangos));
    else registro.delete(`sub-${color}`);
  }
}

export function limpiarSubrayados() {
  for (const color of COLORES) globalThis.CSS?.highlights?.delete(`sub-${color}`);
}

export function anotacionEn(ubicadas, x, y) {
  const punto = document.caretPositionFromPoint?.(x, y)
    || (() => { const r = document.caretRangeFromPoint?.(x, y); return r && { offsetNode: r.startContainer, offset: r.startOffset }; })();
  if (!punto) return null;
  const hallada = [...ubicadas].reverse().find(u => u.rango && u.rango.isPointInRange(punto.offsetNode, punto.offset));
  return hallada || null;
}
