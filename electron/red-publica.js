const MAX_SALTOS_DEFECTO = 5;

function urlPublica(cruda, base) {
  if (typeof cruda !== 'string' || !cruda.trim()) return '';
  try {
    const resuelta = base ? new URL(cruda.trim(), base).href : cruda.trim();
    return require('./asistente-web-libre.js').comprobarForma(resuelta).href;
  } catch {
    return '';
  }
}

async function pedirPublico(url, { pedir, navegador = false, resolver, maxSaltos = MAX_SALTOS_DEFECTO, soloHttps = false, ...opciones } = {}) {
  const libre = require('./asistente-web-libre.js');
  const ua = require('./user-agent.js');
  const llamar = pedir || ((u, o) => (navegador ? ua.fetchElectron(u, o) : ua.fetchWeb(u, o)));
  let actual = String(url);
  for (let salto = 0; salto <= maxSaltos; salto++) {
    const u = await libre.comprobarDestino(actual, resolver);
    if (soloHttps && u.protocol !== 'https:') throw new Error(`${u.hostname} · sólo https`);
    const r = await llamar(u.href, {
      ...opciones,
      credentials: 'omit',
      redirect: maxSaltos > 0 ? 'manual' : 'error'
    });
    const destino = r.status >= 300 && r.status < 400 && r.headers?.get?.('location');
    if (!destino) return r;
    await r.body?.cancel?.();
    if (salto >= maxSaltos) throw new Error(maxSaltos === 0 ? 'Redirección no permitida.' : 'Demasiadas redirecciones.');
    actual = new URL(destino, u.href).href;
  }
  throw new Error('Demasiadas redirecciones.');
}

module.exports = { urlPublica, pedirPublico, MAX_SALTOS_DEFECTO };
