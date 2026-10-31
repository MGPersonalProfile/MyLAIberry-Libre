const PROVEEDORES = {

  gemini: {
    nombre: 'Google Gemini',

    modeloPorDefecto: 'gemini-flash-latest',
    necesitaDireccion: false,
    gratis: true,
    dondeSacarla: 'https://aistudio.google.com/apikey',

    peticion({ clave, modelo }, prompt, maxTokens) {
      const m = encodeURIComponent(modelo);
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
        opciones: {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': clave },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: maxTokens,

              thinkingConfig: { thinkingBudget: 512 }
            }
          })
        }
      };
    },

    leer(datos) {
      const partes = datos?.candidates?.[0]?.content?.parts;
      if (!Array.isArray(partes)) return '';
      return partes.map(p => p?.text || '').join('').trim();
    },

    truncada(datos) {
      return datos?.candidates?.[0]?.finishReason === 'MAX_TOKENS';
    }
  },

  anthropic: {
    nombre: 'Anthropic (Claude)',
    modeloPorDefecto: 'claude-sonnet-5',
    necesitaDireccion: false,
    gratis: false,
    dondeSacarla: 'https://console.anthropic.com/settings/keys',

    peticion({ clave, modelo }, prompt, maxTokens) {
      return {
        url: 'https://api.anthropic.com/v1/messages',
        opciones: {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': clave,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: modelo,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }]
          })
        }
      };
    },

    leer(datos) {
      return (datos?.content?.[0]?.text || '').trim();
    },

    truncada(datos) {
      return datos?.stop_reason === 'max_tokens';
    }
  },

  openai: {
    nombre: 'Compatible con OpenAI',

    modeloPorDefecto: '',
    necesitaDireccion: true,
    gratis: null,
    dondeSacarla: '',

    peticion({ clave, modelo, direccion }, prompt, maxTokens) {

      let base = String(direccion || '').trim().replace(/\/+$/, '');
      if (!/\/chat\/completions$/.test(base)) base += '/chat/completions';

      const headers = { 'content-type': 'application/json' };

      if (clave) headers.authorization = `Bearer ${clave}`;

      return {
        url: base,
        opciones: {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: modelo,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }]
          })
        }
      };
    },

    leer(datos) {
      return (datos?.choices?.[0]?.message?.content || '').trim();
    },

    truncada(datos) {
      return datos?.choices?.[0]?.finish_reason === 'length';
    }
  }
};

const POR_DEFECTO = 'gemini';

function elegir(id) {

  const clave = String(id ?? '');
  return Object.prototype.hasOwnProperty.call(PROVEEDORES, clave)
    ? PROVEEDORES[clave]
    : PROVEEDORES[POR_DEFECTO];
}

function listaDeProveedores() {
  return Object.entries(PROVEEDORES).map(([id, p]) => ({
    id,
    nombre: p.nombre,
    modeloPorDefecto: p.modeloPorDefecto,
    necesitaDireccion: p.necesitaDireccion,
    gratis: p.gratis,
    dondeSacarla: p.dondeSacarla
  }));
}

function queFalta(config = {}) {
  const p = elegir(config.proveedor);
  if (config.proveedor === 'openai') {
    if (!String(config.direccion || '').trim()) return 'sin-direccion';
    if (!String(config.modelo || '').trim()) return 'sin-modelo';
    return null;
  }
  if (!String(config.clave || '').trim()) return 'sin-clave';
  if (!String(config.modelo || p.modeloPorDefecto).trim()) return 'sin-modelo';
  return null;
}

function construirPeticion(config = {}, prompt, maxTokens = 300) {
  const p = elegir(config.proveedor);
  const modelo = String(config.modelo || '').trim() || p.modeloPorDefecto;
  return p.peticion({ ...config, modelo }, prompt, maxTokens);
}

function leerRespuesta(proveedor, datos) {
  return elegir(proveedor).leer(datos);
}

function vinoCortada(proveedor, datos) {
  const p = elegir(proveedor);
  return typeof p.truncada === 'function' ? !!p.truncada(datos) : false;
}

function mensajeDeError(status, cuerpo = '') {
  const detalle = String(cuerpo || '').slice(0, 200);

  let suyo = '';
  try { suyo = String(JSON.parse(cuerpo)?.error?.message || ''); } catch {  }
  const motivo = suyo ? ` (${suyo.slice(0, 220)})` : '';
  switch (status) {
    case 400: return `La petición no se aceptó. ¿El nombre del modelo es correcto? ${detalle}`;
    case 401:
    case 403: return 'La clave no es válida o no tiene permiso para ese modelo.' + motivo;
    case 404: return 'No existe ese modelo, o la dirección no es la del servidor. Revísalos en Ajustes.' + motivo;
    case 429: return 'Demasiadas peticiones. Prueba en unos minutos.';
    case 500:
    case 502:
    case 503:
    case 504: return 'El servicio está caído ahora mismo. No es cosa tuya.';
    default:  return `El servicio respondió ${status}. ${detalle}`;
  }
}

module.exports = {
  PROVEEDORES,
  POR_DEFECTO,
  listaDeProveedores,
  queFalta,
  construirPeticion,
  leerRespuesta,
  vinoCortada,
  mensajeDeError
};
