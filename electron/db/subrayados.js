const { leer, writeDB } = require('./nucleo.js');
const { enSeriePorObra } = require('../lector/revisiones.js');
const { operacionValida, aplicarOperacion, cambiosDesde } = require('../lector/subrayados.js');

const { ID_VALIDO } = require('../lan/rutas-seguras.js');

const idValido = id => (typeof id === 'string' || Number.isSafeInteger(id)) && ID_VALIDO.test(String(id));
const buscar = (datos, id) => datos.fanfics.find(f => String(f.id) === String(id));

async function listarSubrayados(obraId, desde = 0, capitulo) {
  if (!idValido(obraId)) return { status: 'error', message: 'Obra no válida' };
  return enSeriePorObra(obraId, async () => {
    const obra = buscar(await leer(), obraId);
    if (!obra) return { status: 'error', message: 'Obra no encontrada' };
    return { status: 'ok', ...cambiosDesde(obra, Number(desde) || 0, capitulo) };
  });
}

async function operarSubrayado(obraId, operacion) {
  if (!idValido(obraId)) return { status: 'error', message: 'Obra no válida' };
  return enSeriePorObra(obraId, async () => {
    const op = operacionValida(operacion, obraId);
    if (op.error) return { status: 'error', message: op.error };
    const obra = buscar(await leer(), obraId);
    if (!obra) return { status: 'error', message: 'Obra no encontrada' };
    const { escribio, ...resultado } = aplicarOperacion(obra, op);
    if (escribio) await writeDB();
    return { status: resultado.ok ? 'ok' : 'conflict', ...resultado };
  });
}

module.exports = { listarSubrayados, operarSubrayado };
