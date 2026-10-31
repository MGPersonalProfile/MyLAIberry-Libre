const { textoPlano } = require('./capitulo-valido.js');

const plano = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ');

function fragmento(texto, i, largo) {
  const desde = Math.max(0, i - 120);
  return (desde ? '…' : '') + texto.slice(desde, i + largo + 120).trim() + '…';
}

function buscarEnCapitulos(capitulos, buscado, { maximo = 15 } = {}) {
  const aguja = plano(buscado).trim();
  const apariciones = [];
  for (const c of capitulos) {
    if (!c.html || !aguja) continue;
    const texto = textoPlano(c.html);
    const pajar = plano(texto);
    const primera = pajar.indexOf(aguja);
    if (primera < 0) continue;
    const veces = pajar.split(aguja).length - 1;

    apariciones.push({ capitulo: c.numero, veces, fragmento: fragmento(texto, primera, aguja.length) });
  }
  return {
    revisados: capitulos.filter(c => c.html).length,
    capitulosConElTexto: apariciones.length,
    apariciones: apariciones.slice(0, maximo),
    ...(apariciones.length > maximo ? { masAllaDeEstos: apariciones.slice(maximo).map(a => a.capitulo) } : {})
  };
}

function buscarEnLaCarpeta(dir, buscado, hasta, { rutaTraduccion, idioma, maximo = 30 } = {}) {
  const fs = require('node:fs');
  const path = require('node:path');
  const leer = (f) => { try { return fs.readFileSync(f, 'utf-8'); } catch { return ''; } };
  const apariciones = [];
  let revisados = 0;
  for (let i = 0; i < hasta; i++) {
    const traducido = idioma && rutaTraduccion ? leer(rutaTraduccion(dir, i, idioma)) : '';
    const original = leer(path.join(dir, `chapter_${i}.html`));
    if (!traducido && !original) continue;
    revisados++;
    const en = (html) => html ? buscarEnCapitulos([{ numero: i + 1, html }], buscado).apariciones[0] : null;
    const hallada = en(traducido) || en(original);
    if (hallada) apariciones.push({ ...hallada, indice: i });
  }
  return {
    revisados,
    capitulosConElTexto: apariciones.length,
    apariciones: apariciones.slice(0, maximo),
    ...(apariciones.length > maximo ? { masAllaDeEstos: apariciones.length - maximo } : {})
  };
}

module.exports = { buscarEnCapitulos, buscarEnLaCarpeta };
