function pasaUmbral(obra, umbral = {}) {
  const {
    kudosMinimos = 0,
    palabrasMinimas = 0,
    capitulosMinimos = 0,
    soloCompletas = false
  } = umbral;

  if (soloCompletas && obra.completa === false) {
    return { pasa: false, motivo: 'todavía sin terminar' };
  }

  const sinCifra = new Set(obra.sinCifras || []);
  if (!sinCifra.has('kudos') && (obra.kudos || 0) < kudosMinimos) {
    return { pasa: false, motivo: `${obra.kudos || 0} kudos, hacen falta ${kudosMinimos}` };
  }
  if (!sinCifra.has('wordCount') && (obra.wordCount || 0) < palabrasMinimas) {
    return { pasa: false, motivo: `${(obra.wordCount || 0).toLocaleString()} palabras, hacen falta ${palabrasMinimas.toLocaleString()}` };
  }
  if (!sinCifra.has('totalChapters') && (obra.totalChapters || 0) < capitulosMinimos) {
    return { pasa: false, motivo: `${obra.totalChapters || 0} capítulos, hacen falta ${capitulosMinimos}` };
  }
  return { pasa: true, motivo: 'se ha ganado un sitio' };
}

const { claveDeObra } = require('./misma-obra.js');

function filtrarNuevas(obras, { vistos = [], urlsConocidas = [], umbral = {}, tope = 3 }) {
  const yaVisto = new Set(vistos);
  const yaTengo = new Set(urlsConocidas.map(claveDeObra));

  const candidatas = [];
  for (const obra of obras) {
    if (yaVisto.has(obra.idOrigen) || yaTengo.has(claveDeObra(obra.url))) continue;
    const veredicto = pasaUmbral(obra, umbral);
    if (veredicto.pasa) candidatas.push(obra);
  }

  const sinCifras = candidatas.filter(o => o.sinCifras?.length);
  const conCifras = candidatas.filter(o => !o.sinCifras?.length);

  const hueco = sinCifras.length && (tope > 1 || !conCifras.length) ? 1 : 0;
  const entran = [...conCifras.slice(0, tope - hueco), ...sinCifras.slice(0, hueco)];
  return Object.assign(entran, { enEspera: candidatas.filter(o => !entran.includes(o)).map(o => o.idOrigen) });
}

const PAGINAS_VIGILADAS = 5;

function paginaSiguiente(pagina, obras, { vistos = [], urlsConocidas = [] } = {}) {
  if (!obras.length || pagina >= PAGINAS_VIGILADAS) return 1;
  const yaVisto = new Set(vistos);
  const yaTengo = new Set(urlsConocidas.map(claveDeObra));
  return obras.every(o => yaVisto.has(o.idOrigen) || yaTengo.has(claveDeObra(o.url))) ? pagina + 1 : pagina;
}

module.exports = { pasaUmbral, filtrarNuevas, paginaSiguiente, PAGINAS_VIGILADAS };
