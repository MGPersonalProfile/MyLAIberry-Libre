const FASES = ['preparando', 'buscando', 'internet', 'terminada'];

function progresoDeFase(fase, kind) {
  const camino = kind === 'lost' ? FASES : FASES.filter(f => f !== 'internet');
  const i = camino.indexOf(fase);
  return i < 0 ? null : { hecho: i, total: camino.length - 1 };
}

module.exports = { FASES, progresoDeFase };
