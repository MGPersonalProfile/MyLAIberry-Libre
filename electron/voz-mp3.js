const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');

const PAPELES = {
  es: {
    narracion: ['es_MX-claude-high', 0],
    f: ['es_ES-sharvard-medium', 1],
    m: ['es_ES-davefx-medium', 0],
    dialogo: ['es_ES-sharvard-medium', 0]
  },
  en: {
    narracion: ['en_US-lessac-medium', 0],
    f: ['en_US-hfc_female-medium', 0],
    m: ['en_US-hfc_male-medium', 0],
    dialogo: ['en_US-joe-medium', 0]
  }
};

function carpetaDePiper() {
  if (process.env.MYLAIBERRY_PIPER) return process.env.MYLAIBERRY_PIPER;
  return process.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA || os.homedir(), 'piper')
    : path.join(os.homedir(), '.local', 'share', 'piper');
}

function motor(idioma = 'es', carpeta = carpetaDePiper()) {
  const programa = path.join(carpeta, 'piper', process.platform === 'win32' ? 'piper.exe' : 'piper');
  if (!fs.existsSync(programa)) {
    return { ok: false, motivo: process.platform === 'win32'
      ? 'Las voces neuronales se instalan desde el botón del lector.'
      : 'Las voces neuronales (Piper) no están instaladas en este equipo: el manual, en «Voces neuronales», explica cómo ponerlas.' };
  }
  const papeles = PAPELES[idioma];
  if (!papeles) return { ok: false, motivo: `No hay voces neuronales para el idioma «${idioma}».` };
  const modelo = id => path.join(carpeta, 'voces', `${id}.onnx`);
  const hay = ([id]) => fs.existsSync(modelo(id));
  const narracion = hay(papeles.narracion) ? papeles.narracion : Object.values(papeles).find(hay);
  if (!narracion) return { ok: false, motivo: process.platform === 'win32'
    ? `Faltan las voces de «${idioma}»; instálalas desde el botón del lector.`
    : `Falta descargar las voces de «${idioma}»: el manual, en «Voces neuronales», dice cuáles y dónde van.` };
  const voces = {};
  for (const [papel, voz] of Object.entries(papeles)) {
    const [id, hablante] = hay(voz) ? voz : narracion;
    voces[papel] = { id, hablante, modelo: modelo(id) };
  }
  return { ok: true, programa, carpeta, voces };
}

function ffmpegPara(carpeta) {
  const local = path.join(carpeta, 'ffmpeg', 'ffmpeg.exe');
  return fs.existsSync(local) ? local : 'ffmpeg';
}

let modulosDeVoz = null;

async function cargarModulosDeVoz() {
  if (!modulosDeVoz) {
    const src = path.join(__dirname, '..', 'frontend', 'src');
    const cargar = f => import(pathToFileURL(path.join(src, f)).href);
    const [voz, dialogos, personajes, conversacion, audio] = await Promise.all(
      ['voz.js', 'voz-dialogos.js', 'voz-personajes.js', 'voz-conversacion.js', 'voz-audio.js'].map(cargar)
    );
    modulosDeVoz = { ...voz, ...dialogos, ...personajes, ...conversacion, huella: audio.huella };
  }
  return modulosDeVoz;
}

const CON_VOZ = /[\p{L}\p{N}]/u;

async function planDelCapitulo(html, { JSDOM = require('jsdom').JSDOM } = {}) {
  const m = await cargarModulosDeVoz();
  const { document } = new JSDOM(`<div class="reader-content">${html}</div>`).window;
  const textos = m.parrafosDelDom(document.querySelector('.reader-content')).map(m.textoDe);
  const parrafos = m.atribuirConversacion(textos.map(t => m.quienHabla(m.trocearDialogos(t))));
  const plan = [];
  parrafos.forEach((tramos, parrafo) => {
    let ultimo = null;
    const huella = m.huella(textos[parrafo]);
    for (const tramo of tramos) {
      const papel = tramo.tipo !== 'dialogo' ? 'narracion' : (tramo.genero || 'dialogo');
      if (ultimo && ultimo.papel === papel) { ultimo.texto += tramo.texto; continue; }
      ultimo = { papel, texto: tramo.texto, parrafo, huella };
      plan.push(ultimo);
    }
  });
  return plan.map(t => ({ ...t, texto: t.texto.trim() })).filter(t => CON_VOZ.test(t.texto));
}

const TECHO_MS = 20 * 60 * 1000;

function esperar(proceso, nombre, techoMs = TECHO_MS) {
  return new Promise((ok, mal) => {
    let errores = '';
    const reloj = setTimeout(() => {
      proceso.kill?.('SIGKILL');
      mal(new Error(`${nombre} no terminó en ${Math.max(1, Math.round(techoMs / 60000))} min; se ha parado.`));
    }, techoMs);
    proceso.stderr?.on('data', d => { errores = (errores + d).slice(-2000); });
    proceso.on('error', e => { clearTimeout(reloj); mal(e); });
    proceso.on('close', codigo => {
      clearTimeout(reloj);
      if (codigo === 0) ok();
      else mal(new Error(`${nombre} salió con ${codigo}: ${errores.trim().split('\n').pop() || ''}`));
    });
  });
}

function duracionWav(buf) {
  let i = 12;
  let bytesPorSegundo = 0;
  while (i + 8 <= buf.length) {
    const id = buf.toString('ascii', i, i + 4);
    const largo = buf.readUInt32LE(i + 4);
    if (id === 'fmt ') bytesPorSegundo = buf.readUInt32LE(i + 16);
    if (id === 'data') return bytesPorSegundo ? Math.min(largo, buf.length - i - 8) / bytesPorSegundo : 0;
    i += 8 + largo + (largo % 2);
  }
  return 0;
}

function marcasDe(trozos) {
  const marcas = [];
  let t = 0;
  for (const trozo of trozos) {
    if (marcas.at(-1)?.parrafo !== trozo.parrafo) {
      marcas.push({ parrafo: trozo.parrafo, huella: trozo.huella, inicio: Math.round(t * 100) / 100 });
    }
    t += duracionWav(fs.readFileSync(trozo.fichero));
  }
  return marcas;
}

async function sintetizar(plan, { motor: m, salida, titulo = '', ejecutar = spawn, ffmpeg, techoMs = TECHO_MS }) {
  if (!plan.length) throw new Error('El capítulo no tiene texto que leer.');
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'mylaiberry-mp3-'));
  let parcial = null;
  try {
    const trozos = plan.map((t, i) => ({ ...t, fichero: path.join(tmp, `${String(i).padStart(5, '0')}.wav`) }));
    const porVoz = new Map();
    for (const t of trozos) {
      const voz = m.voces[t.papel] || m.voces.narracion;
      const clave = `${voz.modelo}#${voz.hablante}`;
      if (!porVoz.has(clave)) porVoz.set(clave, { voz, trozos: [] });
      porVoz.get(clave).trozos.push(t);
    }

    for (const { voz, trozos: suyos } of porVoz.values()) {
      const piper = ejecutar(m.programa, ['-m', voz.modelo, '-s', String(voz.hablante), '--json-input',
        '--sentence_silence', '0.25', '-q'], { stdio: ['pipe', 'ignore', 'pipe'] });
      const fin = esperar(piper, 'Piper', techoMs);

      piper.stdin.on('error', () => {});
      for (const t of suyos) piper.stdin.write(JSON.stringify({ text: t.texto, output_file: t.fichero }) + '\n');
      piper.stdin.end();
      await fin;
    }
    const faltan = trozos.filter(t => !fs.existsSync(t.fichero));
    if (faltan.length) throw new Error(`Piper no generó ${faltan.length} de ${trozos.length} trozos.`);

    const lista = path.join(tmp, 'lista.txt');
    await fsp.writeFile(lista, trozos.map(t => `file '${t.fichero.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));

    parcial = `${salida}.parcial`;
    await fsp.mkdir(path.dirname(salida), { recursive: true });
    await esperar(ejecutar(ffmpeg || ffmpegPara(m.carpeta || path.dirname(path.dirname(m.programa))), ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lista,
      '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '64k', '-metadata', `title=${titulo}`, '-f', 'mp3', parcial],
    { stdio: ['ignore', 'ignore', 'pipe'] }), 'ffmpeg', techoMs);

    await fsp.writeFile(rutaDeMarcas(salida), JSON.stringify({ marcas: marcasDe(trozos) }));

    await fsp.rename(parcial, salida);
    parcial = null;
    return { trozos: trozos.length, voces: porVoz.size };
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true });
    if (parcial) await fsp.rm(parcial, { force: true });
  }
}

function rutaDelAudio(dirObra, indice, idioma) {
  return path.join(dirObra, 'audio', `chapter_${indice}.${idioma || 'original'}.mp3`);
}

function rutaDeMarcas(rutaMp3) {
  return rutaMp3.replace(/\.mp3$/, '.marcas.json');
}

function leerMarcas(rutaMp3) {
  try { return JSON.parse(fs.readFileSync(rutaDeMarcas(rutaMp3), 'utf-8')).marcas || null; } catch { return null; }
}

module.exports = { PAPELES, carpetaDePiper, motor, ffmpegPara, planDelCapitulo, sintetizar, rutaDelAudio, rutaDeMarcas, leerMarcas, duracionWav };
