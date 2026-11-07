const { sinTildes } = require('./modelo.js');

const ADMITIR_INVERSAS = true;

const ORDENAR_POR_APELLIDO = false;
const SEPARAR_AMISTAD = (s) => s.replace(/\s*([/&])\s*/g, '$1');

const RE_SECUNDARIA = /\b(minor|background|past|secundaria|menci[oó]n|one-sided|pre-relationship)\b/i;

const CATALOGO_AO3 = [
  {
    canonica: 'Hermione Granger/Harry Potter',
    tipo: 'romantica',
    sinonimos: [
      'hermione granger/harry potter',
      'harry potter/hermione granger',
      'harry/hermione',
      'hermione/harry',
      'harmony',
      'harmony - relationship',
      'h/hr',
      'h/hr - relationship'
    ]
  },
  {
    canonica: 'Hermione Granger & Harry Potter',
    tipo: 'platonica',
    sinonimos: [
      'hermione granger & harry potter',
      'harry potter & hermione granger',
      'harry & hermione',
      'hermione & harry'
    ]
  }
];

function normalizarClave(s) {
  return SEPARAR_AMISTAD(sinTildes(String(s || '')).toLowerCase())
    .replace(/\s+/g, ' ')
    .trim();
}

const MAPA_SINONIMOS = new Map();
for (const entrada of CATALOGO_AO3) {
  for (const s of entrada.sinonimos) {
    MAPA_SINONIMOS.set(normalizarClave(s), entrada);
  }
}

function tipoDeRelacion(s) {
  return String(s || '').includes('&') ? 'platonica' : 'romantica';
}

function extraerPartes(pareja) {
  const tieneAmp = pareja.includes('&');
  const tieneBarra = pareja.includes('/');
  if (tieneAmp && !tieneBarra) {
    const partes = pareja.split(/\s*&\s*/).map(p => p.trim()).filter(Boolean);
    return { partes, sep: ' & ', tipo: 'platonica' };
  }
  if (tieneBarra && !tieneAmp) {
    const partes = pareja.split(/\s*\/\s*/).map(p => p.trim()).filter(Boolean);
    return { partes, sep: '/', tipo: 'romantica' };
  }
  return null;
}

function compararPorApellido(a, b) {
  const palA = a.split(/\s+/).filter(Boolean);
  const palB = b.split(/\s+/).filter(Boolean);
  const apA = sinTildes(palA[palA.length - 1]).toLowerCase();
  const apB = sinTildes(palB[palB.length - 1]).toLowerCase();
  const comp = apA.localeCompare(apB);
  if (comp !== 0) return comp;
  return sinTildes(a).toLowerCase().localeCompare(sinTildes(b).toLowerCase());
}

function resolverParejaAO3(pareja) {
  if (!pareja || typeof pareja !== 'string') {
    return { canonica: '', tipo: 'romantica', resuelta: false };
  }
  const limpia = pareja.trim();
  const clave = normalizarClave(limpia);
  const entrada = MAPA_SINONIMOS.get(clave);
  if (entrada) {
    return {
      canonica: entrada.canonica,
      tipo: entrada.tipo,
      resuelta: true
    };
  }

  if (ORDENAR_POR_APELLIDO) {
    const info = extraerPartes(limpia);
    if (info && info.partes.length >= 2) {
      const sonNombresCompletos = info.partes.every(p => p.split(/\s+/).filter(Boolean).length >= 2);
      if (sonNombresCompletos) {
        const ordenadas = [...info.partes].sort(compararPorApellido);
        return {
          canonica: ordenadas.join(info.sep),
          tipo: info.tipo,
          resuelta: true
        };
      }
    }
  }

  return {
    canonica: limpia,
    tipo: tipoDeRelacion(limpia),
    resuelta: false
  };
}

function esSecundaria(etiqueta) {
  return RE_SECUNDARIA.test(String(etiqueta || ''));
}

function limpiarEtiqueta(s) {
  return String(s || '')
    .replace(RE_SECUNDARIA, '')
    .replace(/[()[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sonSinonimosAO3(etiqueta, pedida) {
  const tEtiqueta = tipoDeRelacion(etiqueta);
  const tPedida = tipoDeRelacion(pedida);
  if (tEtiqueta !== tPedida) return false;

  const res1 = resolverParejaAO3(limpiarEtiqueta(etiqueta));
  const res2 = resolverParejaAO3(pedida);
  if (res1.resuelta && res2.resuelta) {
    return res1.canonica === res2.canonica;
  }

  if (!ADMITIR_INVERSAS) return false;

  const { casaPareja } = require('../asistente-investigar-web.js');
  return casaPareja(limpiarEtiqueta(etiqueta), pedida);
}

function coincideRelacion(etiqueta, pedida) {
  if (sonSinonimosAO3(etiqueta, pedida)) return true;
  const { parejaCasa } = require('./memoria.js');
  return parejaCasa(limpiarEtiqueta(etiqueta), pedida);
}

function clasificarPrioridad(obra, pedida) {
  if (!obra || !pedida) return null;
  const tags = (obra.tags || []).filter(t => (t.category || '') === 'relationship').map(t => String(t.name || t));
  if (!tags.length) return null;

  const coincidentes = tags.filter(t => coincideRelacion(t, pedida));
  if (!coincidentes.length) return null;

  if (coincidentes.every(esSecundaria)) return 'baja';
  if (coincideRelacion(tags[0], pedida) && !esSecundaria(tags[0])) return 'alta';

  return 'indeterminada';
}

module.exports = {
  resolverParejaAO3,
  esSecundaria,
  sonSinonimosAO3,
  clasificarPrioridad,
  normalizarClave
};
