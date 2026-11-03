const LIMITE_WEB = /máximo de \d+ pasos|investigación limitada a \d+ páginas|Este turno ya abrió \d+ de \d+ páginas|Como mucho \d+ páginas por respuesta/i;

function anotarAvance(avance, nombre, resultado, argumentos) {

  const errores = [resultado?.error, ...(Array.isArray(resultado?.errores) ? resultado.errores : [])].filter(Boolean).map(String);
  const conLimite = errores.find(e => LIMITE_WEB.test(e));
  if (resultado?.agotado || conLimite) {
    avance.limiteWeb = String(conLimite || resultado?.error || 'Se agotó la capacidad de investigación de este turno.');
  }
  if (resultado?.error) return;
  if (nombre === 'preparar_obra' && resultado?.importadaAhora === true) {
    let url = '';
    try { url = JSON.parse(argumentos).url || ''; } catch {  }
    avance.importadas.push({ titulo: String(resultado.title || resultado.id || 'obra sin título').slice(0, 150), url });
  }
  if (nombre === 'abrir_ficha_web' && resultado?.title && resultado?.url) {
    avance.fichas.push({ titulo: String(resultado.title).slice(0, 150), url: resultado.url });
  }
}

function unicas(lista, clave) {
  return [...new Map(lista.map(x => [x[clave], x])).values()];
}

function resumenLimite(motivo, { acciones, vistas, pendientes, avance }) {
  const importadas = unicas(avance.importadas, 'url');
  const urls = new Set(importadas.map(o => o.url));
  const fichas = unicas(avance.fichas, 'url');
  const candidatas = unicas(vistas.filter(o => o.url && !urls.has(o.url)), 'url');
  const nombres = lista => lista.slice(0, 12).map(o => `«${o.titulo}»`).join(', ') +
    (lista.length > 12 ? ` y ${lista.length - 12} más` : '');
  const cantidad = (n, una, varias) => `${n} ${n === 1 ? una : varias}`;
  const partes = [`He alcanzado el límite de ${motivo}; no he completado toda la petición. Hice ${acciones.length} consultas o acciones.`];
  partes.push(importadas.length ? `Ya he importado ${cantidad(importadas.length, 'obra', 'obras')}: ${nombres(importadas)}.` : 'No he importado ninguna obra en este turno.');
  if (fichas.length) partes.push(`He confirmado ${cantidad(fichas.length, 'ficha', 'fichas')}: ${nombres(fichas)}.`);
  if (candidatas.length) partes.push(`${candidatas.length === 1 ? 'Queda' : 'Quedan'} ${cantidad(candidatas.length, 'candidata localizada', 'candidatas localizadas')} por revisar o importar: ${nombres(candidatas)}.`);
  else partes.push('Queda por comprobar si hay más candidatas y completar el encargo.');
  if (pendientes.length) partes.push(`Hay ${cantidad(pendientes.length, 'acción', 'acciones')} esperando tu confirmación en este chat.`);
  partes.push('Puedes pedirme «sigue» en esta misma conversación para continuar con lo pendiente.');
  return partes.join(' ');
}

module.exports = { anotarAvance, resumenLimite };
