const fs = require('fs');
const path = require('path');

const SW = fs.readFileSync(path.join(__dirname, 'cliente', 'sw.js'), 'utf-8');
const VIAJE = fs.readFileSync(path.join(__dirname, 'cliente', 'obras-offline.js'), 'utf-8');
const APP = fs.readFileSync(path.join(__dirname, 'cliente', 'app.js'), 'utf-8');

function swConVersion() {
  const { precargaDeLaApp } = require('./app-web.js');
  const huella = require('crypto').createHash('sha256').update(precargaDeLaApp().join('\n')).digest('hex').slice(0, 16);
  return `${VIAJE}\n${SW}\n// app: ${huella}\n`;
}

const icono = (nombre) => fs.readFileSync(path.join(__dirname, 'cliente', nombre));
const ICONOS = { 'icono-192.png': icono('icono-192.png'), 'icono-512.png': icono('icono-512.png') };

function manifiesto(base) {
  return JSON.stringify({
    name: 'MyLAIberry',
    short_name: 'MyLAIberry',
    description: 'Tu biblioteca, desde el PC de casa.',
    lang: 'es',

    start_url: base + '/app/',
    scope: base + '/',
    display: 'standalone',
    background_color: '#141418',
    theme_color: '#141418',
    icons: [
      { src: base + '/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: base + '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ],

    share_target: {
      action: base + '/app/',
      method: 'GET',
      params: { title: 'compartido_titulo', text: 'compartido_texto', url: 'compartido_url' }
    }
  });
}

function piezaDeLaApp(nombre, base) {
  if (nombre === 'manifest.webmanifest') return { tipo: 'application/manifest+json', cuerpo: manifiesto(base) };
  if (nombre === 'sw.js') return { tipo: 'text/javascript; charset=utf-8', cuerpo: swConVersion() };
  if (nombre === 'app.js') return { tipo: 'text/javascript; charset=utf-8', cuerpo: APP };
  if (ICONOS[nombre]) return { tipo: 'image/png', cuerpo: ICONOS[nombre] };
  return null;
}

module.exports = { piezaDeLaApp, manifiesto };
