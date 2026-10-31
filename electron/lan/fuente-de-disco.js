const path = require('path');
const fs = require('fs').promises;
const { rutaSegura, esIdValido, esIndiceValido, IDIOMA_VALIDO } = require('./rutas-seguras.js');

const TIPOS_IMAGEN = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
};

async function carpetaDentroDe(raiz, ...segmentos) {
  const destino = rutaSegura(raiz, ...segmentos);
  if (!destino) return null;
  try {
    const real = await fs.realpath(destino);
    const realRaiz = await fs.realpath(raiz);
    if (real === realRaiz) return real;
    if (!rutaSegura(realRaiz, path.relative(realRaiz, real))) return null;
    return real;
  } catch {
    return null;
  }
}

async function leerDentroDe(raiz, ...segmentos) {
  const destino = rutaSegura(raiz, ...segmentos);
  if (!destino) return null;
  try {

    const real = await fs.realpath(destino);
    const realRaiz = await fs.realpath(raiz);

    if (!rutaSegura(realRaiz, path.relative(realRaiz, real))) return null;
    return real;
  } catch {

    return null;
  }
}

function fuenteDeDisco({ raiz, obras, guardarProgreso = null, idiomaDeLectura = null }) {
  const carpetaObras = path.join(String(raiz), 'fanfics');

  return {

    guardarProgreso,
    idiomaDeLectura,

    async listarObras() {
      const lista = (await obras()) || [];
      return lista.filter(o => esIdValido(o && o.id));
    },

    async obra(id) {
      const lista = await this.listarObras();
      return lista.find(o => String(o.id) === String(id)) || null;
    },

    async capitulosDe(id) {
      if (!esIdValido(id)) return [];

      const dir = await carpetaDentroDe(carpetaObras, String(id));
      if (!dir) return [];
      let ficheros;
      try {
        ficheros = await fs.readdir(dir);
      } catch {
        return [];
      }
      const originales = new Set();
      const traducciones = new Map();
      for (const f of ficheros) {
        const original = /^chapter_(\d+)\.html$/.exec(f);
        if (original) {
          originales.add(Number(original[1]));
          continue;
        }
        const traducido = /^chapter_(\d+)\.([a-z]{2,8})\.html$/.exec(f);
        if (traducido) {
          const i = Number(traducido[1]);
          if (!traducciones.has(i)) traducciones.set(i, []);
          traducciones.get(i).push(traducido[2]);
        }
      }
      return [...originales]
        .sort((a, b) => a - b)
        .map(indice => ({ indice, idiomas: (traducciones.get(indice) || []).sort() }));
    },

    async leerCapitulo(id, indice, idioma) {
      if (!esIdValido(id) || !esIndiceValido(indice)) return null;
      const sufijo = idioma && IDIOMA_VALIDO.test(idioma) ? '.' + idioma : '';
      const ruta = await leerDentroDe(carpetaObras, String(id), 'chapter_' + Number(indice) + sufijo + '.html');
      if (!ruta) return null;
      try {
        return await fs.readFile(ruta, 'utf-8');
      } catch {
        return null;
      }
    },

    async rutaDePortada(id) {
      const obra = await this.obra(id);
      if (!obra) return null;

      const candidatas = [];
      if (obra.localCoverPath) {
        candidatas.push(path.relative(carpetaObras, path.resolve(String(obra.localCoverPath))));
      }
      candidatas.push(path.join(String(id), 'cover.jpg'), path.join(String(id), 'cover.png'));

      for (const rel of candidatas) {
        const tipo = TIPOS_IMAGEN[path.extname(rel).toLowerCase()];
        if (!tipo) continue;
        const ruta = await leerDentroDe(carpetaObras, rel);
        if (ruta) return { ruta, tipo };
      }
      return null;
    },

    async tienePortada(id) {
      return !!(await this.rutaDePortada(id));
    },

    async leerPortada(id) {
      const encontrada = await this.rutaDePortada(id);
      if (!encontrada) return null;
      try {
        return { datos: await fs.readFile(encontrada.ruta), tipo: encontrada.tipo };
      } catch {

        return null;
      }
    }
  };
}

module.exports = { fuenteDeDisco, carpetaDentroDe, leerDentroDe, TIPOS_IMAGEN };
