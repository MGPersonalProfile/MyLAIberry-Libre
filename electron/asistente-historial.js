const { validarPunto } = require('./asistente-contexto');

function prepararHistorial(hilos, pendientes = []) {
  const { CADUCIDAD } = require('./asistente-app-ejecutar');
  return hilos.map(h => ({ ...h, messages: h.messages.map(m => ({ ...m,
    pendientes: (m.pendientes || []).map(p => {
      if (p.estado) return { ...p, estado: p.estado === 'falló' ? 'error' : p.estado };
      const viva = pendientes.find(x => x.id === p.id && Date.now() - x.at < CADUCIDAD);
      return { ...p, estado: viva ? 'pendiente' : 'error', ...(!viva ? { error: 'Esta confirmación ya no está disponible. Pídela de nuevo si la necesitas.' } : {}) };
    })
  })) }));
}

async function borrarConversacion({ state, running, id, point }) {
  if (point) validarPunto(point);
  const scope = point ? point.workId : 'library';

  if ([...running.keys()].some(k => k.startsWith(`${scope}|`) && k.endsWith(`|${id}`))) {
    throw new Error('Espera a que termine la respuesta antes de borrar esta conversación.');
  }
  await state.update(s => {
    const hilo = s.threads.find(t => t.id === id && t.scope === scope);
    if (!hilo) throw new Error('No se encuentra esa conversación en este espacio.');
    s.threads = s.threads.filter(t => t.id !== id);

    s.pendientes = s.pendientes.filter(p => p.hilo !== id);
    s.undo = s.undo.filter(u => u.hilo !== id);
  });
  return { borrada: id };
}

module.exports = { borrarConversacion, prepararHistorial };
