const E = require('./etiquetas.js');

const PESOS = {

  [E.FANDOM]: 5,

  [E.PERSONAJE]: 3, [E.RELACION]: 3,

  [E.LIBRE]: 2, [E.GENERO]: 2,

  [E.CATEGORIA]: 1,

  [E.CLASIFICACION]: 0, [E.IDIOMA]: 0, [E.AVISO]: 0
};

const claveEtiqueta = (t) => `${t.category}|${String(t.name).toLowerCase().trim()}`;

function perfilDeGustos(biblioteca) {
  const perfil = new Map();
  for (const obra of biblioteca) {
    const empezada = (obra.currentChapter || 0) > 0;
    for (const t of obra.tags || []) {
      const peso = (PESOS[t.category] ?? 1) * (empezada ? 2 : 1);
      if (peso === 0) continue;
      const k = claveEtiqueta(t);
      const previo = perfil.get(k);
      if (previo) previo.peso += peso;
      else perfil.set(k, { peso, nombre: t.name, categoria: t.category, obra: obra.title });
    }
  }
  return perfil;
}

function ordenarPorAfinidad(candidatas, perfil) {
  return candidatas
    .map(obra => {
      const coincidencias = [];
      for (const t of obra.tags || []) {
        const enPerfil = perfil.get(claveEtiqueta(t));
        if (enPerfil) coincidencias.push({ ...enPerfil, categoria: t.category });
      }
      coincidencias.sort((a, b) => b.peso - a.peso);
      return {
        ...obra,
        afinidad: coincidencias.reduce((s, c) => s + c.peso, 0),
        porque: coincidencias.slice(0, 3).map(c => c.nombre)
      };
    })
    .sort((a, b) => b.afinidad - a.afinidad);
}

function loQueSueleLeer(biblioteca, cuantas = 12) {
  const top = (filtro) => [...perfilDeGustos(biblioteca).values()].filter(filtro)
    .sort((a, b) => b.peso - a.peso).slice(0, cuantas).map(e => e.nombre);
  return { obras: biblioteca.length, fandoms: top(e => e.categoria === E.FANDOM),
    etiquetas: top(e => e.categoria !== E.FANDOM) };
}

module.exports = { PESOS, perfilDeGustos, ordenarPorAfinidad, loQueSueleLeer };
