const URL_EN_TEXTO = /https?:\/\/[^\s<>()[\]"'«»]+/gi;

function normal(url) {
  return String(url).toLowerCase()
    .replace(/[.,;:!?]+$/, '')
    .replace(/^http:\/\//, 'https://')
    .replace(/^https:\/\/(www\.|m\.)/, 'https://')
    .replace(/\/+$/, '');
}

const enlacesDe = (texto) => [...String(texto || '').matchAll(URL_EN_TEXTO)].map(m => normal(m[0]));

function enlacesInventados(respuesta, mensajes) {
  const conocidos = new Set(mensajes.flatMap(m => enlacesDe(typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? ''))));
  const conocido = (u) => conocidos.has(u) || [...conocidos].some(k => k.startsWith(u + '/') || u.startsWith(k + '/'));
  return [...new Set(enlacesDe(respuesta))].filter(u => !conocido(u));
}

const CORRECCION_ENLACES = (inventados) => '[Aviso del sistema, no del usuario] Tu respuesta tiene enlaces que no ha devuelto ' +
  `ninguna herramienta ni están en la conversación: ${inventados.join(', ')}. No se inventan ni se deducen direcciones ` +
  '(tampoco cambiando el sitio de otra). Quítalos, o compruébalos con buscar_obras y usa la dirección que devuelva; ' +
  'rehaz la respuesta.';

module.exports = { enlacesInventados, CORRECCION_ENLACES };
