export const ANCHO = 1080;
export const ALTO = 1350;
const MARGEN = 96;
const TEMAS = {
  oscuro: { fondo: '#0b0b0b', texto: '#f5f5f5', suave: '#a8a8a8', acento: '#E50914' },
  claro: { fondo: '#fafafa', texto: '#161616', suave: '#6b6b6b', acento: '#D10A14' },
  sepia: { fondo: '#f3e7d0', texto: '#3b2f22', suave: '#7b6a55', acento: '#a8342c' }
};

export function datosDeAnotacion(anotacion, obra, capitulo) {
  return { cita: anotacion.ancla.cita, nota: anotacion.nota || '', titulo: obra.title || '', autor: obra.author || '', capitulo };
}

const lineaDeCapitulo = ({ autor, capitulo }) =>
  [autor, capitulo != null ? `Capítulo ${capitulo}` : ''].filter(Boolean).join(' · ');

export function textoDeTarjeta(datos, { incluirNota = false } = {}) {
  const pie = [`— ${datos.titulo}`, lineaDeCapitulo(datos)].filter(Boolean).join('\n');
  const conNota = incluirNota && datos.nota ? `\n\nNota: ${datos.nota}` : '';
  return `«${datos.cita}»\n\n${pie}${conNota}`;
}

function envolver(ctx, parrafo, ancho) {
  const lineas = [];
  let actual = '';
  const cabe = t => ctx.measureText(t).width <= ancho;
  for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (cabe(prueba)) { actual = prueba; continue; }
    if (actual) lineas.push(actual);
    let resto = palabra;
    while (!cabe(resto)) {
      let n = resto.length - 1;
      while (n > 1 && !cabe(resto.slice(0, n))) n--;
      if (n > 1 && /[\uD800-\uDBFF]/.test(resto[n - 1])) n--;
      lineas.push(resto.slice(0, n)); resto = resto.slice(n);
    }
    actual = resto;
  }
  if (actual) lineas.push(actual);
  return lineas.length ? lineas : [''];
}

function distribuir(ctx, texto, tamano, ancho) {
  ctx.font = `${tamano}px Georgia, serif`;
  const lineas = [];
  texto.split('\n').forEach((p, i) => { if (i) lineas.push(null); lineas.push(...envolver(ctx, p, ancho)); });
  return lineas;
}

export function componerTarjeta(ctx, datos, { tema = 'oscuro', incluirNota = false } = {}) {
  const colores = TEMAS[tema] || TEMAS.oscuro;
  const ancho = ANCHO - MARGEN * 2;

  const pie = [datos.titulo, lineaDeCapitulo(datos)].filter(Boolean);
  if (incluirNota && datos.nota) pie.push(`Nota: ${datos.nota}`);
  ctx.font = '34px Inter, system-ui, sans-serif';
  const lineasPie = pie.flatMap(l => envolver(ctx, l, ancho));
  const alto = ALTO - MARGEN * 2 - 52 * lineasPie.length - 40;
  let elegido = null;
  for (let tamano = 64; tamano >= 28 && !elegido; tamano -= 4) {
    const lineas = distribuir(ctx, `«${datos.cita}»`, tamano, ancho);
    const altura = lineas.reduce((s, l) => s + (l === null ? tamano * 0.5 : tamano * 1.45), 0);
    if (altura <= alto) elegido = { tamano, lineas };
  }
  if (!elegido) return { ok: false, motivo: 'larga' };
  ctx.fillStyle = colores.fondo; ctx.fillRect(0, 0, ANCHO, ALTO);
  ctx.fillStyle = colores.acento; ctx.fillRect(MARGEN, MARGEN - 40, 96, 8);
  ctx.fillStyle = colores.texto; ctx.textBaseline = 'top';
  ctx.font = `${elegido.tamano}px Georgia, serif`;
  let y = MARGEN + 24;
  const dibujadas = [];
  for (const l of elegido.lineas) {
    if (l === null) { y += elegido.tamano * 0.5; continue; }
    ctx.fillText(l, MARGEN, y); dibujadas.push(l); y += elegido.tamano * 1.45;
  }
  ctx.fillStyle = colores.suave; ctx.font = '34px Inter, system-ui, sans-serif';
  let py = ALTO - MARGEN - 52 * lineasPie.length;
  for (const linea of lineasPie) { ctx.fillText(linea, MARGEN, py); dibujadas.push(linea); py += 52; }
  return { ok: true, lineas: dibujadas, tamano: elegido.tamano };
}

export function tarjetaPng(datos, opciones, crearLienzo = () => document.createElement('canvas')) {
  const lienzo = crearLienzo();
  lienzo.width = ANCHO; lienzo.height = ALTO;
  const r = componerTarjeta(lienzo.getContext('2d'), datos, opciones);
  if (!r.ok) return Promise.resolve({ ...r, blob: null });
  return new Promise(ok => lienzo.toBlob(blob => ok({ ...r, blob }), 'image/png'));
}
