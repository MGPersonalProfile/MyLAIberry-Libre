const { lecturaDe, parejasDe, traeCasilla, sinAcentos } = require('./asistente-vetos-parejas');
const { claveDeObra } = require('./misma-obra');

const CATEGORIAS = [
  { categoria: 'M/M', patron: /\bm\s*\/\s*m\b|(?<![a-z])slash\b|\byaoi\b/i },
  { categoria: 'F/F', patron: /\bf\s*\/\s*f\b|\bfemslash\b|\byuri\b/i }
];

const DE_FUERA = /^(buscar_obras|buscar_fanfics_a_fondo|investigar_fanfics_web|seguir_pistas_web|abrir_ficha_web)$/;

function vetosDe(preferences = []) {
  const confirmadas = (preferences || []).filter(p => p?.status === 'confirmed');
  const dicen = (kind, patron) => confirmadas.filter(p => p.kind === kind && patron.test(String(p.text || '')));
  const exentas = new Set();
  const ambitos = [];
  const categorias = CATEGORIAS.filter(c => {
    if (!dicen('dislike', c.patron).length) return false;
    const excepciones = confirmadas.filter(p => p.kind === 'exception' &&
      (c.patron.test(String(p.text || '')) || parejasDe(p.text).some(par => par.cat === c.categoria)));
    excepciones.forEach(e => parejasDe(e.text).filter(p => p.cat === c.categoria).forEach(p => exentas.add(p.id)));
    excepciones.filter(e => !parejasDe(e.text).length).forEach(e => {
      const m = String(e.text).match(/\b(?:de|del|en)\s+(Marvel|Harry Potter|Supernatural|Star vs\.?|Sherlock|Naruto|Teen Wolf)\b/i);
      if (m) ambitos.push({ categoria: c.categoria, fandom: sinAcentos(m[1]) });
    });
    return true;
  }).map(c => c.categoria);
  return { categorias, exentas, ambitos };
}
const categoriasVetadas = (preferences) => vetosDe(preferences).categorias;

function crearRegistro() {
  const retiradas = [], sinComprobar = [], permitidas = new Set(), titulosPermitidos = new Set();

  const claves = (o) => {
    const titulo = sinAcentos(o.title ?? o.titulo ?? '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const autorDato = o.author ?? o.autor;
    const autor = sinAcentos(typeof autorDato === 'object' ? autorDato?.name : autorDato).trim();
    return [o.url ? `u:${claveDeObra(o.url)}` : null,
      o.id ? `id:${sinAcentos(o.source ?? o.fuente ?? '')}:${o.id}` : null,
      titulo && autor ? `ta:${titulo}:${autor}` : null].filter(Boolean);
  };
  return {
    retiradas, sinComprobar,
    anota(o, categoria) { retiradas.push({ titulo: String(o.title ?? o.titulo ?? ''), url: o.url, id: o.id,
      source: o.source ?? o.fuente, autor: o.author ?? o.autor, categoria }); },
    recuerda(o, { conCasilla = false } = {}) {
      const k = claves(o).filter(c => !conCasilla || !c.startsWith('ta:'));
      return retiradas.find(r => claves(r).some(c => k.includes(c)))?.categoria || null;
    },
    acepta(o) { claves(o).filter(c => c.startsWith('u:') || c.startsWith('id:')).forEach(c => permitidas.add(c));
      titulosPermitidos.add(sinAcentos(o.title ?? o.titulo ?? '').trim()); },
    esPermitida(o) { return claves(o).some(c => permitidas.has(c)); },
    tieneHomonimaPermitida(o) { return titulosPermitidos.has(sinAcentos(o.titulo ?? o.title ?? '').trim()) && !this.esPermitida(o); },
    sinCategoria(o) { sinComprobar.push({ titulo: String(o.title ?? o.titulo ?? ''), url: o.url }); }
  };
}

const esObra = (o) => !!o && typeof o === 'object' && !Array.isArray(o) && typeof o.url === 'string' && !!o.url
  && (Array.isArray(o.tags) || typeof (o.title ?? o.titulo) === 'string');
const nombresDe = (obra) => (Array.isArray(obra.tags) ? obra.tags : []).map(t => String(t?.name ?? t).trim());

function mirar(obra, vetos, registro) {

  if (!esObra(obra) || obra.enBiblioteca) return { categoria: null };
  const etiquetas = nombresDe(obra);
  const fandom = String(obra.fandom ?? obra.fandoms?.[0] ?? obra.tags?.find?.(t => t?.category === 'fandom')?.name ?? '');
  const { categorias, parejas } = lecturaDe({ titulo: String(obra.title ?? obra.titulo ?? ''), etiquetas, sinopsis: String(obra.synopsis ?? ''), fandom });
  const vetadas = categorias.filter(c => vetos.categorias.includes(c));
  const libre = vetadas.length > 0 && vetadas.every(c => {
    const deEsa = parejas.filter(p => p.cat === c);
    return vetos.ambitos?.some(a => a.categoria === c && fandom &&
      new RegExp(`(?:^|[^\\p{L}])${a.fandom}(?:$|[^\\p{L}])`, 'u').test(sinAcentos(fandom))) ||
      (deEsa.length > 0 && deEsa.every(p => vetos.exentas.has(p.id)));
  });
  if (vetadas.length && !libre) return { categoria: vetadas[0] };
  const antes = registro?.recuerda(obra, { conCasilla: traeCasilla(etiquetas) });
  if (antes && !libre) return { categoria: antes };
  return { categoria: null, sinCategoria: !categorias.length && !traeCasilla(etiquetas) };
}

const choca = (obra, vetadas, opc = {}) => mirar(obra, { categorias: vetadas, exentas: opc.exentas || new Set(), ambitos: opc.ambitos || [] }, opc.registro).categoria;

const MENSAJE = {
  vetada: (c) => `Es ${c}, y el usuario no lee ${c} (sus disgustos): no se la recomiendes ni la importes salvo que la pida él sabiéndolo.`,
  quitadas: (n, vetadas) => `${n === 1 ? 'Se quitó 1 obra' : `Se quitaron ${n} obras`} ${vetadas.join(' o ')} por los disgustos del usuario; no las busques por otro camino.`,
  sinCategoria: (n, vetadas) => `${n === 1 ? 'Una obra no dice' : `${n} obras no dicen`} su categoría ni su pareja: no se pudo comprobar que no sean ${vetadas.join(' o ')}. No afirmes que encajan con sus disgustos; dilo.`
};

function sinVetadas(resultado, vetadas, opc = {}) {
  if (!vetadas.length || !resultado || typeof resultado !== 'object') return resultado;
  const vetos = { categorias: vetadas, exentas: opc.exentas || new Set(), ambitos: opc.ambitos || [] };
  const { registro } = opc;
  const propia = mirar(resultado, vetos, registro);
  if (propia.categoria) {
    registro?.anota(resultado, propia.categoria);
    return { ...resultado, vetada: MENSAJE.vetada(propia.categoria) };
  }
  if (propia.sinCategoria) { registro?.sinCategoria(resultado); return { ...resultado, sinCategoria: MENSAJE.sinCategoria(1, vetadas) }; }
  const cuenta = { quitadas: 0, sin: 0 };
  const filtrar = (lista) => lista.filter(x => {
    const m = mirar(x, vetos, registro);
    if (m.categoria) { cuenta.quitadas++; registro?.anota(x, m.categoria); }
    else if (m.sinCategoria) { cuenta.sin++; registro?.sinCategoria(x); }
    if (!m.categoria) registro?.acepta(x);
    return !m.categoria;
  }).map(limpiar);
  function limpiar(v) {
    if (Array.isArray(v)) return filtrar(v);
    if (!v || typeof v !== 'object') return v;
    if (esObra(v)) {
      const m = mirar(v, vetos, registro);
      if (m.categoria) { registro?.anota(v, m.categoria); return { vetada: MENSAJE.vetada(m.categoria) }; }
      if (m.sinCategoria) registro?.sinCategoria(v);
      else registro?.acepta(v);
      return v;
    }

    if (/^Tu biblioteca/.test(String(v.fuente || ''))) return v;
    const antes = { ...cuenta };
    const fuera = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Array.isArray(x) ? filtrar(x) : limpiar(x)]));
    const q = cuenta.quitadas - antes.quitadas, s = cuenta.sin - antes.sin;
    return { ...fuera, ...(q ? { vetadasPorDisgusto: MENSAJE.quitadas(q, vetadas) } : {}), ...(s ? { sinCategoriaPorDisgusto: MENSAJE.sinCategoria(s, vetadas) } : {}) };
  }
  return limpiar(resultado);
}

async function aplicarVetos(nombre, resultado, state, registro) {
  if (!DE_FUERA.test(nombre)) return resultado;
  const s = await state?.read?.();
  const { categorias, exentas, ambitos } = vetosDe(s?.preferences);
  return sinVetadas(resultado, categorias, { exentas, ambitos, registro });
}

module.exports = { categoriasVetadas, vetosDe, choca, sinVetadas, aplicarVetos, crearRegistro, esObra, DE_FUERA };
