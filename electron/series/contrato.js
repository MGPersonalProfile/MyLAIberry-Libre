const { deCasa } = require('../asistente-web-libre.js');

function sanitizarUrl(rawUrl, base) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const limpia = rawUrl.trim();
  if (/^(?:javascript|data|vbscript|file):/i.test(limpia)) return null;
  try {
    const u = base ? new URL(limpia, base) : new URL(limpia);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (deCasa(host)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function esSerieValida(s) {
  if (!s || typeof s !== 'object') return false;
  if (!s.nombre || typeof s.nombre !== 'string' || !s.nombre.trim()) return false;
  return true;
}

function normalizarObraDeSerie(o, baseUrl) {
  if (!o || typeof o !== 'object') return null;
  const urlSegura = sanitizarUrl(o.url, baseUrl);
  if (!urlSegura) return null;
  const titulo = (o.titulo || o.title || '').replace(/\s+/g, ' ').trim() || 'Sin título';
  const posNum = Number(o.posicion ?? o.position ?? o.parte ?? o.part);
  const posicion = Number.isInteger(posNum) && posNum > 0 ? posNum : null;
  return {
    url: urlSegura,
    titulo,
    posicion,
    ...(o.id ? { id: String(o.id) } : {})
  };
}

function normalizarSerie(s, baseUrl) {
  if (!esSerieValida(s)) {
    throw new Error('El objeto no contiene los campos mínimos de una serie válida.');
  }
  const nombre = s.nombre.replace(/\s+/g, ' ').trim();
  const url = sanitizarUrl(s.url, baseUrl) || (baseUrl ? sanitizarUrl(baseUrl) : null) || '';
  const fuente = s.fuente || 'General';
  const id = s.id ? String(s.id) : `${fuente.toLowerCase()}_${nombre.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
  const numParte = Number(s.parte ?? s.part ?? s.posicion);
  const parte = Number.isInteger(numParte) && numParte > 0 ? numParte : null;
  const ordenConocido = typeof s.ordenConocido === 'boolean' ? s.ordenConocido : (parte !== null);

  const rawObras = Array.isArray(s.obras) ? s.obras : [];
  const obras = rawObras.map(o => normalizarObraDeSerie(o, url || baseUrl)).filter(Boolean);

  return {
    id,
    fuente,
    nombre,
    url,
    parte,
    ordenConocido,
    parcial: Boolean(s.parcial),
    ...(s.totalObras !== undefined && s.totalObras !== null ? { totalObras: Number(s.totalObras) } : {}),
    ...(s.error ? { error: String(s.error) } : {}),
    obras
  };
}

function describirSerie(s) {
  if (!s || !s.nombre) return '';
  return s.parte ? `Parte ${s.parte} de «${s.nombre}»` : `De la serie «${s.nombre}»`;
}

module.exports = {
  sanitizarUrl,
  esSerieValida,
  normalizarObraDeSerie,
  normalizarSerie,
  describirSerie
};
