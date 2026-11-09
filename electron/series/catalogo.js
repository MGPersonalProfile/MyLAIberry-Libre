const { JSDOM } = require('jsdom');
const { normalizarSerie, sanitizarUrl } = require('./contrato.js');
const { obtenerAdaptador, selectorDeFuente } = require('./fuentes.js');
const { mismaObra } = require('../misma-obra.js');

const MAX_PAGINAS = 20;

function deduplicarObras(obras) {
  const unicas = [];
  for (const o of obras) {
    if (!unicas.some(u => mismaObra(u.url, o.url))) {
      unicas.push(o);
    }
  }
  return unicas;
}

function ordenarObras(obras, ordenConocido) {
  if (!ordenConocido) return [...obras];
  return [...obras].sort((a, b) => {
    if (a.posicion === null && b.posicion === null) return 0;
    if (a.posicion === null) return 1;
    if (b.posicion === null) return -1;
    return a.posicion - b.posicion;
  });
}

function extraerCatalogo(html, url, fuente) {
  const fuenteFinal = fuente || selectorDeFuente(url);
  const adaptador = obtenerAdaptador(fuenteFinal);
  const dom = new JSDOM(html);
  const raw = adaptador.extraerCatalogoDeSerie(dom.window.document, url);

  const deduplicadas = deduplicarObras(raw.obras || []);
  const ordenadas = ordenarObras(deduplicadas, raw.ordenConocido);

  return normalizarSerie({
    fuente: fuenteFinal,
    nombre: raw.nombre,
    url,
    parte: null,
    ordenConocido: raw.ordenConocido,
    totalObras: raw.totalDeclarado,
    obras: ordenadas
  }, url);
}

function verificarIntegridad(totalDeclarado, totalObras, actualUrl, paginas, errorRegistrado) {
  let parcial = Boolean(errorRegistrado);
  let error = errorRegistrado;
  if (actualUrl && paginas >= MAX_PAGINAS && !error) {
    parcial = true;
    error = `Catálogo truncado: se alcanzó el tope de ${MAX_PAGINAS} páginas y aún quedaban obras`;
  } else if (totalDeclarado && totalObras < totalDeclarado && !error) {
    parcial = true;
    error = `Catálogo incompleto: se encontraron ${totalObras} de ${totalDeclarado} obras`;
  }
  return { parcial, error };
}

class CatalogoSeries {
  constructor({ fetcher } = {}) {
    this.fetcher = fetcher || (async () => { throw new Error('Fetcher no configurado'); });
  }

  async obtenerCatalogo(url, opciones = {}) {
    const fuente = opciones.fuente || selectorDeFuente(url);
    const adaptador = obtenerAdaptador(fuente);

    let actualUrl = sanitizarUrl(url);
    let paginas = 0;
    let todasObras = [];
    let nombreSerie = 'Serie';
    let ordenConocido = false;
    let totalDeclarado = null;
    let errorRegistrado = actualUrl ? null : 'Dirección de serie inválida o no admitida';
    let parcial = !actualUrl;

    while (actualUrl && paginas < MAX_PAGINAS) {
      paginas++;
      let html = '';
      try {
        html = await this.fetcher(actualUrl);
      } catch (err) {
        errorRegistrado = err.message || 'Error al obtener la página de la serie';
        parcial = true;
        break;
      }

      const dom = new JSDOM(html);
      const paginaRes = adaptador.extraerCatalogoDeSerie(dom.window.document, actualUrl, todasObras.length);

      if (paginas === 1) {
        nombreSerie = paginaRes.nombre || nombreSerie;
        ordenConocido = paginaRes.ordenConocido;
        totalDeclarado = paginaRes.totalDeclarado;
      }

      todasObras.push(...(paginaRes.obras || []));
      actualUrl = paginaRes.siguientePagina;
    }

    const deduplicadas = deduplicarObras(todasObras);
    const ordenadas = ordenarObras(deduplicadas, ordenConocido);
    const int = verificarIntegridad(totalDeclarado, ordenadas.length, actualUrl, paginas, errorRegistrado);

    return normalizarSerie({
      fuente,
      nombre: nombreSerie,
      url,
      parte: null,
      ordenConocido,
      totalObras: totalDeclarado,
      parcial: parcial || int.parcial,
      error: int.error,
      obras: ordenadas
    }, url);
  }

  async obtenerCatalogoConRespaldo(url, seriePrevia) {
    try {
      const res = await this.obtenerCatalogo(url);
      if ((res.error || (!res.obras || res.obras.length === 0)) && seriePrevia) {
        return {
          ...seriePrevia,
          conservada: true,
          error: res.error || 'Catálogo vacío o no accesible'
        };
      }
      return res;
    } catch (err) {
      return {
        ...(seriePrevia || { url, nombre: 'Serie previa' }),
        conservada: true,
        error: err.message || 'Página no accesible'
      };
    }
  }
}

module.exports = {
  deduplicarObras,
  ordenarObras,
  extraerCatalogo,
  CatalogoSeries
};
