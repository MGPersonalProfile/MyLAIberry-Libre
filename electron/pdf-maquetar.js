const FRANJA = 0.09;
const REPETIDA = 0.3;
const TITULO_MAYOR = 1.25;
const PALABRAS_POR_PARTE = 6000;

const PALABRA_DE_TITULO = /^(cap[ií]tulo|chapter|parte|part|pr[oó]logo|prologue|ep[ií]logo|epilogue|interludio|interlude|libro|book)\b/i;
const NUMERO_SUELTO = /^[\divxlc\s.–—-]+$/i;
const CIERRE = /[.!?…»”"')\]]$/;

const escapar = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sinNumeros = (t) => t.replace(/\d+/g, '#').toLowerCase();
const mediana = (xs) => {
  if (!xs.length) return 0;
  const o = [...xs].sort((a, b) => a - b);
  return o[Math.floor(o.length / 2)];
};

const enFranja = (linea, alto) => linea.y > alto * (1 - FRANJA) || linea.y < alto * FRANJA;

function quitarPaginacion(paginas) {
  const cuenta = new Map();
  for (const p of paginas) {
    const vistas = new Set(p.lineas.filter(l => enFranja(l, p.alto)).map(l => sinNumeros(l.texto)));
    for (const t of vistas) cuenta.set(t, (cuenta.get(t) || 0) + 1);
  }
  const minimo = Math.max(2, Math.ceil(paginas.length * REPETIDA));
  return paginas.map(p => ({
    ...p,
    lineas: p.lineas.filter(l => {
      if (!enFranja(l, p.alto)) return true;
      if (NUMERO_SUELTO.test(l.texto) && l.texto.length <= 12) return false;
      return (cuenta.get(sinNumeros(l.texto)) || 0) < minimo;
    })
  }));
}

function tamDelCuerpo(lineas) {
  const peso = new Map();
  for (const l of lineas) peso.set(l.tam, (peso.get(l.tam) || 0) + l.texto.length);
  return [...peso.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 11;
}

const esTitulo = (l, cuerpo) =>
  l.texto.length <= 90 && (l.tam >= cuerpo * TITULO_MAYOR || PALABRA_DE_TITULO.test(l.texto));

function medidas(pagina, cuerpo) {
  const deCuerpo = pagina.lineas.filter(l => Math.abs(l.tam - cuerpo) < 0.6);
  const huecos = [];
  for (let i = 1; i < deCuerpo.length; i++) huecos.push(deCuerpo[i - 1].y - deCuerpo[i].y);
  const xs = deCuerpo.map(l => Math.round(l.x));
  return {
    margen: xs.length ? Math.min(...xs) : 0,
    interlineado: mediana(huecos.filter(h => h > 0)) || cuerpo * 1.2,
    llena: mediana(deCuerpo.map(l => l.texto.length)) || 60
  };
}

function empiezaParrafo(a, b, m, cambioDePagina) {
  const sangrada = b.x > m.margen + b.tam * 0.8;
  const cortaYCerrada = a.texto.length < m.llena * 0.75 && CIERRE.test(a.texto);
  if (cambioDePagina) return sangrada || cortaYCerrada;
  const hueco = a.y - b.y > m.interlineado * 1.5;
  return hueco || sangrada || cortaYCerrada;
}

function htmlDeLinea(linea) {
  let html = '';
  let enCursiva = false;
  for (const t of linea.trozos) {
    if (t.cursiva !== enCursiva) { html += t.cursiva ? '<em>' : '</em>'; enCursiva = t.cursiva; }
    html += escapar(t.texto);
  }

  return (enCursiva ? html + '</em>' : html).replace(/\s+/g, ' ')
    .replace(/<em> /g, ' <em>').replace(/ <\/em>/g, '</em> ').replace(/<em><\/em>/g, '').trim();
}

function unir(parrafo, linea) {
  const html = htmlDeLinea(linea);
  if (!parrafo) return html;
  if (/\p{L}-(<\/em>)?$/u.test(parrafo) && /^(<em>)?\p{Ll}/u.test(html)) {
    return parrafo.replace(/-(<\/em>)?$/, '$1') + html;
  }
  return parrafo + ' ' + html;
}

module.exports = {
  quitarPaginacion, tamDelCuerpo, esTitulo, medidas, empiezaParrafo, unir, escapar,
  PALABRAS_POR_PARTE
};
