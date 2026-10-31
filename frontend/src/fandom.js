export function nombreDeFandom(nombre) {
  let s = String(nombre || '').trim();
  s = s.replace(/\s+-\s+.*$/, '');
  for (let i = 0; i < 3; i++) s = s.replace(/\s*\([^()]*\)\s*$/, '');
  return s.replace(/\s+/g, ' ').trim() || String(nombre || '').trim();
}

export function claveDeFandom(nombre) {
  return nombreDeFandom(nombre).replace(/^the\s+/i, '').toLowerCase();
}

export function fandomsAgrupados(library, categoria = 'fandom') {
  const grupos = new Map();
  for (const obra of library) {
    const vistas = new Set();
    for (const t of obra.tags || []) {
      if (t.category !== categoria || !t.name) continue;
      const nombre = String(t.name).trim();
      const clave = claveDeFandom(nombre);
      if (!clave) continue;
      const g = grupos.get(clave) || { obras: new Set(), variantes: new Map() };
      g.obras.add(obra.id ?? obra);
      if (!vistas.has(nombre)) g.variantes.set(nombre, (g.variantes.get(nombre) || 0) + 1);
      vistas.add(nombre);
      grupos.set(clave, g);
    }
  }
  return [...grupos.entries()].map(([clave, g]) => {
    const [nombre] = [...g.variantes.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0];
    return { clave, nombre: nombreDeFandom(nombre), n: g.obras.size };
  }).sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre));
}
