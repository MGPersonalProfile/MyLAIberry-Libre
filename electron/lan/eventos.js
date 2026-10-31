const clientes = new Set();
const LATIDO_MS = 25_000;

function suscribir(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    'X-Content-Type-Options': 'nosniff'
  });
  res.write(': conectado\n\n');

  const latido = setInterval(() => res.write(': latido\n\n'), LATIDO_MS);
  const cliente = { res };
  clientes.add(cliente);
  req.on('close', () => { clearInterval(latido); clientes.delete(cliente); });
}

function emitir(canal, datos) {
  if (!clientes.size) return;
  const linea = `data: ${JSON.stringify({ canal, datos: datos ?? null })}\n\n`;
  for (const c of clientes) {
    try { c.res.write(linea); } catch { clientes.delete(c); }
  }
}

function cerrarTodos() {
  for (const c of clientes) { try { c.res.end(); } catch {  } }
  clientes.clear();
}

module.exports = { suscribir, emitir, cerrarTodos };
