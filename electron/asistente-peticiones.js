function crearRegistro(avisar, ahora = () => Date.now()) {
  const vivas = new Map();
  const publicar = (fase, dato) => avisar('asistente-estado-peticion', { fase, ...dato });
  return {
    iniciar({ requestId, scope, threadId = null, texto = '' }) {
      const inicio = ahora();
      const dato = { requestId, scope, threadId, texto: texto.slice(0, 80), inicio, ultimoProgreso: inicio, progreso: null };
      vivas.set(requestId, dato);
      publicar('inicio', dato);
    },
    hilo(requestId, threadId) {
      const dato = vivas.get(requestId);
      if (!dato) return;
      dato.threadId = threadId;
      publicar('hilo', dato);
    },
    progreso(requestId, progreso) {
      const dato = vivas.get(requestId);
      if (!dato) return;
      dato.ultimoProgreso = ahora();
      dato.progreso = progreso;
      publicar('progreso', dato);
    },
    terminar(requestId, { sinLeer = false } = {}) {
      const dato = vivas.get(requestId);
      if (!dato) return;
      vivas.delete(requestId);
      publicar('fin', { ...dato, sinLeer });
    },
    ver(scope) { return [...vivas.values()].filter(p => p.scope === scope).map(p => ({ ...p })); }
  };
}

module.exports = { crearRegistro };
