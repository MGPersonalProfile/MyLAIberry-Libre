export const FILTRO_VACIO = {
  texto: '',
  fuentes: [],
  estado: 'todas',
  disponible: 'todas',
  capitulosMin: 0,
  palabrasMin: 0,
  kudosMin: 0,
  etiquetas: [],
  orden: 'afinidad'
};

export function hayFiltro(f) {
  return !!(f.texto.trim() || f.fuentes.length || f.estado !== 'todas' ||
    f.disponible !== 'todas' || f.capitulosMin || f.palabrasMin || f.kudosMin ||
    f.etiquetas.length || f.orden !== 'afinidad');
}

const normaliza = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function etiquetasDe(obra) {
  return (obra.tags || []).map(t => (typeof t === 'string' ? t : t?.name)).filter(Boolean);
}

export function resumenDe(items) {
  const fuentes = new Map();
  const etiquetas = new Map();

  for (const o of items) {
    const f = o.source || 'Otros';
    fuentes.set(f, (fuentes.get(f) || 0) + 1);

    for (const e of new Set(etiquetasDe(o))) etiquetas.set(e, (etiquetas.get(e) || 0) + 1);
  }

  const porCuenta = (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]);
  return {
    fuentes: [...fuentes.entries()].sort(porCuenta),

    etiquetas: [...etiquetas.entries()].filter(([, n]) => n > 1).sort(porCuenta).slice(0, 40)
  };
}

export function sePuedeLeer(obra) {
  return (obra.downloadedChapters || 0) > 0;
}

const ORDENES = {

  afinidad: null,
  kudos: (a, b) => (b.kudos || 0) - (a.kudos || 0),
  palabras: (a, b) => (b.wordCount || 0) - (a.wordCount || 0),
  capitulos: (a, b) => (b.totalChapters || 0) - (a.totalChapters || 0),
  reciente: (a, b) => (b.addedAt || 0) - (a.addedAt || 0),
  titulo: (a, b) => String(a.title || '').localeCompare(String(b.title || ''))
};

export function aplicarFiltro(items, filtro) {
  const f = { ...FILTRO_VACIO, ...filtro };
  const busca = normaliza(f.texto).trim();
  const fuentes = new Set(f.fuentes);
  const pedidas = f.etiquetas.map(normaliza);

  const salida = items.filter(o => {
    if (fuentes.size && !fuentes.has(o.source || 'Otros')) return false;

    if (f.estado === 'completas' && o.completa !== true) return false;
    if (f.estado === 'en-curso' && o.completa !== false) return false;

    if (f.disponible === 'leibles' && !sePuedeLeer(o)) return false;

    if ((o.totalChapters || 0) < f.capitulosMin) return false;
    if ((o.wordCount || 0) < f.palabrasMin) return false;
    if ((o.kudos || 0) < f.kudosMin) return false;

    if (pedidas.length) {
      const suyas = etiquetasDe(o).map(normaliza);

      if (!pedidas.every(p => suyas.some(s => s.includes(p)))) return false;
    }

    if (busca) {
      const donde = [o.title, o.author, ...etiquetasDe(o)].map(normaliza).join(' | ');
      if (!donde.includes(busca)) return false;
    }

    return true;
  });

  const orden = ORDENES[f.orden];
  return orden ? [...salida].sort(orden) : salida;
}
