import { anclaDe, posicionDe, alturaGuardada } from './ancla';
import { crearAnclaTextual, resolverAnclaTextual } from './anclaTexto';

const SELECTOR = 'p,li,blockquote,h1,h2,h3,h4,h5,h6,pre,div';
const visible = n => !n.closest('[hidden]') && getComputedStyle(n).display !== 'none';
function textoPintado(n, raiz) {
  for (let p = n.parentElement; p && p !== raiz.parentElement; p = p.parentElement) {
    if (p.hidden || getComputedStyle(p).display === 'none' || getComputedStyle(p).visibility === 'hidden') return false;
  }
  return true;
}

export function hojas(caja) {
  const contenido = caja?.querySelector('.reader-content');
  if (!contenido) return [];
  return [...contenido.querySelectorAll(SELECTOR)]
    .filter(n => visible(n) && ![...n.querySelectorAll(SELECTOR)].some(visible))
    .map(n => ({ nodo: n, mapa: mapaTexto(n) }))
    .filter(h => h.mapa.texto);
}

function mapaTexto(raiz) {
  const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  const puntos = [], origen = []; let texto = '', crudo = '', nodo;
  const segmentador = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  while ((nodo = walker.nextNode())) {
    if (!textoPintado(nodo, raiz)) continue;
    crudo += nodo.data;
    for (let i = 0; i < nodo.length; i++) origen.push({ nodo, offset: i });
  }
  for (const parte of segmentador.segment(crudo)) {
    const grafema = parte.segment.normalize('NFC');
    const valor = /^\s+$/u.test(grafema) ? ' ' : grafema;
    if (valor === ' ' && (!texto || texto.endsWith(' '))) continue;
    const inicio = origen[parte.index], fin = origen[parte.index + parte.segment.length - 1];
    for (let i = 0; i < valor.length; i++) puntos.push({ nodo: inicio.nodo, inicio: inicio.offset,
      nodoFin: fin.nodo, fin: fin.offset + 1 });
    texto += valor;
  }
  if (texto.endsWith(' ')) { texto = texto.slice(0, -1); puntos.pop(); }
  return { texto, puntos };
}

function rectangulo(punto) {
  const range = document.createRange();
  range.setStart(punto.nodo, punto.inicio); range.setEnd(punto.nodoFin, punto.fin);
  return range.getBoundingClientRect();
}

function caracterVisible(mapa, borde) {

  for (let i = 0; i < mapa.puntos.length; i++) {
    const r = rectangulo(mapa.puntos[i]);
    if (r.height && r.bottom > borde + 1) return i;
  }
  return mapa.puntos.length;
}

export async function posicionDeV2(caja, meta) {
  const lista = hojas(caja);
  if (!lista.length) return posicionDe(caja);
  const origen = caja.getBoundingClientRect().top - caja.scrollTop;
  const medidas = lista.map(h => ({ top: h.nodo.getBoundingClientRect().top - origen,
    alto: h.nodo.getBoundingClientRect().height }));
  const ancla = anclaDe(caja.scrollTop, medidas);
  const base = { px: caja.scrollTop, ancla };
  if (!ancla || !lista[ancla.indice]?.mapa.puntos.length) return base;
  const caracter = caracterVisible(lista[ancla.indice].mapa, caja.getBoundingClientRect().top);
  const textual = await crearAnclaTextual(lista.map(h => h.mapa.texto), ancla.indice, caracter, meta);
  return textual ? { ...base, ...textual, fraccion: ancla.fraccion } : base;
}

export async function resolverEnDom(guardada, caja, variante) {
  const maximo = Math.max(0, caja.scrollHeight - caja.clientHeight);
  const acotar = n => Math.min(maximo, Math.max(0, Math.round(n || 0)));
  if (typeof guardada === 'number') return { top: acotar(guardada), modo: 'legado' };
  const lista = hojas(caja);
  if (guardada?.v === 2 && lista.length) {
    const hallada = await resolverAnclaTextual(guardada, lista.map(h => h.mapa.texto), variante);
    if (hallada) {
      const h = lista[hallada.bloque];
      if (hallada.caracter !== null && h.mapa.puntos.length) {
        const punto = h.mapa.puntos[Math.min(h.mapa.puntos.length - 1, hallada.caracter)];
        const top = caja.scrollTop + rectangulo(punto).top - caja.getBoundingClientRect().top;
        return { top: acotar(top), modo: hallada.modo };
      }
      const r = h.nodo.getBoundingClientRect();
      return { top: acotar(caja.scrollTop + r.top - caja.getBoundingClientRect().top
        + (guardada.fraccion || 0) * r.height), modo: 'aproximado' };
    }
  }
  return { top: acotar(alturaGuardada(guardada, caja)), modo: 'legado' };
}
