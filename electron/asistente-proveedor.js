const MAX_ENTRADA_BYTES = 120000;
const MAX_SALIDA_TOKENS = 4096;

async function claveDisponible() {
  try {
    return (await require('./db.js').claveDeepSeekUtilizable()).clave;
  } catch {
    throw new Error('No se pudo leer la clave de DeepSeek guardada en este equipo.');
  }
}

const sinRed = e => e?.name === 'TypeError' && /fetch failed/i.test(e.message);
const SIN_RED = 'No hay conexión con DeepSeek (la red se cortó o no responde). Vuelve a intentarlo en un momento.';

function crearProveedor({ getKey = claveDisponible, fetchImpl = fetch, timeout = 90000, pausa = 1500 } = {}) {
  const una = unaPeticion({ getKey, fetchImpl, timeout });
  return async (peticion) => {
    try { return await una(peticion); } catch (e) {
      if (!sinRed(e) || peticion.signal?.aborted) throw e;
    }
    await new Promise(r => setTimeout(r, pausa));
    try { return await una(peticion); } catch (e) { throw sinRed(e) ? new Error(SIN_RED) : e; }
  };
}

function unaPeticion({ getKey, fetchImpl, timeout }) {
  return async ({ messages, tools, model, signal }) => {

    if (Buffer.byteLength(JSON.stringify({ messages, tools }), 'utf8') > MAX_ENTRADA_BYTES) {
      throw new Error('La petición supera el tope de entrada; abre una conversación nueva o acorta la búsqueda.');
    }
    const key = await getKey();
    if (!key) throw new Error('El asistente necesita una clave de DeepSeek: ponla en Ajustes > Asistente.');
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, timeout);
    try {
      const res = await fetchImpl('https://api.deepseek.com/chat/completions', {
        method: 'POST', signal: controller.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages, ...(tools.length ? { tools } : {}),
          max_tokens: MAX_SALIDA_TOKENS, thinking: { type: 'disabled' } }),
      });
      if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'DeepSeek rechazó la credencial.' :
        res.status === 429 ? 'DeepSeek está limitando las peticiones; vuelve a intentarlo más tarde.' : `DeepSeek respondió con un error (${res.status}).`);
      const data = await res.json();
      const choice = data.choices?.[0];
      if (choice?.finish_reason === 'length') throw new Error('La respuesta alcanzó su límite; reduce la petición y vuelve a intentarlo.');
      if (!choice?.message || (!choice.message.content && !choice.message.tool_calls?.length)) throw new Error('DeepSeek devolvió una respuesta vacía.');
      return { message: choice.message, usage: data.usage || {} };
    } catch (e) {
      if (controller.signal.aborted) throw new Error(signal?.aborted ? 'Petición cancelada.' : 'DeepSeek tardó demasiado en responder.');
      throw e;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  };
}

async function probarClave({ getKey = claveDisponible, fetchImpl = fetch, timeout = 15000 } = {}) {
  const key = await getKey();
  if (!key) return { ok: false, sinClave: true, message: 'No hay ninguna clave de DeepSeek puesta.' };
  try {
    const res = await fetchImpl('https://api.deepseek.com/models', {
      headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(timeout)
    });
    if (res.ok) return { ok: true };
    return { ok: false, message: res.status === 401 || res.status === 403 ? 'DeepSeek rechazó la clave.' : `DeepSeek respondió con un error (${res.status}).` };
  } catch (e) {
    return { ok: false, message: sinRed(e) || e?.name === 'TimeoutError' ? SIN_RED : 'No se pudo hablar con DeepSeek.' };
  }
}

module.exports = { crearProveedor, probarClave, MAX_ENTRADA_BYTES, MAX_SALIDA_TOKENS };
