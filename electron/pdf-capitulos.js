const {
  quitarPaginacion, tamDelCuerpo, esTitulo, medidas, empiezaParrafo, unir,
  PALABRAS_POR_PARTE
} = require('./pdf-maquetar.js');

const aTexto = (html) => String(html).replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function bloques(paginas, cuerpo) {
  const salida = [];
  let parrafo = '';
  let anterior = null;
  const cerrar = () => { if (parrafo) salida.push({ tipo: 'p', html: parrafo }); parrafo = ''; };

  paginas.forEach((p, n) => {
    const m = medidas(p, cuerpo);
    p.lineas.forEach((l, i) => {
      if (esTitulo(l, cuerpo)) {
        cerrar();
        const ultimo = salida[salida.length - 1];

        const pegado = anterior && anterior.pagina === n && anterior.y - l.y < l.tam * 3;
        if (ultimo?.tipo === 'h' && pegado && esTitulo(anterior, cuerpo)) ultimo.texto += ' — ' + l.texto;
        else salida.push({ tipo: 'h', texto: l.texto });
      } else {
        if (parrafo && anterior && empiezaParrafo(anterior, l, m, i === 0 && n > 0)) cerrar();
        parrafo = unir(parrafo, l);
      }
      anterior = { ...l, pagina: n };
    });
  });
  cerrar();
  return salida;
}

function trocear(parrafos) {
  const partes = [];
  let actual = null;
  let palabras = 0;
  for (const html of parrafos) {
    if (!actual || palabras >= PALABRAS_POR_PARTE) {
      actual = { title: `Parte ${partes.length + 1}`, parrafos: [] };
      partes.push(actual);
      palabras = 0;
    }
    actual.parrafos.push(html);
    palabras += aTexto(html).split(/\s+/).length;
  }
  return partes;
}

function capitulosDelPdf(paginas) {
  const limpias = quitarPaginacion(paginas);
  const cuerpo = tamDelCuerpo(limpias.flatMap(p => p.lineas));
  const salida = bloques(limpias, cuerpo);

  if (!salida.some(b => b.tipo === 'h')) return trocear(salida.map(b => b.html));

  const capitulos = [];
  let actual = { title: 'Inicio', parrafos: [] };
  for (const b of salida) {
    if (b.tipo === 'h') {
      capitulos.push(actual);
      actual = { title: b.texto, parrafos: [] };
    } else {
      actual.parrafos.push(b.html);
    }
  }
  capitulos.push(actual);

  return capitulos.filter((c, i) => c.parrafos.length &&
    !(i === 0 && c.title === 'Inicio' && aTexto(c.parrafos.join(' ')).length < 400));
}

const htmlDeCapitulo = (c) => c.parrafos.map(p => `<p>${p}</p>`).join('\n');

module.exports = { capitulosDelPdf, htmlDeCapitulo, aTexto };
