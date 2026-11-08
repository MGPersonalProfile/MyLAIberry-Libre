const { ID_VALIDO } = require('../lan/rutas-seguras.js');
let nucleoReal = null;
try { nucleoReal = require('./nucleo.js'); } catch {}
let revisionesReal = null;
try { revisionesReal = require('../lector/revisiones.js'); } catch {}

const ID_OP = /^[\w-]{1,80}$/;
const MAX_RECIBOS = 2000;
const idValido = id => (typeof id === 'string' || Number.isSafeInteger(id)) && ID_VALIDO.test(String(id));
const buscar = (datos, id) => datos?.fanfics?.find(f => String(f.id) === String(id));

function obtenerEstado(obra) {
  if (!obra.eleccionIdioma) {
    obra.eleccionIdioma = {
      revision: obra.idiomaRevision || 0,
      idioma: obra.idioma || 'es',
      recibos: []
    };
  }
  obra.eleccionIdioma.recibos ||= [];
  return obra.eleccionIdioma;
}

function crearFunciones(dbInyectada, enSerieInyectado) {
  const getDb = dbInyectada || nucleoReal;
  const enSerie = enSerieInyectado || (revisionesReal ? revisionesReal.enSeriePorObra : ((_, fn) => fn()));

  async function leerEleccionIdioma(obraId) {
    if (!idValido(obraId)) return { status: 'error', error: 'Obra no válida' };
    return enSerie(obraId, async () => {
      const db = await getDb.leer();
      const obra = buscar(db, obraId);
      if (!obra) return { status: 'error', error: 'Obra no encontrada' };
      const est = obtenerEstado(obra);
      return { status: 'ok', obraId: String(obraId), idioma: est.idioma, revision: est.revision };
    });
  }

  async function aplicarEleccionIdioma(operacion) {
    if (!operacion || typeof operacion !== 'object') return { status: 'error', error: 'Operación no válida' };
    const { obraId, idioma, revisionBase, aparatoId, operacionId } = operacion;
    if (!idValido(obraId)) return { status: 'error', error: 'Obra no válida' };
    if (!ID_OP.test(String(operacionId || '')) || !ID_OP.test(String(aparatoId || ''))) {
      return { status: 'error', error: 'Identificadores no válidos' };
    }
    if (!Number.isInteger(revisionBase) || revisionBase < 0) return { status: 'error', error: 'Revisión base no válida' };
    if (typeof idioma !== 'string' || !/^[a-z]{2,8}$/.test(idioma)) return { status: 'error', error: 'Idioma no válido' };

    return enSerie(obraId, async () => {
      const db = await getDb.leer();
      const obra = buscar(db, obraId);
      if (!obra) return { status: 'error', error: 'Obra no encontrada' };
      const est = obtenerEstado(obra);

      const recibo = est.recibos.find(r => r.aparatoId === aparatoId && r.operacionId === operacionId);
      if (recibo) {
        return { status: 'ok', repetida: true, obraId: String(obraId), idioma: est.idioma, revision: recibo.revision };
      }

      if (revisionBase !== est.revision) {
        return {
          status: 'conflict',
          conflicto: true,
          obraId: String(obraId),
          eleccionLocal: { idioma, revisionBase, aparatoId, operacionId },
          eleccionPC: { idioma: est.idioma, revision: est.revision }
        };
      }

      const revision = ++est.revision;
      est.idioma = idioma;
      obra.idioma = idioma;
      obra.idiomaRevision = revision;
      est.recibos = [...est.recibos.slice(-(MAX_RECIBOS - 1)), { aparatoId, operacionId, revision }];
      if (getDb.writeDB) await getDb.writeDB();

      return { status: 'ok', obraId: String(obraId), idioma, revision, operacionId };
    });
  }

  async function resolverEleccionIdioma(operacion) {
    return aplicarEleccionIdioma(operacion);
  }

  return { leerEleccionIdioma, aplicarEleccionIdioma, resolverEleccionIdioma };
}

const porDefecto = crearFunciones();

module.exports = {
  leerEleccionIdioma: porDefecto.leerEleccionIdioma,
  aplicarEleccionIdioma: porDefecto.aplicarEleccionIdioma,
  resolverEleccionIdioma: porDefecto.resolverEleccionIdioma,
  conDb: (dbMock, enSerieMock) => crearFunciones(dbMock, enSerieMock)
};
