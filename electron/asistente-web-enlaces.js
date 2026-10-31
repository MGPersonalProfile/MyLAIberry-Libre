function paginaSiguiente(enlaces) {
  const validos = enlaces.filter(e => e && /^https?:/.test(e.url || ''));
  const porRel = validos.find(e => /(^|\s)next(\s|$)/i.test(e.rel || ''));
  if (porRel) return porRel.url;
  const limpio = e => String(e.texto || e.etiqueta || '').replace(/[«»‹›→←<>]/g, '').replace(/\s+/g, ' ').trim();
  const porTexto = validos.find(e => /^(next( page)?|siguiente|p[aá]gina siguiente|older( posts| entries)?|more results)$/i.test(limpio(e))
    || /^(next page|p[aá]gina siguiente)$/i.test(String(e.etiqueta || '').trim()));
  if (porTexto) return porTexto.url;
  const flecha = validos.find(e => /^\s*(›|→|>)\s*$/.test(String(e.texto || '')));
  return flecha ? flecha.url : null;
}

function indiceDeCapitulos(enlaces, maximo = 150) {
  const POR_TEXTO = /(?:^|[^a-z])(?:chapter|chap|ch|cap[ií]tulo|cap|episode|ep|part|parte)\.?\s*#?(\d+(?:\.\d+)?)/i;
  const CJK = /第\s*(\d+)\s*[章话話回]/;
  const DELANTE = /^(\d+(?:\.\d+)?)\s*[.:)\-–]\s+\S/;
  const NUMERO_EN_URL = /\/(?:chapter|chap|ch|cap[ií]tulo|cap|episode|ep)[-_](\d+(?:\.\d+)?)(?:[/?#.-]|$)/i;
  const CAPITULO_EN_URL = /\/(?:chapters?|cap[ií]tulos?|episodes?)\/[^/?#]+/i;
  const BOTON = /^(start|continue|begin) reading$|^read (now|first|latest|more)$|^(first|latest|last|next|previous|prev) chapter$|^(empezar|comenzar|seguir) a leer$|^leer$/i;
  const porDireccion = new Map();
  for (const e of enlaces || []) {
    if (!e || !/^https?:/.test(e.url || '')) continue;
    const texto = String(e.texto || '').replace(/\s+/g, ' ').trim();
    const titulo = BOTON.test(texto) ? '' : texto;
    const direccion = String(e.url).split('#')[0];
    let decodificada = direccion;
    try { decodificada = decodeURIComponent(direccion); } catch (_) {  }
    const m = titulo.match(POR_TEXTO) || titulo.match(CJK) || titulo.match(DELANTE) || decodificada.match(NUMERO_EN_URL);
    if (!m && !CAPITULO_EN_URL.test(decodificada)) continue;
    const n = m ? parseFloat(m[1]) : null;
    const antes = porDireccion.get(direccion);
    if (!antes) porDireccion.set(direccion, { n, titulo: titulo.slice(0, 90), url: direccion });
    else {

      if (antes.n === null && n !== null) antes.n = n;
      if (!antes.titulo && titulo) antes.titulo = titulo.slice(0, 90);
    }
  }

  const grupoDe = (c) => {
    try {
      const u = new URL(c.url);
      const tramos = u.pathname.split('/').filter(Boolean);
      return u.host + '/' + tramos.slice(0, Math.min(2, tramos.length - 1)).join('/');
    } catch (_) { return ''; }
  };
  const grupos = new Map();
  for (const c of porDireccion.values()) {
    const g = grupoDe(c);
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g).push(c);
  }
  const mayor = [...grupos.values()].sort((a, b) => b.length - a.length)[0] || [];
  const numerados = mayor.every(c => c.n !== null);
  const vistos = new Set();
  const lista = numerados
    ? mayor.sort((a, b) => a.n - b.n).filter(c => !vistos.has(c.n) && vistos.add(c.n))
    : mayor;
  if (lista.length < 3) return null;
  const enteros = numerados && lista.every(c => Number.isInteger(c.n));
  const faltan = enteros ? (lista[lista.length - 1].n - lista[0].n + 1) - lista.length : 0;
  return { total: lista.length, primero: lista[0].url, ultimo: lista[lista.length - 1].url,
    ...(faltan > 0 ? { incompleto: `Faltan ${faltan} números entre el ${lista[0].n} y el ${lista[lista.length - 1].n}: la página sólo enlaza parte del índice (paginado o recortado). Para los que faltan, prueba su dirección o «siguiente».` } : {}),
    capitulos: lista.slice(0, maximo).map(c => ({ ...(c.n !== null ? { n: c.n } : {}), titulo: c.titulo, url: c.url })) };
}

module.exports = { paginaSiguiente, indiceDeCapitulos };
