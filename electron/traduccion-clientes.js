const { cabeceras } = require('./user-agent.js');

const CLIENTES = [
  {
    id: 'dict-chrome-ex',
    url: (t, o, d) => 'https://translate.googleapis.com/translate_a/single'
      + `?client=dict-chrome-ex&sl=${o}&tl=${d}&dt=t&q=${encodeURIComponent(t)}`,
    leer: (j) => (Array.isArray(j?.[0]) ? j[0].map(s => s[0] || '').join('') : null)
  },
  {
    id: 'at',
    url: (t, o, d) => 'https://translate.googleapis.com/translate_a/single'
      + `?client=at&sl=${o}&tl=${d}&dt=t&q=${encodeURIComponent(t)}`,
    leer: (j) => (Array.isArray(j?.[0]) ? j[0].map(s => s[0] || '').join('') : null)
  },
  {
    id: 'gtx',
    url: (t, o, d) => 'https://translate.googleapis.com/translate_a/single'
      + `?client=gtx&sl=${o}&tl=${d}&dt=t&q=${encodeURIComponent(t)}`,
    leer: (j) => (Array.isArray(j?.[0]) ? j[0].map(s => s[0] || '').join('') : null)
  },
  {

    id: 'clients5',
    url: (t, o, d) => 'https://clients5.google.com/translate_a/t'
      + `?client=dict-chrome-ex&sl=${o}&tl=${d}&q=${encodeURIComponent(t)}`,
    leer: (j) => {
      if (Array.isArray(j) && Array.isArray(j[0]) && typeof j[0][0] === 'string') return j[0][0];
      if (Array.isArray(j) && typeof j[0] === 'string') return j[0];
      return null;
    }
  }
];

let clientePreferido = 0;

async function traducirTextoConProcedencia(texto, destino, origen = 'auto') {
  const problemas = [];

  for (let vuelta = 0; vuelta < CLIENTES.length; vuelta++) {
    const i = (clientePreferido + vuelta) % CLIENTES.length;
    const cliente = CLIENTES[i];

    let respuesta;
    try {
      respuesta = await fetch(cliente.url(texto, origen, destino), {
        headers: cabeceras(),
        signal: AbortSignal.timeout(20000)
      });
    } catch (err) {
      problemas.push(`${cliente.id}: ${err.name}`);
      continue;
    }

    if (!respuesta.ok) {
      problemas.push(`${cliente.id}: HTTP ${respuesta.status}`);
      continue;
    }

    let datos;
    try {
      datos = await respuesta.json();
    } catch {
      problemas.push(`${cliente.id}: respuesta ilegible`);
      continue;
    }

    const salida = cliente.leer(datos);
    if (salida === null || salida === undefined) {
      problemas.push(`${cliente.id}: formato inesperado`);
      continue;
    }

    if (i !== clientePreferido) {
      console.log(`[Traducción] cambiando a "${cliente.id}" (${problemas.join(', ')})`);
      clientePreferido = i;
    }
    return { texto: salida, cliente: cliente.id };
  }

  const hubo429 = problemas.some(p => p.includes('429'));
  throw new Error(hubo429
    ? 'El servicio de traducción está limitando las peticiones. Prueba de nuevo en unos minutos.'
    : `No se pudo traducir: ${problemas.join(' · ')}`);
}

function muestraRepresentativa(texto, largo = 500) {
  const t = String(texto || '');
  if (t.length <= largo) return t;
  const desde = Math.floor((t.length - largo) / 2);
  return t.slice(desde, desde + largo);
}

const CLIENTES_CON_IDIOMA = ['dict-chrome-ex', 'at', 'gtx'];

async function detectarIdioma(muestra) {
  const texto = encodeURIComponent(muestraRepresentativa(muestra));

  const preferido = CLIENTES[clientePreferido]?.id;
  const orden = [...new Set([preferido, ...CLIENTES_CON_IDIOMA])]
    .filter(id => CLIENTES_CON_IDIOMA.includes(id));

  for (const cliente of orden) {
    const url = 'https://translate.googleapis.com/translate_a/single'
      + `?client=${cliente}&sl=auto&tl=en&dt=t&q=${texto}`;
    try {
      const r = await fetch(url, {
        headers: cabeceras(),
        signal: AbortSignal.timeout(15000)
      });
      if (!r.ok) continue;
      const datos = await r.json();
      if (typeof datos?.[2] === 'string') return datos[2];
    } catch {
      continue;
    }
  }
  return null;
}

async function traducirTexto(texto, destino, origen = 'auto') {
  return (await traducirTextoConProcedencia(texto, destino, origen)).texto;
}

function fijarClientePreferido(id) {
  const i = CLIENTES.findIndex(c => c.id === id);
  clientePreferido = i < 0 ? 0 : i;
}

module.exports = { CLIENTES, traducirTexto, traducirTextoConProcedencia, detectarIdioma, muestraRepresentativa, fijarClientePreferido };
