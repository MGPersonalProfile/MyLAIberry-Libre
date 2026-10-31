const PARES = new Map([
  ['"', '"'],
  ['“', '”'],
  ['«', '»'],
  ['「', '」']
]);
const CIERRES = new Set(PARES.values());

const TRAS_RAYA_DE_CIERRE = /[\s.,;:!?…)\]}»”」]/u;

function agregar(tramos, tipo, texto) {
  if (!texto) return;
  const ultimo = tramos.at(-1);
  if (ultimo?.tipo === tipo) ultimo.texto += texto;
  else tramos.push({ tipo, texto });
}

function porComillas(texto, tipoBase = 'narracion') {
  const tramos = [];
  const pila = [];

  for (const caracter of texto) {
    const cierreEsperado = pila.at(-1);
    if (cierreEsperado === caracter) {
      agregar(tramos, 'dialogo', caracter);
      pila.pop();
    } else if (PARES.has(caracter) && !CIERRES.has(caracter)) {
      agregar(tramos, 'dialogo', caracter);
      pila.push(PARES.get(caracter));
    } else if (caracter === '"') {
      agregar(tramos, 'dialogo', caracter);
      pila.push('"');
    } else {
      agregar(tramos, pila.length ? 'dialogo' : tipoBase, caracter);
    }
  }
  return tramos;
}

function porRayas(texto, primeraRaya) {
  const tramos = [];
  let tipo = 'dialogo';
  let cerrarInciso = false;

  for (let i = 0; i < texto.length; i++) {
    const caracter = texto[i];
    if (i === primeraRaya) {
      agregar(tramos, tipo, caracter);
    } else if (caracter === '—') {
      if (tipo === 'dialogo') tipo = 'narracion';
      else cerrarInciso = true;
      agregar(tramos, 'narracion', caracter);
    } else if (cerrarInciso && !TRAS_RAYA_DE_CIERRE.test(caracter)) {
      tipo = 'dialogo';
      cerrarInciso = false;
      agregar(tramos, tipo, caracter);
    } else {
      agregar(tramos, tipo, caracter);
    }
  }
  return tramos;
}

function aplicarComillas(tramos) {
  const resultado = [];
  for (const tramo of tramos) {
    const partes = tramo.tipo === 'narracion'
      ? porComillas(tramo.texto)
      : [tramo];
    for (const parte of partes) agregar(resultado, parte.tipo, parte.texto);
  }
  return resultado;
}

export function trocearDialogos(texto) {
  if (!texto) return [];
  const primerContenido = texto.search(/\S/u);
  if (primerContenido >= 0 && texto[primerContenido] === '—') {
    return aplicarComillas(porRayas(texto, primerContenido));
  }
  return porComillas(texto);
}
