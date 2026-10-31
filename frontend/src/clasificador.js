import ortMjs from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs?url';
import ortWasm from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm?url';

let extraer = null;
let cargando = null;

async function cargarModelo() {
  if (extraer) return extraer;
  if (cargando) return cargando;

  cargando = (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');

    env.allowRemoteModels = window.location.hash.includes('red');
    env.allowLocalModels = true;
    env.localModelPath = './modelos/';

    env.backends.onnx.wasm.wasmPaths = { mjs: ortMjs, wasm: ortWasm };
    env.useBrowserCache = false;

    extraer = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      dtype: 'q8'
    });
    return extraer;
  })();

  return cargando;
}

async function vectorizar(textos) {
  if (!Array.isArray(textos) || textos.length === 0) return [];
  const modelo = await cargarModelo();
  const salida = await modelo(textos, { pooling: 'mean', normalize: true });
  return salida.tolist();
}

window.vectorizar = vectorizar;
window.calentarModelo = async () => { await cargarModelo(); return true; };
window.__clasificadorListo = true;
