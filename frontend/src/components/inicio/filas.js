import { estaEmpezada, porLecturaReciente } from '../../lecturas.js';

export function repartirEnFilas(biblioteca) {
  const enCurso = [], recientes = [], completadas = [], alDia = [];

  for (const obra of biblioteca) {
    const leido = obra.currentChapter || 0;
    const total = obra.totalChapters || 1;
    if (!estaEmpezada(obra)) recientes.push(obra);
    else if (leido > 0 && leido >= total - 1) (obra.completa === true ? completadas : alDia).push(obra);
    else enCurso.push(obra);
  }
  alDia.sort(porLecturaReciente);

  enCurso.sort(porLecturaReciente);
  recientes.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

  return {
    enCurso,
    recientes,
    completadas,
    alDia,
    conNuevos: biblioteca.filter(o => (o.capitulosNuevos || 0) > 0)
  };
}
