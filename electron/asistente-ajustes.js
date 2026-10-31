const bool = (v) => {
  if (v === true || v === 'true') return true;
  if (v === false || v === 'false') return false;
  throw new Error('Ese ajuste es sí o no: true o false.');
};

const ALIAS = {
  oscuro: 'dark', noche: 'dark', claro: 'light', blanco: 'light', sepia: 'sepia',
  serifa: 'serif', 'con serifa': 'serif', 'sin serifa': 'sans', 'sans-serif': 'sans',
  espanol: 'es', spanish: 'es', ingles: 'en', english: 'en'
};
const sinTildes = (v) => String(v ?? '').normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
const unoDe = (...validos) => (v) => {
  const dicho = sinTildes(v);
  const valor = validos.includes(dicho) ? dicho : ALIAS[dicho];
  if (!validos.includes(valor)) throw new Error(`Ese ajuste admite: ${validos.join(', ')}.`);
  return valor;
};

function tamanoDeLetra(v, actual = 18) {
  const s = String(v ?? '').trim();
  const n = Number(s.replace(/px$/i, ''));
  if (!s || !Number.isFinite(n)) throw new Error('La letra es un número de píxeles (14-32) o un cambio relativo como «+2».');
  const destino = /^[+-]/.test(s) ? Number(actual) + n : n;
  return Math.max(14, Math.min(32, Math.round(destino)));
}

function velocidadDeVoz(v, actual = 1) {
  const s = String(v ?? '').trim().replace(',', '.').replace(/[x×]$/i, '');
  const n = Number(s);
  if (!s || !Number.isFinite(n)) throw new Error('La velocidad de la voz es un número entre 0.6 y 2, o un cambio relativo como «-0.2».');
  const destino = /^[+-]/.test(s) ? Number(actual || 1) + n : n;
  return Math.round(Math.max(0.6, Math.min(2, destino)) * 10) / 10;
}

const AJUSTES = {
  fontSize: tamanoDeLetra,
  velocidadVoz: velocidadDeVoz,
  font: unoDe('serif', 'sans'),
  theme: unoDe('dark', 'sepia', 'light'),
  lang: unoDe('es', 'en'),
  autoTranslate: bool,
  readTranslated: bool,
  avisarCapitulos: bool,
  seguirEnSegundoPlano: bool
};

const POR_DEFECTO = require('./ajustes-por-defecto.js').ajustesPorDefecto();

const CLAVES_DE_AJUSTE = Object.keys(AJUSTES);

function valorDeAjuste(key, value, actual) {
  const convertir = AJUSTES[key];
  if (!convertir) throw new Error('Ese ajuste no se puede cambiar desde aquí.');
  return convertir(value, actual);
}

async function ajustarConDeshacer(args, { services, state, hilo = null }) {
  const r = await services.settings(args);
  if (r?.antes !== undefined && r.antes !== r[args.key]) {
    await state.update(s => {
      s.undo = [...(s.undo || []), { id: require('node:crypto').randomUUID().slice(0, 8), type: 'ajuste', hilo, key: args.key, valor: r.antes,

        etiqueta: `ajustar_lector · ${args.key}: se puso ${r[args.key]} (deshacerlo lo devuelve a ${r.antes})`, at: Date.now() }].slice(-50);
    });
  }
  return r;
}

module.exports = { CLAVES_DE_AJUSTE, valorDeAjuste, ajustarConDeshacer, POR_DEFECTO };
