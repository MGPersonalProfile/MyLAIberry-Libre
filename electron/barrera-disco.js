let cerrada = null;
let abrirla = null;
let activas = 0;

async function conDisco(fn) {
  while (cerrada) await cerrada;
  activas++;
  try {
    return await fn();
  } finally {
    activas--;
  }
}

function cerrar() {
  if (!cerrada) cerrada = new Promise(r => { abrirla = r; });
}

function abrir() {
  const avisar = abrirla;
  cerrada = null;
  abrirla = null;
  if (avisar) avisar();
}

const ocupada = () => activas > 0;

const enLaCarpeta = (fn) => (...args) => conDisco(() => fn(...args));

module.exports = { conDisco, enLaCarpeta, cerrar, abrir, ocupada };
