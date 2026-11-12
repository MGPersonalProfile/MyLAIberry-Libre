const obraDe = url => {
  const m = String(url || '').match(/^https?:\/\/(?:www\.)?([^/]+)\/fiction\/(\d+)/i);
  return m ? `${m[1].toLowerCase()}/${m[2]}` : null;
};

export function seriesPropias(obra) {
  const lista = Array.isArray(obra?.series) ? obra.series.filter(s => s && s.nombre) : [];
  const propia = obraDe(obra?.url);
  return lista.filter(s => !/\/chapter\//i.test(s.url || '') && !(propia && obraDe(s.url) === propia));
}
