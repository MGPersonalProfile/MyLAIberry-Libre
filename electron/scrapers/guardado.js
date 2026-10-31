function exigirAlgoGuardado(guardados, pedidos, sitio) {
  if (pedidos > 0 && guardados === 0) {
    throw new Error(
      `No se pudo guardar ningún capítulo de los ${pedidos} que tiene la obra. ` +
      `${sitio} puede estar limitando las peticiones; se reintentará.`
    );
  }
}

module.exports = { exigirAlgoGuardado };
