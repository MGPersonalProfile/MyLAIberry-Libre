const fs = require('node:fs');
const path = require('node:path');

function claveDeCapitulo(url) {
  let u = String(url || '');
  try { u = decodeURIComponent(u); } catch {  }
  u = u.split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase();
  const ultimo = u.split('/').pop() || '';
  const id = ultimo.match(/(\d{10,})$/);
  return id ? `id:${id[1]}` : u.replace(/^https?:\/\/(www\.)?/, '');
}

function sonDistintas(lista) {
  return new Set(lista.map(c => claveDeCapitulo(c.url))).size === lista.length;
}

function planDeRealineado(viejo = [], nuevo = []) {

  if (!sonDistintas(viejo) || !sonDistintas(nuevo)) return { mapa: new Map(), huerfanos: [], cambia: false };
  const donde = new Map();
  nuevo.forEach((c, i) => { const k = claveDeCapitulo(c.url); if (!donde.has(k)) donde.set(k, i); });
  const mapa = new Map();
  const huerfanos = [];
  viejo.forEach((c, i) => {
    const a = donde.get(claveDeCapitulo(c.url));
    if (a === undefined) huerfanos.push(i); else mapa.set(i, a);
  });
  const cambia = huerfanos.length > 0 || [...mapa].some(([de, a]) => de !== a);
  return { mapa, huerfanos, cambia };
}

function ficherosDe(dir, indice, todos) {
  const re = new RegExp(`^chapter_${indice}(\\.[a-z]{2,8})?\\.html$`);
  return todos.filter(n => re.test(n));
}

function moverFicheros(dir, { mapa, huerfanos }) {
  let todos;
  try { todos = fs.readdirSync(dir); } catch { return { movidos: 0, apartados: 0 }; }
  const provisionales = [];
  for (const [de, a] of mapa) {
    if (de === a) continue;
    for (const nombre of ficherosDe(dir, de, todos)) {
      const provisional = `realinear_${de}_${nombre}`;
      fs.renameSync(path.join(dir, nombre), path.join(dir, provisional));
      provisionales.push([provisional, nombre.replace(`chapter_${de}`, `chapter_${a}`)]);
    }
  }
  let apartados = 0;
  for (const de of huerfanos) {
    for (const nombre of ficherosDe(dir, de, todos)) {
      const fuera = path.join(dir, 'fuera-del-indice');
      fs.mkdirSync(fuera, { recursive: true });
      fs.renameSync(path.join(dir, nombre), path.join(fuera, `${Date.now()}_${nombre}`));
      apartados++;
    }
  }
  for (const [provisional, definitivo] of provisionales) {
    fs.renameSync(path.join(dir, provisional), path.join(dir, definitivo));
  }
  return { movidos: provisionales.length, apartados };
}

function remapearDatos(obra, mapa, total) {
  const mover = (por) => {
    const nuevo = {};
    for (const [k, v] of Object.entries(por || {})) {
      const a = mapa.get(Number(k));
      if (a !== undefined) nuevo[a] = v;
    }
    return nuevo;
  };
  const actual = Number(obra.currentChapter) || 0;
  return {
    currentChapter: mapa.has(actual) ? mapa.get(actual) : Math.min(actual, Math.max(0, total - 1)),
    scrollPositions: mover(obra.scrollPositions),
    recaps: mover(obra.recaps),
    titulosTraducidos: {}
  };
}

module.exports = { claveDeCapitulo, planDeRealineado, moverFicheros, remapearDatos };
