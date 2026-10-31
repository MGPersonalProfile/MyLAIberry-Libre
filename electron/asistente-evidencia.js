const PARTICIPIO = '(?:apuntad|anotad|a[ñn]adid|completad|actualizad|registrad|incorporad|guardad)[oa]s?';

const FIN = '(?![\\wáéíóúüñ])';
const AFIRMA_HECHO = new RegExp(
  '\\b(?:he|hemos|est[aá]n?|qued[oó]|queda(?:n)?)' + FIN + '[^.!?\\n]{0,30}\\b' + PARTICIPIO + FIN
  + '|\\b(?:apunt[eé]|anot[eé]|a[ñn]ad[ií]|guard[eé]|actualic[eé]|registr[eé]|incorpor[eé])' + FIN

  + '|^\\W*(?:hecho\\W+)?' + PARTICIPIO + '\\b', 'i');

function guardadoSinEvidencia(texto, { actions = [], recuenta = false } = {}) {
  if (recuenta) return null;
  const frases = String(texto || '').split(/(?<=[.!?\n])/)
    .filter(f => !/[?¿]/.test(f) && !/\b(?:no|nunca|todavía|aún|si|puedo|podría)\b/i.test(f));
  const hay = nombres => actions.some(a => a.ok && nombres.includes(a.name));
  for (const f of frases) {
    if (!AFIRMA_HECHO.test(f)) continue;
    if (/\b(?:buz[oó]n|nota|encargo)\b/i.test(f)
      && !hay(['anotar_idea', 'ideas_apuntadas'])) return 'anotar_idea';
    if (/\b(?:investigaci[oó]n|historia perdida|pistas)\b/i.test(f)
      && !hay(['investigar', 'actualizar_investigacion', 'investigaciones'])) return 'actualizar_investigacion';
  }
  return null;
}

module.exports = { guardadoSinEvidencia };
