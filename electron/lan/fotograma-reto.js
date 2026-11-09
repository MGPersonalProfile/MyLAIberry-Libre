const MAXIMO = 400 * 1024;
const ESTADOS = { 'no-autorizado': 403, 'pausado': 429, 'sin-reto': 404, 'caducado': 410, 'sin-sesion': 409, 'ventana-destruida': 410 };
const SIN_CACHE = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache', 'X-Content-Type-Options': 'nosniff' };

async function servirFotograma(req, res, id, url, ctx, { json, drenar }) {
  const no = async (estado, error, extra = {}) => {
    await drenar(req);
    res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8', ...SIN_CACHE, ...extra });
    res.end(JSON.stringify({ error, ...(extra.codigo ? { codigo: extra.codigo } : {}) }));
  };
  void json;
  if (req.method !== 'GET') return no(405, 'Sólo GET.', { Allow: 'GET' });
  if (!ctx.codigoLan) return no(403, 'Esta ruta necesita el código de acceso del móvil.');
  if (!ctx.retoRemoto) return no(404, 'No hay control remoto en este servidor.');
  if (!/^[\w-]{1,80}$/.test(id)) return no(400, 'Reto no válido.');
  const token = String(req.headers['x-reto-token'] || '');
  const ultimo = Number(url.searchParams.get('ultimo'));
  try {
    const f = await ctx.retoRemoto.fotograma(id, { token }, { ultimo: Number.isSafeInteger(ultimo) ? ultimo : null });
    const cabeceras = { ...SIN_CACHE, 'X-Fotograma-Id': String(f.id), 'X-Viewport': `${f.viewport.w}x${f.viewport.h}`, 'X-Cadencia-Ms': String(f.cadenciaMs) };
    if (f.igual) { res.writeHead(204, cabeceras); res.end(); return; }
    if (f.jpeg.length > MAXIMO) return no(413, 'La imagen es demasiado grande.');
    res.writeHead(200, { ...cabeceras, 'Content-Type': 'image/jpeg', 'Content-Length': f.jpeg.length });
    res.end(f.jpeg);
  } catch (e) {

    const codigo = ESTADOS[e.codigo] ? e.codigo : 'sin-sesion';
    return no(ESTADOS[codigo], e.codigo ? String(e.message) : 'No se pudo capturar.', { codigo, ...(codigo === 'pausado' ? { 'Retry-After': '60' } : {}) });
  }
}

module.exports = { servirFotograma, MAXIMO };
