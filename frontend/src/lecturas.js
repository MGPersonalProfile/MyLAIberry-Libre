export function porLecturaReciente(a, b) {
  return (b.lastReadAt || 0) - (a.lastReadAt || 0)
    || (b.currentChapter || 0) - (a.currentChapter || 0);
}

export function estaEmpezada(obra) {
  return Boolean(obra.lastReadAt) || (obra.currentChapter || 0) > 0;
}

export function ultimaLectura(obras) {
  return obras.filter(estaEmpezada).sort(porLecturaReciente)[0] || obras[0] || null;
}
