const TOPE_HERRAMIENTA = 150000;

const CON_DIALOGO = new Set(['importar_libro', 'exportar_epub']);
const TOPE_CON_DIALOGO = 15 * 60 * 1000;

const topeDe = (nombre, porDefecto = TOPE_HERRAMIENTA) => (CON_DIALOGO.has(nombre) || /^(buscar_fanfics_a_fondo|investigar_fanfics_web)$/.test(nombre)
  ? Math.max(porDefecto, TOPE_CON_DIALOGO) : porDefecto);

function conTope(promesa, nombre, signal, tope = TOPE_HERRAMIENTA) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Petición cancelada.')); return; }

    let reloj = null;
    const acabar = (fn, valor) => {
      clearTimeout(reloj);
      signal?.removeEventListener('abort', abortar);
      fn(valor);
    };
    const abortar = () => acabar(reject, new Error('Petición cancelada.'));
    reloj = setTimeout(() => acabar(reject, new Error(`«${nombre}» no contestó en ${Math.round(tope / 1000)} s y se dejó.`)), tope);
    signal?.addEventListener('abort', abortar, { once: true });
    Promise.resolve(promesa).then(v => acabar(resolve, v), e => acabar(reject, e));
  });
}

module.exports = { conTope, topeDe, TOPE_HERRAMIENTA };
