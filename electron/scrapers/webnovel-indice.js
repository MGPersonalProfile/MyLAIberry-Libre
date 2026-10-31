const HACE = /\s*\d+\s+(?:years?|months?|weeks?|days?|hours?|minutes?|seconds?)\s+ago\s*$/i;
const HACE_ES = /\s*hace\s+\d+\s+\S+\s*$/i;
const MARCA_DE_LEIDO = /^(?:leído|leido|read|lido)$/i;

function tituloDeLaDireccion(url) {
  const tramo = decodeURIComponent(String(url || '').split(/[?#]/)[0].split('/').pop() || '');
  const nombre = tramo.replace(/_\d{10,}$/, '').replace(/[-_]+/g, ' ').trim();
  return nombre ? nombre[0].toUpperCase() + nombre.slice(1) : '';
}

function leerEntrada(texto, url) {
  let t = String(texto || '').replace(/\s+/g, ' ').trim();
  let orden = null;
  let m = t.match(/^chapter\s+(\d+)\s*:\s*/i);
  if (m) { orden = Number(m[1]); t = t.slice(m[0].length); }
  else if ((m = t.match(/^(\d+)\s+/))) { orden = Number(m[1]); t = t.slice(m[0].length); }
  t = t.replace(HACE, '').replace(HACE_ES, '').trim();
  if (!t || MARCA_DE_LEIDO.test(t)) t = tituloDeLaDireccion(url);
  return { orden, titulo: t };
}

function ordenarIndice(entradas) {
  let anterior = 0;
  const conClave = entradas.map((e, i) => {
    const { orden, titulo } = leerEntrada(e.texto, e.url);

    const clave = orden ?? anterior + 0.001 * (i + 1);
    if (orden !== null) anterior = orden;
    const { texto, ...resto } = e;
    return { clave, i, capitulo: { ...resto, title: titulo || `Capítulo ${i + 1}` } };
  });
  return conClave.sort((a, b) => a.clave - b.clave || a.i - b.i).map(x => x.capitulo);
}

module.exports = { ordenarIndice, leerEntrada, tituloDeLaDireccion };
