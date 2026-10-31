const { createHash } = require('node:crypto');

const MINIMO = 40;
const ARMAZON = 300;

const VACIAS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

const ETIQUETA = /<!--[\s\S]*?-->|<(\/?)([a-z][a-z0-9-]*)(?=[\s/>])((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;

const esOculto = (atributos) => /(?:^|\s)hidden(?=\s|=|\/|$)/i.test(atributos.replace(/"[^"]*"|'[^']*'/g, '""'));

function sinOculto(html) {
  const s = String(html || '');
  if (!/hidden/i.test(s)) return s;
  let fuera = '';
  let desde = 0;
  const et = new RegExp(ETIQUETA.source, 'gi');
  let m;
  while ((m = et.exec(s))) {
    if (!m[2] || m[1] || !esOculto(m[3])) continue;
    fuera += s.slice(desde, m.index);
    desde = et.lastIndex;
    const nombre = m[2].toLowerCase();
    if (VACIAS.has(nombre) || /\/\s*$/.test(m[3])) continue;
    const mismo = new RegExp(`<!--[\\s\\S]*?-->|<(\\/?)(${nombre})(?=[\\s/>])(?:[^>"']|"[^"]*"|'[^']*')*>`, 'gi');
    mismo.lastIndex = desde;
    let nivel = 1;
    let c;
    while (nivel && (c = mismo.exec(s))) if (c[2]) nivel += c[1] ? -1 : (/\/>$/.test(c[0]) ? 0 : 1);
    if (!nivel) { desde = mismo.lastIndex; et.lastIndex = desde; }
  }
  return fuera + s.slice(desde);
}

function textoPlano(html) {
  return sinOculto(html)
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ').trim();
}

const huella = (texto) => createHash('sha1').update(texto).digest('hex');

function exigirCapitulo(html, { anterior = null } = {}) {
  const texto = textoPlano(html);

  const imagenes = sinOculto(html).match(/<(?:img|iframe)\b[^>]*\bsrc=["'](?!\s*(?:javascript|vbscript|data):)[^"']+["']/gi) || [];
  if (texto.length < MINIMO && imagenes.length) return huella(`imagen:${imagenes.join('|')}`);
  if (texto.length < MINIMO) {
    throw Object.assign(new Error(`El capítulo llegó sin texto (${texto.length} caracteres); no se guarda.`), { capituloInvalido: true });
  }

  if (texto.length < ARMAZON && /©|all rights reserved|todos los derechos reservados/i.test(texto)) {
    throw Object.assign(new Error(`El capítulo es sólo la cabecera y el pie de la web; no se guarda: «${texto.slice(0, 80)}»`), { capituloInvalido: true });
  }
  const esta = huella(texto);
  if (anterior && esta === anterior) {
    throw Object.assign(new Error(`El capítulo es idéntico al anterior —suele ser la cabecera de la web o un muro de pago—; no se guarda: «${texto.slice(0, 80)}»`), { capituloInvalido: true });
  }
  return esta;
}

module.exports = { exigirCapitulo, textoPlano, sinOculto, huella, MINIMO };

const SPAN_SUELTO = /<span class="[^"]*">\s*<br\s*\/?>\s*([^<]{15,300}?)\s*<br\s*\/?>\s*<\/span>/gi;
const VOCABULARIO_ANTIRROBO = /amazon|royal ?road|stolen|pilfer|lifted|purloin|misappropriat|without (?:the author'?s? )?(?:permission|authori[sz]ation|consent)|unauthori[sz]ed|unlawful|illicit|infringement|report (?:the|any|it|this)|taken from|robad|malversad|sin (?:el )?(?:permiso|autorizaci[oó]n|consentimiento)|il[ií]cit|ilegal|infracci[oó]n|den[uú]nci|inform[ea] (?:de )?cualquier/i;

function ocultarAntirrobo(html) {
  return String(html || '').replace(SPAN_SUELTO, (entero, frase) => (VOCABULARIO_ANTIRROBO.test(frase)
    ? entero.replace(/^(<span class="[^"]*")>/i, '$1 hidden="">')
    : entero));
}

module.exports.ocultarAntirrobo = ocultarAntirrobo;
