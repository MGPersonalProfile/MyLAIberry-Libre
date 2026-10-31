const PALABRAS = {
  es: ['q', 'k', 'xq', 'pq', 'el', 'la', 'los', 'las', 'que', 'de', 'y', 'es', 'por', 'para', 'con', 'una', 'un', 'me', 'mi', 'cuantos', 'cuántos', 'he', 'lo', 'se', 'no', 'del', 'al', 'como', 'cómo', 'esta', 'está', 'pero', 'ya', 'hay', 'dime', 'quiero', 'tengo', 'voy', 'leido', 'leído'],
  en: ['the', 'a', 'an', 'and', 'is', 'are', 'of', 'to', 'in', 'what', 'how', 'many', 'have', 'i', 'my', 'me', 'it', 'you', 'do', 'does', 'this', 'that', 'with', 'for', 'on', 'can', 'read', 'which', 'did'],
  pt: ['o', 'os', 'as', 'que', 'de', 'e', 'é', 'eu', 'um', 'uma', 'não', 'nao', 'você', 'voce', 'quantos', 'quantas', 'li', 'tenho', 'do', 'da', 'dos', 'das', 'no', 'na', 'em', 'meu', 'minha', 'isso', 'esse', 'essa', 'já', 'ja', 'mais', 'muito', 'lê', 'ler'],
  fr: ['le', 'la', 'les', 'des', 'est', 'et', 'je', 'j', 'un', 'une', 'du', 'ne', 'pas', 'combien', 'ai', 'mon', 'ma', 'mes', 'que', 'qui', 'quoi', 'vous', 'tu', 'avec', 'pour', 'dans', 'sur', 'lu', 'ce', 'cette'],
  it: ['il', 'lo', 'la', 'gli', 'le', 'che', 'di', 'e', 'è', 'un', 'una', 'non', 'quanti', 'quante', 'ho', 'letto', 'mio', 'mia', 'per', 'con', 'del', 'della', 'sono', 'questo', 'questa', 'cosa', 'come'],
  de: ['der', 'die', 'das', 'und', 'ist', 'ich', 'nicht', 'ein', 'eine', 'wie', 'viele', 'habe', 'mein', 'meine', 'was', 'mit', 'für', 'von', 'zu', 'den', 'dem', 'gelesen', 'du', 'es']
};

const IMPERATIVO_ES = /^(?:borra|busca|trae|pon|di|da|haz|quita|abre|deja|saca|mete|marca|cambia|sube|baja|recuerda|explica|cuenta|ense[nñ]a|lee|traduce|resume|descarga|importa|exporta|sigue|vigila|apunta|olvida|guarda|mira|avisa)(?:me|te|nos|lo|la|los|las|le|les|melo|mela|selo|sela)$/;
const PESO_IMPERATIVO = 3;

const NOMBRES = { es: 'español', en: 'inglés', pt: 'portugués', fr: 'francés', it: 'italiano', de: 'alemán' };

function idiomaDe(texto) {

  const sinCitas = String(texto || '').replace(/"[^"]*"|“[^”]*”|«[^»]*»/g, ' ');
  const base = sinCitas.trim().split(/\s+/).length >= 3 ? sinCitas : String(texto || '');
  const palabras = base.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  if (palabras.length < 3) return null;
  const sinTildes = (p) => p.normalize('NFD').replace(/\p{M}/gu, '');
  const imperativos = palabras.filter(p => !PALABRAS.es.includes(p) && IMPERATIVO_ES.test(sinTildes(p))).length * PESO_IMPERATIVO;
  const cuentas = Object.entries(PALABRAS).map(([id, lista]) => [id, palabras.filter(p => lista.includes(p)).length + (id === 'es' ? imperativos : 0)])
    .sort((a, b) => b[1] - a[1]);
  const [[primero, n], [, segundo]] = cuentas;
  return n >= 2 && n > segundo ? primero : null;
}

function avisoDeIdioma(texto) {
  const id = idiomaDe(texto);
  return id ? `\nEl último mensaje del usuario está escrito en ${NOMBRES[id]}: contéstale en ${NOMBRES[id]}, aunque todo lo demás esté en español. ` : '';
}

module.exports = { idiomaDe, avisoDeIdioma };
