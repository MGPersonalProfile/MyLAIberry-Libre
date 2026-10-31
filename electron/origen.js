const esDeLaBiblioteca = (f) => f?.origen !== 'descubierta' && f?.origen !== 'descartada';

function cambiarOrigen(f, origen) {
  if (!f || f.origen === origen) return false;
  if (!esDeLaBiblioteca(f) && esDeLaBiblioteca({ origen })) f.enBibliotecaDesde = Date.now();
  f.origen = origen;
  return true;
}

module.exports = { esDeLaBiblioteca, cambiarOrigen };
