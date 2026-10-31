const VACIAS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al',
  'y', 'o', 'en', 'con', 'por', 'para', 'a', 'the', 'of', 'and', 'or', 'in',
  'on', 'at', 'to', 'for', 'my', 'i'
]);

function palabrasDe(titulo) {
  return new Set(
    String(titulo || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(p => p.length > 2 && !VACIAS.has(p))
  );
}

function parecido(a, b) {
  const A = palabrasDe(a);
  const B = palabrasDe(b);
  if (A.size === 0 || B.size === 0) return 0;

  let comunes = 0;
  for (const p of A) if (B.has(p)) comunes++;
  if (comunes === 0) return 0;

  const menor = Math.min(A.size, B.size);
  const mayor = Math.max(A.size, B.size);
  if (comunes < 2 && mayor > 1) return 0;

  return comunes / menor;
}

const autorLimpio = (x) => String(x || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]/g, '');

function mismoAutorLimpio(x, y) {
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}
function mismoAutor(a, b) {
  return mismoAutorLimpio(autorLimpio(a), autorLimpio(b));
}

const LISTON = 0.6;

async function buscarEnTodos(obra, opciones = {}) {
  const titulo = String(obra?.title || '').trim();
  if (!titulo) return [];

  const SITIOS = [
    { nombre: 'AO3', dominio: 'archiveofourown.org', cargar: () => require('./scrapers/ao3.js') },
    { nombre: 'RoyalRoad', dominio: 'royalroad.com', cargar: () => require('./scrapers/buscar-royalroad.js') },
    { nombre: 'FanFiction.net', dominio: 'fanfiction.net', cargar: () => require('./scrapers/buscar-ffn.js') },

    { nombre: 'WeTriedTLs', dominio: 'wetriedtls.com', cargar: () => require('./scrapers/buscar-wetriedtls.js') }
  ];

  const deDonde = String(opciones.excluir || obra?.url || '');
  const encontradas = [];

  for (const sitio of SITIOS) {

    if (deDonde.includes(sitio.dominio)) continue;

    let resultados = [];
    try {
      const mod = sitio.cargar();
      if (typeof mod.buscar !== 'function') continue;
      resultados = await mod.buscar({ consulta: titulo, orden: 'kudos_count', pagina: 1 });
    } catch (err) {

      console.warn(`[Buscar] ${sitio.nombre}: ${err.message}`);
      continue;
    }

    for (const r of (resultados || [])) {

      const p = Math.max(parecido(titulo, r.title), ...(r.otrosTitulos || []).map(t => parecido(titulo, t)));
      if (p < LISTON) continue;
      encontradas.push({
        ...r,
        sitio: sitio.nombre,

        confianza: Math.min(1, p + (mismoAutor(obra.author, r.author) ? 0.25 : 0))
      });
    }
  }

  return encontradas
    .sort((a, b) => b.confianza - a.confianza)
    .slice(0, 10);
}

module.exports = { buscarEnTodos, parecido, palabrasDe, mismoAutor, LISTON, autorLimpio, mismoAutorLimpio };
