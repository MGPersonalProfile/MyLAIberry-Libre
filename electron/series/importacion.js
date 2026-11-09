const { mismaObra, claveDeObra } = require('../misma-obra.js');
const { sanitizarUrl } = require('./contrato.js');

function clasificarObrasDeSerie(obras = [], biblioteca = []) {
  const enBiblioteca = [];
  const pendientes = [];
  const todas = [];
  const vistosLote = new Set();

  for (const o of obras) {
    const clave = o?.url ? claveDeObra(o.url) : null;
    if (clave && vistosLote.has(clave)) continue;
    if (clave) vistosLote.add(clave);

    const hallada = biblioteca.find(b => mismaObra(b.url, o.url));
    const elemento = {
      ...o,
      enBiblioteca: Boolean(hallada),
      ...(hallada ? { idExistente: String(hallada.id) } : {})
    };
    todas.push(elemento);
    if (hallada) enBiblioteca.push(elemento);
    else pendientes.push(elemento);
  }

  return { enBiblioteca, pendientes, todas };
}

function identificarFaltantes(obras, biblioteca) {
  return clasificarObrasDeSerie(obras, biblioteca).pendientes;
}

function validarObrasParaImportar(obras) {
  if (!Array.isArray(obras)) {
    throw new Error('El parámetro obras debe ser un Array');
  }
  for (const o of obras) {
    if (!o || typeof o !== 'object') throw new Error('Cada elemento de obras debe ser un objeto');
    const urlSegura = sanitizarUrl(o.url);
    if (!urlSegura) throw new Error(`URL de obra inválida o insegura: ${o?.url}`);
    if (!o.titulo || typeof o.titulo !== 'string' || !o.titulo.trim()) {
      throw new Error('Cada obra debe tener un título no vacío');
    }
  }
}

async function importarObrasSerie(obras = [], opciones = {}) {
  validarObrasParaImportar(obras);
  const addFn = opciones.addFanfic || (async (f) => f);
  const biblioteca = opciones.biblioteca || [];

  const { enBiblioteca, pendientes } = clasificarObrasDeSerie(obras, biblioteca);
  const importadas = [];
  const omitidas = [...enBiblioteca];
  const fallidas = [];
  const sRef = opciones.serie && typeof opciones.serie === 'object' ? opciones.serie : null;

  for (const p of pendientes) {
    const listaSeries = [];
    if (sRef) {
      listaSeries.push({
        id: sRef.id || sRef.url,
        nombre: sRef.nombre || 'Serie',
        url: sRef.url || '',
        parte: p.posicion !== undefined ? p.posicion : (p.parte !== undefined ? p.parte : null),
        totalObras: sRef.totalObras || null
      });
    } else if (Array.isArray(p.series) && p.series.length) {
      listaSeries.push(...p.series);
    }

    const nueva = {
      title: p.titulo,
      url: p.url,
      origen: 'propia',
      ...(listaSeries.length ? { series: listaSeries } : {})
    };

    try {
      const guardada = await addFn(nueva);
      if (guardada) importadas.push(guardada);
    } catch (err) {
      fallidas.push({ url: p.url, titulo: p.titulo, error: err?.message || 'Error al guardar' });
    }
  }

  return {
    importadas,
    omitidas,
    fallidas,
    total: obras.length
  };
}

function preservarSeries(previas = [], nuevas = []) {
  if (!Array.isArray(nuevas) || nuevas.length === 0) {
    return Array.isArray(previas) ? previas : [];
  }
  if (!Array.isArray(previas) || previas.length === 0) {
    return nuevas;
  }

  const resultado = [...nuevas];
  for (const p of previas) {
    if (!resultado.some(n => n.id === p.id || n.url === p.url)) {
      resultado.push(p);
    }
  }
  return resultado;
}

module.exports = {
  clasificarObrasDeSerie,
  importarObrasSerie,
  preservarSeries
};
