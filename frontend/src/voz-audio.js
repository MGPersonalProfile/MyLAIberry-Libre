export const huella = (texto) => String(texto || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 40);

function emparejar(marcas, textos) {
  const resultado = textos.map(() => null);
  let j = 0;
  for (let i = 0; i < textos.length && j < marcas.length; i++) {
    const h = huella(textos[i]);
    if (!h) continue;

    const k = marcas.slice(j, j + 5).findIndex(m => m.huella && (m.huella.startsWith(h) || h.startsWith(m.huella)));
    if (k < 0) continue;
    resultado[i] = marcas[j + k];
    j += k + 1;
  }
  return resultado;
}

export function alinearMarcas(marcas, textos) {
  return emparejar(marcas, textos).map(m => (m ? m.inicio : null));
}

export function alinearParrafos(marcas, textos) {
  return emparejar(marcas, textos).map(m => (m ? m.parrafo : null));
}

export function parrafoEn(marcas, t) {
  let indice = -1;
  for (let i = 0; i < marcas.length; i++) {
    if (marcas[i] == null) continue;
    if (marcas[i] <= t + 0.05) indice = i;
    else break;
  }
  return indice < 0 ? 0 : indice;
}

export function inicioDe(marcas, i) {
  for (let j = Math.max(0, i); j < marcas.length; j++) if (marcas[j] != null) return marcas[j];
  return null;
}

export function alinearFrases(marcas, frases, textos) {
  if (!Array.isArray(frases) || !frases.length || !Array.isArray(marcas)) return [];
  const porParrafo = new Map();
  for (const f of frases) porParrafo.set(f.parrafo, [...(porParrafo.get(f.parrafo) || []), f]);
  const salida = [];
  alinearParrafos(marcas, textos).forEach((servidor, i) => {
    const suyas = porParrafo.get(servidor);
    if (servidor == null || !suyas) return;
    const iguales = suyas.every(f => {
      const h = huella(textos[i].slice(f.desde, f.hasta));
      return Boolean(f.huella) && Boolean(h) && (h.startsWith(f.huella) || f.huella.startsWith(h));
    });
    if (!iguales) return;
    for (const f of suyas) salida.push({ parrafo: i, desde: f.desde, hasta: f.hasta, inicio: f.inicio, fin: f.fin });
  });
  return salida.sort((a, b) => a.inicio - b.inicio);
}

const MARGEN = 0;

export function fraseEn(frases, t) {
  let lo = 0;
  let hi = frases.length - 1;
  let mejor = -1;
  while (lo <= hi) {
    const medio = (lo + hi) >> 1;
    if (frases[medio].inicio <= t + MARGEN) { mejor = medio; lo = medio + 1; } else hi = medio - 1;
  }
  return mejor >= 0 && t < frases[mejor].fin ? mejor : -1;
}

export class LectorDeAudio {
  constructor({ crearAudio = (src) => new Audio(src) } = {}) {
    this.crearAudio = crearAudio;
    this.audio = null;
    this.marcas = [];
    this.frases = [];
    this.frase = -1;
    this.parrafos = [];
    this.indice = 0;
    this.leyendo = false;
    this.velocidad = 1;
    this.alCambiar = () => {};
    this.alAcabar = () => {};
    this._muerto = false;
  }

  usar({ src, marcas, frases }) {
    this.soltar();
    this.src = src;
    this.marcas = Array.isArray(marcas) ? marcas : [];
    this.frases = Array.isArray(frases) ? frases : [];
    this.frase = -1;
    this.audio = this.crearAudio(src);
    this.audio.preload = 'auto';
    this.audio.playbackRate = this.velocidad;
    this.audio.ontimeupdate = () => this._seguir();
    this.audio.onended = () => { this.leyendo = false; this.alCambiar(); this.alAcabar(); };
    this.audio.onerror = () => { this.leyendo = false; this.alCambiar(); };
  }

  _seguir() {
    const t = this.audio.currentTime;
    const f = fraseEn(this.frases, t);
    const i = f >= 0 ? this.frases[f].parrafo : parrafoEn(this.marcas, t);
    if (i !== this.indice || f !== this.frase) { this.indice = i; this.frase = f; this.alCambiar(); }
  }

  cargar(parrafos, desde = 0) {
    this.parrafos = parrafos;
    this.indice = Math.min(Math.max(0, desde), Math.max(0, this.marcas.length - 1));
    const inicio = inicioDe(this.marcas, this.indice);
    if (this.audio && inicio != null) this.audio.currentTime = inicio;
  }

  configurar({ velocidad } = {}) {
    if (velocidad !== undefined) {
      this.velocidad = velocidad;
      if (this.audio) this.audio.playbackRate = velocidad;
    }
  }

  hablar() {
    if (this._muerto || !this.audio) return;
    this.leyendo = true;
    const sonando = this.audio.play();

    sonando?.catch?.(() => { this.leyendo = false; this.alCambiar(); });
    this.alCambiar();
  }

  parar() {
    if (this.audio) this.audio.pause();
    this.leyendo = false;
    this.alCambiar();
  }

  alternar() { if (this.leyendo) this.parar(); else this.hablar(); }

  buscar(t) {
    if (!this.audio) return;
    const duracion = Number.isFinite(this.audio.duration) ? this.audio.duration : Infinity;
    this.audio.currentTime = Math.min(Math.max(0, t), duracion);
    this._seguir();
    this.alCambiar();
  }

  saltarFrase(cuantas) {
    if (!this.frases.length) { this.saltar(cuantas); return; }
    const t = this.audio ? this.audio.currentTime : 0;
    let actual = this.frase;
    if (actual < 0) actual = Math.max(0, this.frases.findLastIndex(f => f.inicio <= t + 0.05));
    const destino = Math.min(Math.max(0, actual + cuantas), this.frases.length - 1);
    this.buscar(this.frases[destino].inicio);
  }

  irA(indice) {
    this.indice = Math.min(Math.max(0, indice), Math.max(0, this.marcas.length - 1));
    const inicio = inicioDe(this.marcas, this.indice);
    if (this.audio && inicio != null) this.audio.currentTime = inicio;
    this.alCambiar();
  }

  saltar(cuantos) { this.irA(this.indice + cuantos); }

  soltar() {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.ontimeupdate = this.audio.onended = this.audio.onerror = null;
    this.audio = null;
    this.frase = -1;
  }

  destruir() {
    this._muerto = true;
    this.alCambiar = () => {};
    this.soltar();
  }
}
