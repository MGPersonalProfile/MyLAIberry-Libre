/**
 * THIRD_PARTY_NOTICES.txt: las licencias de todo lo de otros que viaja dentro de MyLAIberry.
 *
 *     node scripts/avisos-de-terceros.mjs
 *
 * Lo ejecuta `npm run dist` antes de compilar, así que nunca se desincroniza de los lockfiles. Las licencias MIT, BSD,
 * ISC y Apache piden conservar su aviso al redistribuir, y el empaquetado lo pierde: Vite junta React, framer-motion,
 * lucide y transformers.js en un solo fichero sin sus LICENSE, y algunos paquetes de node_modules no traen el suyo.
 *
 * Entran las dependencias de producción de los dos package-lock (la raíz, que va en el asar, y frontend/, cuyo código
 * acaba en el bundle), con el texto de su LICENSE/NOTICE si lo traen o, si no, su licencia declarada; y el modelo del
 * clasificador, que no es un paquete. Electron y Chromium ya dejan los suyos al lado del ejecutable
 * (LICENSE.electron.txt, LICENSES.chromium.html).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.join(RAIZ, 'THIRD_PARTY_NOTICES.txt');

/** Paquetes de producción de un package-lock, con la carpeta donde viven. */
function deProduccion(carpeta) {
  const lock = JSON.parse(fs.readFileSync(path.join(carpeta, 'package-lock.json'), 'utf8'));
  return Object.entries(lock.packages || {})
    .filter(([ruta, p]) => ruta.startsWith('node_modules/') && !p.dev && !p.devOptional)
    .map(([ruta, p]) => ({ ruta: path.join(carpeta, ruta), nombre: ruta.replace(/^.*node_modules\//, ''), version: p.version, licencia: p.license }));
}

function textosDe(carpeta) {
  if (!fs.existsSync(carpeta)) return [];
  return fs.readdirSync(carpeta)
    .filter(f => /^(licen[cs]e|copying|notice)(\.|-|$)/i.test(f))
    .sort()
    .map(f => fs.readFileSync(path.join(carpeta, f), 'utf8').trim());
}

/**
 * Para los paquetes que no traen su LICENSE: el texto estándar de la licencia que declaran, con el titular que dice su
 * package.json. MIT, ISC y BSD exigen conservar el aviso de copyright y el texto; Apache-2.0 se cita por su dirección
 * (su texto completo va una vez, abajo).
 */
const PLANTILLAS = {
  MIT: t => `Copyright (c) ${t}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`,
  ISC: t => `Copyright (c) ${t}\n\nPermission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.\n\nTHE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`,
  'BSD-2-Clause': t => `Copyright (c) ${t}\n\nRedistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:\n\n1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.\n2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.\n\nTHIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DAMAGES ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE.`,
  'BSD-3-Clause': t => `Copyright (c) ${t}\n\nRedistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:\n\n1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.\n2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.\n3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.\n\nTHIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DAMAGES ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE.`,
  'Apache-2.0': () => 'Licensed under the Apache License, Version 2.0 (https://www.apache.org/licenses/LICENSE-2.0); full text at the end of this file.'
};

/** Paquetes cuyo package.json nombra a quien lo mantiene y no a quien tiene los derechos. */
const TITULARES = { 'onnxruntime-web': 'Microsoft Corporation', 'onnxruntime-common': 'Microsoft Corporation' };

/**
 * Los nativos de Node del frontend: transformers.js los usa cuando corre en Node, pero la interfaz compilada (Vite, para
 * el navegador) no los lleva (comprobado en frontend/dist/assets: de sharp sólo aparecen nombres de métodos). No viajan
 * en MyLAIberry, así que no van aquí.
 */
const NO_VIAJAN = [/^sharp$/, /^@img\//, /^onnxruntime-node$/];

function titularDe(carpeta, nombre) {
  if (TITULARES[nombre]) return TITULARES[nombre];
  try {
    const p = JSON.parse(fs.readFileSync(path.join(carpeta, 'package.json'), 'utf8'));
    const a = typeof p.author === 'string' ? p.author : p.author?.name;
    return (a || '').replace(/\s*[<(].*$/, '').trim() || `the ${nombre} authors`;
  } catch { return `the ${nombre} authors`; }
}

function textoSinFichero(p) {
  // «(MIT OR CC0-1.0)» y parecidos: se usa la primera que tenga plantilla.
  const id = String(p.licencia || '').replace(/[()]/g, '').split(/\s+(?:OR|AND)\s+/).find(l => PLANTILLAS[l]);
  return id ? PLANTILLAS[id](titularDe(p.ruta, p.nombre)) : `(El paquete no incluye fichero de licencia; su package.json declara: ${p.licencia || 'sin declarar'}.)`;
}

const MODELO = {
  nombre: 'all-MiniLM-L6-v2 (sentence-transformers; conversión a ONNX de Xenova)',
  origen: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2 (revisión 751bff37182d3f1213fa05d7196b954e230abad9)',
  licencia: 'Apache-2.0'
};

const vistos = new Map();
const delFrontend = deProduccion(path.join(RAIZ, 'frontend')).filter(p => !NO_VIAJAN.some(re => re.test(p.nombre)));
for (const p of [...deProduccion(RAIZ), ...delFrontend]) {
  const clave = `${p.nombre}@${p.version}`;
  if (!vistos.has(clave)) vistos.set(clave, p);
}
const paquetes = [...vistos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));

const raya = '-'.repeat(78);
const partes = [
  'MyLAIberry incluye software y datos de terceros. Estos son sus avisos de licencia.',
  'MyLAIberry includes third-party software and data. These are their license notices.',
  '',
  `${paquetes.length} paquetes de npm y 1 modelo. Generado por scripts/avisos-de-terceros.mjs.`,
  '',
  raya,
  `${MODELO.nombre}`,
  `Origen: ${MODELO.origen}`,
  `Licencia: ${MODELO.licencia} (https://www.apache.org/licenses/LICENSE-2.0)`
];
let sinTexto = 0;
for (const p of paquetes) {
  const textos = textosDe(p.ruta);
  if (!textos.length) sinTexto++;
  partes.push(raya, `${p.nombre} ${p.version}`, `Licencia: ${p.licencia || 'sin declarar'}`, '',
    ...(textos.length ? textos : [textoSinFichero(p)]), '');
}
// El texto de la Apache-2.0, una vez: lo citan el modelo y los paquetes que la declaran sin traer su fichero. Se toma
// de un paquete que la incluye entera, para no copiarla a mano.
const apache = paquetes.map(p => textosDe(p.ruta).find(t => /Apache License\s+Version 2\.0, January 2004/.test(t))).find(Boolean);
if (apache) partes.push(raya, 'Apache License, Version 2.0 (full text)', '', apache.slice(apache.indexOf('Apache License')), '');
fs.writeFileSync(SALIDA, partes.join('\n') + '\n');
console.log(`[Avisos] ${path.basename(SALIDA)}: ${paquetes.length} paquetes (${sinTexto} sin fichero de licencia) y el modelo.`);
