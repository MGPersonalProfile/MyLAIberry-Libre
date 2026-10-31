const { antesOIgual } = require('./asistente-contexto');

const MARGEN = 20;

function mismaEscena(punto, bloque, margen = MARGEN) {
  return punto?.workId === bloque.workId
    && punto.chapter === bloque.chapter
    && Math.abs(punto.paragraph - bloque.paragraph) <= margen;
}

function anotacionesDeEscena(bloque, { notes = [], theories = [] } = {}, point = null) {
  const suyas = lista => lista
    .filter(n => mismaEscena(n.point, bloque))
    .filter(n => !point || antesOIgual(n.point, point))
    .map(n => ({ id: n.id, text: n.text, type: n.type, paragraph: n.point.paragraph }));

  return { notes: suyas(notes), theories: suyas(theories) };
}

function conversacionDeEscena(threads = [], bloque, point = null) {
  const encontrados = [];

  for (const hilo of threads) {
    if (hilo.scope !== bloque.workId) continue;
    for (const mensaje of hilo.messages || []) {
      if (point && mensaje.point && !antesOIgual(mensaje.point, point)) continue;
      const cita = (mensaje.citations || []).some(c => c.ref === bloque.ref);
      if (!cita) continue;
      encontrados.push({ threadId: hilo.id, role: mensaje.role, text: String(mensaje.text || '').slice(0, 400), at: mensaje.at });
    }
  }

  return encontrados.sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 6);
}

function escenaConContexto(bloque, estado, point = null) {
  return {
    ref: bloque.ref,
    chapter: bloque.chapter,
    paragraph: bloque.paragraph,
    text: bloque.text,
    matches: bloque.matches,
    ...anotacionesDeEscena(bloque, estado, point),
    conversacion: conversacionDeEscena(estado?.threads, bloque, point)
  };
}

module.exports = { MARGEN, mismaEscena, anotacionesDeEscena, conversacionDeEscena, escenaConContexto };
