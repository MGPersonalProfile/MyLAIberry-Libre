const fs = require('node:fs');
const path = require('node:path');
const { repetidosDeLaCarpeta } = require('./capitulos-repetidos.js');
const { exigirCapitulo } = require('./capitulo-valido.js');

function planDeReparacion(dir, n) {
  const r = repetidosDeLaCarpeta(dir, n);
  const vacios = [], faltan = [];
  for (let i = 0; i < n; i++) {
    let html;
    try { html = fs.readFileSync(path.join(dir, `chapter_${i}.html`), 'utf-8'); } catch { faltan.push(i + 1); continue; }
    try { exigirCapitulo(html); } catch (e) { if (e.capituloInvalido) vacios.push(i + 1); }
  }
  const duplicados = r.repetidos.filter(p => p.identicos).map(p => p.capitulos);
  const aRehacer = [...new Set([...vacios, ...duplicados.flat()])].sort((a, b) => a - b);
  return {
    aRehacer, vacios, duplicados, faltan,
    soloAviso: { parecidos: r.repetidos.filter(p => !p.identicos), conTramosRepetidos: r.conTramosRepetidos }
  };
}

function apartarCapitulos(dir, numeros, ahora = Date.now()) {
  const todos = fs.readdirSync(dir);
  const carpeta = path.join(dir, 'reparados');
  let apartados = 0;
  for (const numero of numeros) {
    const re = new RegExp(`^chapter_${numero - 1}(\\.[a-z]{2,8})?\\.html$`);
    for (const nombre of todos.filter(n => re.test(n))) {
      fs.mkdirSync(carpeta, { recursive: true });
      fs.renameSync(path.join(dir, nombre), path.join(carpeta, `${ahora}_${nombre}`));
      apartados++;
    }
  }
  return { apartados, carpeta };
}

module.exports = { planDeReparacion, apartarCapitulos };
