const zlib = require('zlib');

const FIRMA_LOCAL = 0x04034b50;
const FIRMA_ENTRADA = 0x02014b50;
const FIRMA_FIN_DIRECTORIO = 0x06054b50;

const GUARDADO = 0;
const DESINFLADO = 8;

const BANDERA_UTF8 = 0x0800;

const TABLA_CRC = (() => {
  const tabla = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    tabla[n] = c;
  }
  return tabla;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function fechaDeDos(fecha) {
  const anio = Math.max(1980, Math.min(2107, fecha.getFullYear()));
  return {
    hora: (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | (fecha.getSeconds() >> 1),
    dia: ((anio - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate()
  };
}

function prepararEntrada(fichero) {
  const nombre = Buffer.from(fichero.nombre, 'utf8');
  const datos = Buffer.isBuffer(fichero.datos)
    ? fichero.datos
    : Buffer.from(String(fichero.datos), 'utf8');

  const metodo = fichero.comprimir === false ? GUARDADO : DESINFLADO;
  const carga = metodo === GUARDADO ? datos : zlib.deflateRawSync(datos, { level: 9 });

  if (datos.length > 0xffffffff || carga.length > 0xffffffff) {
    throw new Error('Entrada de más de 4 GB: haría falta ZIP64');
  }

  return { nombre, datos, carga, metodo, suma: crc32(datos) };
}

function cabeceraLocal(entrada, hora, dia) {
  const { nombre, datos, carga, metodo, suma } = entrada;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(FIRMA_LOCAL, 0);
  local.writeUInt16LE(metodo === GUARDADO ? 10 : 20, 4);
  local.writeUInt16LE(BANDERA_UTF8, 6);
  local.writeUInt16LE(metodo, 8);
  local.writeUInt16LE(hora, 10);
  local.writeUInt16LE(dia, 12);
  local.writeUInt32LE(suma, 14);
  local.writeUInt32LE(carga.length, 18);
  local.writeUInt32LE(datos.length, 22);
  local.writeUInt16LE(nombre.length, 26);
  local.writeUInt16LE(0, 28);
  return local;
}

function fichaDeDirectorio(entrada, hora, dia, desplazamiento) {
  const { nombre, datos, carga, metodo, suma } = entrada;
  const ficha = Buffer.alloc(46);
  ficha.writeUInt32LE(FIRMA_ENTRADA, 0);
  ficha.writeUInt16LE(0x031e, 4);
  ficha.writeUInt16LE(metodo === GUARDADO ? 10 : 20, 6);
  ficha.writeUInt16LE(BANDERA_UTF8, 8);
  ficha.writeUInt16LE(metodo, 10);
  ficha.writeUInt16LE(hora, 12);
  ficha.writeUInt16LE(dia, 14);
  ficha.writeUInt32LE(suma, 16);
  ficha.writeUInt32LE(carga.length, 20);
  ficha.writeUInt32LE(datos.length, 24);
  ficha.writeUInt16LE(nombre.length, 28);
  ficha.writeUInt16LE(0, 30);
  ficha.writeUInt16LE(0, 32);
  ficha.writeUInt16LE(0, 34);
  ficha.writeUInt16LE(0, 36);
  ficha.writeUInt32LE(0o644 << 16, 38);
  ficha.writeUInt32LE(desplazamiento, 42);
  return ficha;
}

function finDeDirectorio(cuantas, tamanoDirectorio, desplazamiento) {
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(FIRMA_FIN_DIRECTORIO, 0);
  fin.writeUInt16LE(0, 4);
  fin.writeUInt16LE(0, 6);
  fin.writeUInt16LE(cuantas, 8);
  fin.writeUInt16LE(cuantas, 10);
  fin.writeUInt32LE(tamanoDirectorio, 12);
  fin.writeUInt32LE(desplazamiento, 16);
  fin.writeUInt16LE(0, 20);
  return fin;
}

function crearZip(ficheros, fecha = new Date()) {
  if (ficheros.length > 0xffff) {
    throw new Error('Más de 65535 entradas: haría falta ZIP64, que este escritor no hace');
  }
  const { hora, dia } = fechaDeDos(fecha);

  const trozos = [];
  const directorio = [];
  let desplazamiento = 0;

  for (const fichero of ficheros) {
    const entrada = prepararEntrada(fichero);
    const local = cabeceraLocal(entrada, hora, dia);

    trozos.push(local, entrada.nombre, entrada.carga);
    directorio.push(fichaDeDirectorio(entrada, hora, dia, desplazamiento), entrada.nombre);

    desplazamiento += local.length + entrada.nombre.length + entrada.carga.length;
  }

  const cuerpoDirectorio = Buffer.concat(directorio);
  const fin = finDeDirectorio(ficheros.length, cuerpoDirectorio.length, desplazamiento);

  return Buffer.concat([...trozos, cuerpoDirectorio, fin]);
}

module.exports = { crearZip, crc32, fechaDeDos };
