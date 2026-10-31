const CAMPOS = Object.freeze([
  'id',
  'title',
  'author',
  'totalChapters',
  'downloadedChapters',
  'capituloActual',

  'capitulosPorLeer',

  'capitulosSinDescargar',
  'capitulosLeidos',

  'lectura',
  'completa',
  'source',
  'tags',
  'enMiLista',
  'marcada',
  'ultimaLectura',

  'anadida',
  'url',
  'serie'

]);

function estadoDeLectura(f) {
  const leido = f.currentChapter || 0;
  const total = f.totalChapters || 1;
  if (leido > 0 && leido >= total - 1) return f.completa === true ? 'terminada' : 'al día';
  return Boolean(f.lastReadAt) || leido > 0 ? 'a medias' : 'sin empezar';
}

function fechaYHora(ms) {
  const d = new Date(ms);
  const dos = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

function fichaDeObra(f) {
  const actual = (f.currentChapter || 0) + 1;
  const total = f.totalChapters || 0;
  const empezada = Boolean(f.lastReadAt) || (f.currentChapter || 0) > 0;
  const lectura = estadoDeLectura(f);
  return {
    id: String(f.id),
    title: f.title,
    author: f.author,
    totalChapters: total,
    downloadedChapters: f.downloadedChapters || 0,

    capituloActual: empezada ? actual : null,
    capitulosPorLeer: empezada ? Math.max(0, total - actual) : total,
    capitulosSinDescargar: Math.max(0, total - (f.downloadedChapters || 0)),
    capitulosLeidos: lectura === 'terminada' || lectura === 'al día' ? total : (empezada ? actual - 1 : 0),
    lectura,
    completa: f.completa,
    source: f.source,
    tags: (f.tags || []).map(t => t.name).slice(0, 15),
    enMiLista: !!f.enMiLista,
    marcada: f.estadoLectura || undefined,
    ultimaLectura: f.lastReadAt ? fechaYHora(f.lastReadAt) : undefined,

    anadida: (f.enBibliotecaDesde || f.addedAt) ? new Date(f.enBibliotecaDesde || f.addedAt).toISOString().slice(0, 10) : 'no consta',
    url: f.url,
    serie: Array.isArray(f.series) && f.series.length
      ? f.series.map(s => ({ ...(s.parte ? { parte: s.parte } : {}), nombre: s.nombre, url: s.url,
        dicho: require('./scrapers/ao3-series.js').describirSerie(s) })) : undefined
  };
}

function estaCompleta(obra) {
  return obra?.completa === true;
}

function capitulosNuevos(obra, base) {
  return (obra?.totalChapters || 0) - (Number(base) || 0);
}

function descargasDe(trabajos, obras, ahora = Date.now()) {
  const porId = new Map((obras || []).map(o => [String(o.id), o]));
  const descargas = (trabajos || []).filter(t => t.tipo === 'descargar-capitulos').map(t => {
    const o = porId.get(String(t.carga?.fanficId)) || {};
    const total = (o.chapterList || []).length || o.totalChapters || 0;
    const tiene = o.downloadedChapters || 0;
    return { obra: o.title || `(obra ${t.carga?.fanficId})`, capitulosDescargados: tiene, capitulosTotales: total,
      faltan: Math.max(0, total - tiene),
      ...(t.intentos ? { reintentos: t.intentos } : {}),
      ...(t.noAntesDe > ahora ? { esperaAReintentarDentroDeMinutos: Math.ceil((t.noAntesDe - ahora) / 60000) } : {}) };
  });
  const otras = (trabajos || []).filter(t => t.tipo !== 'descargar-capitulos').length;
  return { descargas, ...(otras ? { otrasTareasEnCola: otras } : {}) };
}

module.exports = { CAMPOS, fichaDeObra, estadoDeLectura, estaCompleta, capitulosNuevos, descargasDe };
