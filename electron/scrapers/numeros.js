function normalizarSeparadores(texto, conSufijo) {
  if (conSufijo) {

    return texto.replace(',', '.');
  }

  if (/^\d{1,3}([.,]\d{3})+$/.test(texto)) return texto.replace(/[.,]/g, '');

  return texto.replace(',', '.');
}

const SUFIJOS = { k: 1e3, m: 1e6, b: 1e9, g: 1e9 };

function numero(texto, pordefecto = 0) {
  const s = String(texto ?? '')

    .replace(/[  ]/g, ' ')
    .trim();
  if (!s) return pordefecto;

  const MILES = String.raw`\d{1,3}(?:[.,\s]\d{3})+(?!\d)`;
  const SUELTO = String.raw`\d+(?:[.,]\d+)?`;
  const m = s.match(new RegExp(
    `(${MILES}|${SUELTO})\\s*([kKmMbBgG])(?![a-zA-Z])` +
    `|(${MILES}|${SUELTO})`));
  if (!m) return pordefecto;

  const conSufijo = !!m[2];
  const crudo = (conSufijo ? m[1] : m[3]).replace(/\s/g, conSufijo ? '' : '');

  const sinEspacios = crudo.replace(/\s/g, '');
  const valor = parseFloat(normalizarSeparadores(sinEspacios, conSufijo));
  if (!Number.isFinite(valor)) return pordefecto;

  const escala = conSufijo ? SUFIJOS[m[2].toLowerCase()] : 1;
  return Math.round(valor * escala);
}

function dato(etiqueta, texto, pordefecto = 0) {
  const s = String(texto ?? '');
  const e = String(etiqueta).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const detras = s.match(new RegExp(e + '\\s*[:：]?\\s*([\\d.,\\s]*\\d[kKmMbB]?)', 'i'));
  if (detras) {
    const v = numero(detras[1], null);
    if (v !== null) return v;
  }

  const delante = s.match(new RegExp('([\\d.,\\s]*\\d\\s*[kKmMbB]?)\\s*' + e, 'i'));
  if (delante) {
    const v = numero(delante[1], null);
    if (v !== null) return v;
  }

  return pordefecto;
}

module.exports = { numero, dato };
