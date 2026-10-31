import { trocearDialogos } from './voz-dialogos.js';
import { quienHabla } from './voz-personajes.js';
import { atribuirConversacion } from './voz-conversacion.js';

const ES_WINDOWS_DE_ESCRITORIO = typeof navigator !== 'undefined' && /Windows/.test(navigator.userAgent) && !/Mobile|Android|iPhone|iPad/.test(navigator.userAgent);

export function parrafosDelDom(contenedor) {
  if (!contenedor) return [];

  const candidatos = [...contenedor.querySelectorAll('p, div, li, blockquote')]
    .filter(el => !el.closest('[hidden]') && textoDe(el).length > 1);

  return candidatos.filter(el => !candidatos.some(otro => otro !== el && el.contains(otro)));
}

export function textoDe(nodo) {
  let fuente = nodo;
  if (nodo.querySelector?.('[hidden]')) {
    fuente = nodo.cloneNode(true);
    fuente.querySelectorAll('[hidden]').forEach(e => e.remove());
  }
  return fuente.textContent.trim().replace(/\s+/g, ' ');
}

export function elegirVoces(voces, idioma = 'es', prefs = {}) {
  const prefijo = idioma.toLowerCase();
  const delIdioma = voces.filter(v => v.lang.toLowerCase().startsWith(prefijo));
  const locales = delIdioma.filter(v => v.localService);
  const candidatas = locales.length ? locales : delIdioma;
  const porNombre = nombre => delIdioma.find(v => v.name === nombre);
  const narracion = porNombre(prefs.vozNarracion) || candidatas[0] || voces[0] || null;
  const dialogoElegido = porNombre(prefs.vozDialogo);
  const alternativa = candidatas.find(v => v !== narracion);
  return {
    narracion,
    dialogo: dialogoElegido || alternativa || narracion
  };
}

export function vocesDePersonajes(voces, asignaciones = {}) {
  return Object.fromEntries(Object.entries(asignaciones)
    .map(([personaje, nombre]) => [personaje, voces.find(voz => voz.name === nombre)])
    .filter(([, voz]) => voz));
}

export function vozDelTramo(tramo, narracion, dialogo, personajes = {}, porGenero = {}) {
  if (tramo.tipo !== 'dialogo') return narracion;
  return personajes[tramo.personaje] || (tramo.genero && porGenero[tramo.genero]) || dialogo;
}

export class Lector {
  constructor() {
    this.parrafos = [];
    this.tramos = [];
    this.indice = 0;
    this.indiceTramo = 0;
    this.leyendo = false;
    this.vozNarracion = null;
    this.vozDialogo = null;
    this.vocesPorPersonaje = {};
    this.vocesPorGenero = {};
    this.velocidad = 1;
    this.alCambiar = () => {};

    this.alAcabar = () => {};

    this._cortando = false;

    this._muerto = false;
    this._latido = null;

    this._frase = null;
  }

  cargar(parrafos, desde = 0) {
    this.parrafos = parrafos;

    this.tramos = atribuirConversacion(parrafos.map(texto => quienHabla(trocearDialogos(texto))));
    this.indice = Math.min(Math.max(0, desde), Math.max(0, parrafos.length - 1));
    this.indiceTramo = 0;
  }

  configurar({ vozNarracion, vozDialogo, vocesPorPersonaje, vocesPorGenero, velocidad } = {}) {
    if (vozNarracion !== undefined) this.vozNarracion = vozNarracion;
    if (vozDialogo !== undefined) this.vozDialogo = vozDialogo;
    if (vocesPorPersonaje !== undefined) this.vocesPorPersonaje = vocesPorPersonaje;
    if (vocesPorGenero !== undefined) this.vocesPorGenero = vocesPorGenero;
    if (velocidad !== undefined) this.velocidad = velocidad;

    if (this.leyendo) this.hablar();
  }

  hablar({ seguir = false } = {}) {
    if (this._muerto || !this.parrafos.length) return;
    if (this.indice >= this.parrafos.length) { this.parar(); return; }

    if (!seguir) {
      this._cortando = true;
      this._soltarFrase();
      window.speechSynthesis.cancel();
      this._cortando = false;
    }

    const tramo = this.tramos[this.indice]?.[this.indiceTramo];
    if (!tramo) { this.parar(); return; }
    const frase = new SpeechSynthesisUtterance(tramo.texto);
    const voz = vozDelTramo(
      tramo, this.vozNarracion, this.vozDialogo, this.vocesPorPersonaje, this.vocesPorGenero
    );
    if (voz) frase.voice = voz;
    frase.rate = this.velocidad;
    frase.lang = voz?.lang || 'es-ES';

    frase.onstart = () => {
      if (this._cortando || this._muerto) return;
      this.alCambiar();
    };

    frase.onend = () => {
      this._pararLatido();
      if (this._cortando || !this.leyendo || this._muerto) return;
      if (this._avanzar()) this.hablar({ seguir: true });
      else { this.parar(); this.alAcabar(); }
    };

    frase.onerror = () => {
      this._pararLatido();
      if (!this._cortando) this.parar();
    };

    this.leyendo = true;

    this._frase = frase;
    window.speechSynthesis.speak(frase);

    this.alCambiar();
    this._arrancarLatido();
  }

  _arrancarLatido() {
    this._pararLatido();

    if (!ES_WINDOWS_DE_ESCRITORIO) return;
    this._latido = setInterval(() => {
      if (!this.leyendo || this._muerto) { this._pararLatido(); return; }
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
  }

  _pararLatido() {
    if (this._latido) { clearInterval(this._latido); this._latido = null; }
  }

  _avanzar() {
    if (this.indiceTramo + 1 < this.tramos[this.indice].length) {
      this.indiceTramo++;
      return true;
    }
    this.indice++;
    this.indiceTramo = 0;
    return this.indice < this.tramos.length;
  }

  _soltarFrase() {
    if (!this._frase) return;
    this._frase.onstart = null;
    this._frase.onend = null;
    this._frase.onerror = null;
    this._frase = null;
  }

  parar() {
    this._pararLatido();
    this.leyendo = false;
    this._cortando = true;
    this._soltarFrase();
    window.speechSynthesis.cancel();
    this._cortando = false;
    this.alCambiar();
  }

  destruir() {
    this._muerto = true;
    this.alCambiar = () => {};
    this.parar();
  }

  alternar() {
    if (this.leyendo) this.parar();
    else this.hablar();
  }

  irA(indice) {
    this.indice = Math.min(Math.max(0, indice), Math.max(0, this.parrafos.length - 1));
    this.indiceTramo = 0;
    if (this.leyendo) this.hablar();
    else this.alCambiar();
  }

  saltar(cuantos) {
    this.irA(this.indice + cuantos);
  }
}
