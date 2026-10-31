export const huella = (texto) => String(texto || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 40);

export function alinearMarcas(marcas, textos) {
  const resultado = textos.map(() => null);
  let j = 0;
  for (let i = 0; i < textos.length && j < marcas.length; i++) {
    const h = huella(textos[i]);
    if (!h) continue;

    const k = marcas.slice(j, j + 5).findIndex(m => m.huella && (m.huella.startsWith(h) || h.startsWith(m.huella)));
    if (k < 0) continue;
    resultado[i] = marcas[j + k].inicio;
    j += k + 1;
  }
  return resultado;
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

export class LectorDeAudio {
  constructor({ crearAudio = (src) => new Audio(src) } = {}) {
    this.crearAudio = crearAudio;
    this.audio = null;
    this.marcas = [];
    this.parrafos = [];
    this.indice = 0;
    this.leyendo = false;
    this.velocidad = 1;
    this.alCambiar = () => {};
    this.alAcabar = () => {};
    this._muerto = false;
  }

  usar({ src, marcas }) {
    this.soltar();
    this.src = src;
    this.marcas = Array.isArray(marcas) ? marcas : [];
    this.audio = this.crearAudio(src);
    this.audio.preload = 'auto';
    this.audio.playbackRate = this.velocidad;
    this.audio.ontimeupdate = () => {
      const i = parrafoEn(this.marcas, this.audio.currentTime);
      if (i !== this.indice) { this.indice = i; this.alCambiar(); }
    };
    this.audio.onended = () => { this.leyendo = false; this.alCambiar(); this.alAcabar(); };
    this.audio.onerror = () => { this.leyendo = false; this.alCambiar(); };
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
  }

  destruir() {
    this._muerto = true;
    this.alCambiar = () => {};
    this.soltar();
  }
}
