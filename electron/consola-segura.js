const ROTA = new Set(['EPIPE', 'ERR_STREAM_DESTROYED', 'ERR_STREAM_WRITE_AFTER_END', 'EOF']);

function proteger(flujo) {
  if (!flujo || typeof flujo.on !== 'function' || flujo.__consolaSegura) return;
  flujo.__consolaSegura = true;
  flujo.on('error', (e) => {
    if (e && ROTA.has(e.code)) return;
    setImmediate(() => { throw e; });
  });
}

function protegerConsola() {
  proteger(process.stdout);
  proteger(process.stderr);
}

module.exports = { protegerConsola, ROTA };
