const { pasar } = require('./asistente-ejecucion-estado');

function reconciliar(s, ahora) {
  const relanzar = [], cambiadas = [];
  for (const e of s.ejecuciones || []) {
    if (e.estado === 'ejecutando') {
      pasar(e, 'interrumpida', { error: { tipo: 'caida-del-servidor', mensaje: 'El servidor se reinició mientras investigaba. Los resultados que ya se habían guardado se conservan; puedes reintentar.' } }, ahora);
      cambiadas.push(e.id);
    } else if (e.estado === 'cancelando') { pasar(e, 'cancelada', {}, ahora); cambiadas.push(e.id); }
    else if (e.estado === 'pendiente') relanzar.push(e.id);
  }
  return { relanzar, cambiadas };
}

module.exports = { reconciliar };
