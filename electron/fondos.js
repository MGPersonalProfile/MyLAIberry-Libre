const { limpiarNombreFandom } = require('./etiquetas.js');

const AGENTE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 MyLAIberry/1.0';

const ANCHO_MINIMO = 1200;
const PROPORCION_MINIMA = 1.6;

const limpiarFandom = limpiarNombreFandom;

function medirImagen(buf) {
  if (buf.length < 24) return null;

  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return { ancho: buf.readUInt32BE(16), alto: buf.readUInt32BE(20), tipo: 'png' };
  }
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xFF) { i++; continue; }
      const marca = buf[i + 1];
      if (marca >= 0xC0 && marca <= 0xCF && marca !== 0xC4 && marca !== 0xC8 && marca !== 0xCC) {
        return { alto: buf.readUInt16BE(i + 5), ancho: buf.readUInt16BE(i + 7), tipo: 'jpg' };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') {
    const bloque = buf.slice(12, 16).toString('ascii');

    if (bloque === 'VP8X') {
      return {
        ancho: 1 + buf.readUIntLE(24, 3),
        alto: 1 + buf.readUIntLE(27, 3),
        tipo: 'webp'
      };
    }

    if (bloque === 'VP8 ') {

      if (buf.length >= 30 && buf[23] === 0x9d && buf[24] === 0x01 && buf[25] === 0x2a) {
        return {
          ancho: buf.readUInt16LE(26) & 0x3fff,
          alto: buf.readUInt16LE(28) & 0x3fff,
          tipo: 'webp'
        };
      }
    }
    if (bloque === 'VP8L' && buf.length >= 25 && buf[20] === 0x2f) {

      const bits = buf.readUInt32LE(21);
      return {
        ancho: (bits & 0x3fff) + 1,
        alto: ((bits >> 14) & 0x3fff) + 1,
        tipo: 'webp'
      };
    }
  }
  return null;
}

function valeDeFondo(medida) {
  if (!medida || !medida.ancho || !medida.alto) return false;
  return medida.ancho >= ANCHO_MINIMO && (medida.ancho / medida.alto) >= PROPORCION_MINIMA;
}

async function traerYMedir(url, fuente) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': AGENTE }, signal: AbortSignal.timeout(25000) });
    if (!r.ok) return null;

    const buf = Buffer.from(await r.arrayBuffer());
    const medida = medirImagen(buf);
    if (!valeDeFondo(medida)) return null;

    return { buf, url, fuente, ...medida };
  } catch {
    return null;
  }
}

const CONSULTA_ANILIST = `
query ($busqueda: String) {
  Page(perPage: 6) {
    media(search: $busqueda, sort: SEARCH_MATCH) {
      title { romaji english }
      bannerImage
    }
  }
}`;

async function buscarEnAniList(fandom) {
  try {
    const r = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query: CONSULTA_ANILIST, variables: { busqueda: fandom } }),
      signal: AbortSignal.timeout(20000)
    });
    if (!r.ok) return [];

    const datos = await r.json();
    return (datos?.data?.Page?.media || [])
      .map(m => m.bannerImage)
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function buscarEnWiki(fandom) {
  const subdominio = fandom.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (subdominio.length < 3) return [];

  const api = `https://${subdominio}.fandom.com/api.php`
    + `?action=query&generator=images&titles=${encodeURIComponent(fandom)}`
    + '&gimlimit=30&prop=imageinfo&iiprop=url|size&format=json';

  try {
    const r = await fetch(api, { headers: { 'User-Agent': AGENTE }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) return [];

    const datos = await r.json();
    return Object.values(datos?.query?.pages || {})
      .map(p => p.imageinfo?.[0])

      .filter(i => i && i.width >= ANCHO_MINIMO && (i.width / i.height) >= PROPORCION_MINIMA)
      .sort((a, b) => b.width - a.width)
      .map(i => i.url);
  } catch {
    return [];
  }
}

const MOTORES_DE_IMAGENES = [
  {
    nombre: 'bing',
    url: (q) => 'https://www.bing.com/images/search?q='
      + encodeURIComponent(`${q} wallpaper`)
      + '&qft=+filterui:imagesize-wallpaper',
    espera: 7000,
    lector: [
      '(() => {',
      '  const salida = [];',
      '  for (const a of document.querySelectorAll("a.iusc")) {',
      '    try {',
      '      const d = JSON.parse(a.getAttribute("m"));',
      '      // El titulo y la pagina de origen van en el mismo JSON, y son lo',
      '      // que permite saber si el resultado tiene algo que ver.',
      '      if (d && d.murl) salida.push({ url: d.murl, titulo: d.t || "", pagina: d.purl || "" });',
      '    } catch (e) { /* ese resultado no trae json */ }',
      '  }',
      '  return salida.slice(0, 15);',
      '})()'
    ].join('\n')
  }
];

function pareceDelFandom(fandom, resultado) {
  const donde = `${resultado.titulo || ''} ${resultado.pagina || ''}`.toLowerCase();
  if (!donde.trim()) return false;

  const normalizar = (s) => s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');

  const dondeLimpio = normalizar(donde);
  const palabras = normalizar(fandom).split(/\s+/).filter(Boolean);

  const significativas = palabras.filter(p => p.length >= 5 && !/^\d+$/.test(p));

  if (significativas.length === 0) {

    return dondeLimpio.includes(normalizar(fandom).trim());
  }
  return significativas.some(p => dondeLimpio.includes(p));
}

async function buscarEnImagenes(fandom, motores = MOTORES_DE_IMAGENES) {
  const { BrowserWindow } = require('electron');
  const urls = [];

  for (const motor of motores) {
    const win = new BrowserWindow({
      width: 1400, height: 900, show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });

    try {

      await win.loadURL(motor.url(fandom)).catch(() => {});
      await new Promise(r => setTimeout(r, motor.espera || 5000));

      const encontradas = await win.webContents.executeJavaScript(motor.lector);
      if (Array.isArray(encontradas)) {

        urls.push(...encontradas.filter(r => pareceDelFandom(fandom, r)).map(r => r.url));
      }
    } catch {

    } finally {
      if (!win.isDestroyed()) win.destroy();
    }

    if (urls.length >= 10) break;
  }

  return urls;
}

async function buscarFondos(nombreCrudo, { cuantos = 4, motores = MOTORES_DE_IMAGENES } = {}) {
  const fandom = limpiarFandom(nombreCrudo);
  if (!fandom || fandom.length < 2) return { fandom, imagenes: [], escalones: [] };

  const escalones = [
    { nombre: 'anilist', buscar: () => buscarEnAniList(fandom) },
    { nombre: 'wiki',    buscar: () => buscarEnWiki(fandom) },
    { nombre: 'imagenes', buscar: () => buscarEnImagenes(fandom, motores) }
  ];

  const imagenes = [];
  const recorridos = [];
  const yaVistas = new Set();

  for (const escalon of escalones) {
    if (imagenes.length >= cuantos) break;

    const candidatas = await escalon.buscar();
    let aceptadas = 0;

    for (const url of candidatas) {
      if (imagenes.length >= cuantos) break;
      if (yaVistas.has(url)) continue;
      yaVistas.add(url);

      const buena = await traerYMedir(url, escalon.nombre);
      if (buena) { imagenes.push(buena); aceptadas++; }
    }

    recorridos.push({ escalon: escalon.nombre, candidatas: candidatas.length, aceptadas });
  }

  return { fandom, imagenes, escalones: recorridos };
}

module.exports = {
  buscarFondos,
  limpiarFandom,
  medirImagen,
  valeDeFondo,
  buscarEnAniList,
  buscarEnWiki,
  buscarEnImagenes,
  pareceDelFandom,
  MOTORES_DE_IMAGENES,
  ANCHO_MINIMO,
  PROPORCION_MINIMA
};
