const { app } = require('electron');

const ESQUEMA = 'mylaiberry-libre';

function extraerUrl(texto) {
  const crudo = String(texto || '').trim();
  if (!crudo.toLowerCase().startsWith(ESQUEMA + '://')) return null;

  let candidata = null;
  try {
    const u = new URL(crudo);
    candidata = u.searchParams.get('url');
  } catch {

  }

  if (!candidata) {

    const resto = crudo.slice((ESQUEMA + '://').length).replace(/^importar\/?/i, '');
    if (resto) {
      try {
        candidata = decodeURIComponent(resto);
      } catch {
        candidata = resto;
      }
    }
  }

  if (!candidata) return null;

  try {
    const destino = new URL(candidata.trim());
    if (destino.protocol !== 'http:' && destino.protocol !== 'https:') return null;
    return destino.href;
  } catch {
    return null;
  }
}

function buscarEnArgumentos(argv = []) {
  for (const a of argv) {
    const url = extraerUrl(a);
    if (url) return url;
  }
  return null;
}

let enEspera = null;
let entregar = null;

function alRecibir(url) {
  if (!url) return;
  if (entregar) entregar(url);
  else enEspera = url;
}

function registrar(cuandoLlegue) {
  entregar = cuandoLlegue;

  if (process.defaultApp) {
    if (process.env.MYLAIBERRY_REGISTRAR_ESQUEMA === '1' && process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(ESQUEMA, process.execPath, [require('path').resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient(ESQUEMA);
  }

  app.on('open-url', (evento, url) => {
    evento.preventDefault();
    alRecibir(extraerUrl(url));
  });

  alRecibir(buscarEnArgumentos(process.argv));

  return (argv) => alRecibir(buscarEnArgumentos(argv));
}

function recogerPendiente() {
  const url = enEspera;
  enEspera = null;
  return url;
}

function marcador() {
  return "javascript:(function(){window.location.href='mylaiberry-libre://importar?url='+encodeURIComponent(window.location.href)})()";
}

module.exports = { ESQUEMA, registrar, recogerPendiente, extraerUrl, marcador };
