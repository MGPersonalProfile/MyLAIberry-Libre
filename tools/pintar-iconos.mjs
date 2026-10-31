import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOGO = path.join(RAIZ, 'assets', 'logo.svg');

const SALIDAS = [
  ['assets/icon.png', 1024, false],
  ['electron/lan/cliente/icono-192.png', 192, true],
  ['electron/lan/cliente/icono-512.png', 512, true]
];

const svg = fs.readFileSync(LOGO, 'utf-8');
const aSangre = svg.replace(/(<rect width="1024" height="1024") rx="\d+"/, '$1');
if (aSangre === svg) throw new Error('logo.svg: no encuentro el fondo redondeado que quitar para el móvil');
for (const [destino, lado, sangre] of SALIDAS) {
  await sharp(Buffer.from(sangre ? aSangre : svg), { density: 300 }).resize(lado, lado).png().toFile(path.join(RAIZ, destino));
  console.log(`${destino}  ${lado}×${lado}`);
}
fs.copyFileSync(LOGO, path.join(RAIZ, 'frontend', 'public', 'favicon.svg'));

async function entradaIco(lado) {
  if (lado === 256) return sharp(Buffer.from(svg), { density: 300 }).resize(lado, lado).png().toBuffer();
  const { data } = await sharp(Buffer.from(svg), { density: 300 }).resize(lado, lado).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cabecera = Buffer.alloc(40);
  cabecera.writeUInt32LE(40, 0); cabecera.writeInt32LE(lado, 4); cabecera.writeInt32LE(lado * 2, 8);
  cabecera.writeUInt16LE(1, 12); cabecera.writeUInt16LE(32, 14);
  const pixeles = Buffer.alloc(lado * lado * 4);
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const de = (y * lado + x) * 4, a = ((lado - 1 - y) * lado + x) * 4;
      pixeles[a] = data[de + 2]; pixeles[a + 1] = data[de + 1]; pixeles[a + 2] = data[de]; pixeles[a + 3] = data[de + 3];
    }
  }
  const mascara = Buffer.alloc(Math.ceil(lado / 32) * 4 * lado);
  return Buffer.concat([cabecera, pixeles, mascara]);
}
const LADOS_ICO = [16, 24, 32, 48, 64, 128, 256];
const entradas = await Promise.all(LADOS_ICO.map(entradaIco));
const indice = Buffer.alloc(6 + 16 * entradas.length);
indice.writeUInt16LE(1, 2); indice.writeUInt16LE(entradas.length, 4);
let desplazamiento = indice.length;
entradas.forEach((datos, i) => {
  const lado = LADOS_ICO[i], o = 6 + 16 * i;
  indice.writeUInt8(lado === 256 ? 0 : lado, o); indice.writeUInt8(lado === 256 ? 0 : lado, o + 1);
  indice.writeUInt16LE(1, o + 4); indice.writeUInt16LE(32, o + 6);
  indice.writeUInt32LE(datos.length, o + 8); indice.writeUInt32LE(desplazamiento, o + 12);
  desplazamiento += datos.length;
});
fs.writeFileSync(path.join(RAIZ, 'assets', 'icon.ico'), Buffer.concat([indice, ...entradas]));
console.log(`assets/icon.ico  ${LADOS_ICO.join(', ')}`);
console.log('frontend/public/favicon.svg');
