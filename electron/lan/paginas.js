const { limpiarHtml } = require('../limpiar-html.js');

function escaparHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function limpiarCapitulo(html) {

  return limpiarHtml(html);
}

const CSS = [
  ':root { color-scheme: dark; }',
  '* { box-sizing: border-box; }',
  'body {',
  '  margin: 0;',
  '  background: #101014;',
  '  color: #e6e6ea;',
  '  font-family: Georgia, "Iowan Old Style", "Times New Roman", serif;',
  '  font-size: 19px;',
  '  line-height: 1.7;',
  '  -webkit-text-size-adjust: 100%;',
  '}',

  '.hoja { max-width: 34rem; margin: 0 auto; padding: 1.25rem 1.15rem 4rem; }',
  'a { color: #ff5b5b; text-decoration: none; }',
  'a:hover { text-decoration: underline; }',
  'h1 { font-size: 1.55rem; line-height: 1.25; margin: 0 0 .35rem; }',
  'h2 { font-size: 1.1rem; margin: 2rem 0 .6rem; color: #9a9aa6; font-weight: normal; }',
  '.migas { font-family: system-ui, sans-serif; font-size: .82rem; color: #9a9aa6; margin-bottom: 1.4rem; }',

  '.migas a { color: #9a9aa6; display: inline-block; padding: .7rem .15rem; }',
  '.autor { color: #9a9aa6; font-size: .95rem; margin: 0 0 1.5rem; }',

  '.obras { list-style: none; padding: 0; margin: 0; }',
  '.obras li { border-bottom: 1px solid #26262e; }',
  '.obras a { display: flex; gap: .9rem; align-items: center; padding: .85rem .2rem; color: inherit; }',
  '.obras img, .obras .sinportada {',
  '  width: 54px; height: 78px; flex: none; object-fit: cover;',
  '  border-radius: 4px; background: #26262e;',
  '}',

  '.obras .titulo { display: block; font-size: 1rem; line-height: 1.35; }',
  '.obras .pie { display: block; font-family: system-ui, sans-serif; font-size: .78rem; color: #9a9aa6; margin-top: .25rem; }',

  '.obras .sinportada {',
  '  display: flex; align-items: center; justify-content: center;',
  '  font-size: 1.6rem; color: #4e4e5c;',
  '}',
  '.caps { list-style: none; padding: 0; margin: 0; }',
  '.caps li { border-bottom: 1px solid #26262e; }',

  '.caps a { display: block; padding: .85rem .2rem; min-height: 3rem; }',
  '.caps .marca { font-family: system-ui, sans-serif; font-size: .75rem; color: #6f6f7d; }',
  '.aqui { color: #ff5b5b; }',
  '.seguir {',
  '  display: block; text-align: center; padding: .9rem;',
  '  background: #ff5b5b; color: #14141a; border-radius: 6px;',
  '  font-family: system-ui, sans-serif; font-weight: 600; margin: 0 0 1.6rem;',
  '}',
  '.seguir:hover { text-decoration: none; opacity: .9; }',
  '.idiomas { font-family: system-ui, sans-serif; font-size: .85rem; margin-bottom: 1.5rem; color: #9a9aa6; }',

  '.idiomas a { display: inline-block; padding: .55rem .4rem; }',
  '.texto p { margin: 0 0 1.15rem; }',
  '.texto img { max-width: 100%; height: auto; }',
  '.texto hr { border: 0; border-top: 1px solid #26262e; margin: 2rem 0; }',

  '.pasos { display: flex; gap: .6rem; margin-top: 2.5rem; font-family: system-ui, sans-serif; font-size: .9rem; }',
  '.pasos a, .pasos span { flex: 1; text-align: center; padding: .85rem .5rem; border: 1px solid #33333d; border-radius: 6px; }',
  '.pasos span { color: #55555f; }',
  '.vacio { color: #9a9aa6; }'
].join('\n');

function pagina({ titulo, cuerpo, base, datos = '' }) {
  return [
    '<!doctype html>',
    '<html lang="es">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',

    '<meta name="theme-color" content="#141414">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
    '<title>' + escaparHtml(titulo) + '</title>',
    '<link rel="manifest" href="' + base + '/manifest.webmanifest">',
    '<link rel="apple-touch-icon" href="' + base + '/icono-192.png">',
    '<link rel="stylesheet" href="' + base + '/estilo.css">',
    '<script src="' + base + '/app.js" defer></script>',
    '</head>',

    '<body data-base="' + escaparHtml(base) + '" data-ahora="' + Date.now() + '"' + datos + '><div class="hoja">',
    cuerpo,
    '</div></body></html>'
  ].join('\n');
}

const datoJson = (nombre, valor) => ' data-' + nombre + '="' + escaparHtml(JSON.stringify(valor)) + '"';

const leidaEn = (obra) => Number(obra.progresoEn || obra.lastReadAt) || 0;

function paraAdelantar(obras, base) {
  return obras.filter(o => leidaEn(o) || Number(o.currentChapter) > 0)
    .sort((a, b) => leidaEn(b) - leidaEn(a)).slice(0, 6)
    .flatMap(o => {
      const obra = base + '/obra/' + encodeURIComponent(o.id);
      const vas = Number(o.currentChapter) || 0;
      return [obra, ...[0, 1, 2].map(k => obra + '/cap/' + (vas + k))];
    });
}

function paginaBiblioteca(obras, base) {
  if (!obras.length) {
    return pagina({
      titulo: 'MyLAIberry',
      base,
      cuerpo: '<h1>MyLAIberry</h1><p class="vacio">No hay ninguna obra que servir.</p>'
    });
  }

  const filas = obras.map(o => {
    const total = o.totalChapters || (o.chapterList || []).length || 0;
    const vas = Number(o.currentChapter) || 0;
    const pie = total ? 'Capítulo ' + (vas + 1) + ' de ' + total : 'Sin capítulos contados';

    const inicial = escaparHtml([...String(o.title || '?').trim()][0] || '?').toUpperCase();
    const portada = o.tienePortada
      ? '<img src="' + base + '/portada/' + encodeURIComponent(o.id) + '" alt="">'
      : '<span class="sinportada" aria-hidden="true">' + inicial + '</span>';
    return [
      '<li><a href="' + base + '/obra/' + encodeURIComponent(o.id) + '">',
      portada,
      '<span><span class="titulo">' + escaparHtml(o.title || 'Sin título') + '</span>',
      '<span class="pie">' + escaparHtml(o.author || 'Autor desconocido') + ' · ' + escaparHtml(pie) + '</span></span>',
      '</a></li>'
    ].join('');
  });

  return pagina({
    titulo: 'MyLAIberry',
    base,
    datos: datoJson('adelantar', paraAdelantar(obras, base)),
    cuerpo: [
      '<h1>Tu biblioteca</h1>',
      '<p class="autor">' + obras.length + (obras.length === 1 ? ' obra' : ' obras') + ' en este ordenador.</p>',
      '<ul class="obras">' + filas.join('') + '</ul>'
    ].join('\n')
  });
}

function paginaObra(obra, capitulos, base) {
  const titulos = obra.chapterList || [];
  const vas = Number(obra.currentChapter) || 0;
  const hayDondeSeguir = capitulos.some(c => c.indice === vas);

  const filas = capitulos.map(c => {
    const nombre = (titulos[c.indice] && titulos[c.indice].title) || 'Capítulo ' + (c.indice + 1);
    const aqui = c.indice === vas ? ' <span class="marca aqui">— vas por aquí</span>' : '';
    const traducido = c.idiomas.length ? ' <span class="marca">· ' + escaparHtml(c.idiomas.join(', ')) + '</span>' : '';
    return [
      '<li><a href="' + base + '/obra/' + encodeURIComponent(obra.id) + '/cap/' + c.indice + '">',
      escaparHtml(nombre), aqui, traducido,
      '</a></li>'
    ].join('');
  });

  const plantilla = base + '/obra/' + encodeURIComponent(obra.id) + '/cap/{n}';
  const seguir = hayDondeSeguir
    ? '<a class="seguir" href="' + plantilla.replace('{n}', vas) + '" data-obra="' + escaparHtml(obra.id) + '"' +
      ' data-plantilla="' + escaparHtml(plantilla) + '"' + datoJson('progreso', { capitulo: vas,
        en: leidaEn(obra), revision: Number(obra.lecturaRevision) || 0 }) +
      '>Seguir por el capítulo ' + (vas + 1) + '</a>'
    : '';

  const cuerpo = [
    '<p class="migas"><a href="' + base + '/">← Biblioteca</a></p>',
    '<h1>' + escaparHtml(obra.title || 'Sin título') + '</h1>',
    '<p class="autor">' + escaparHtml(obra.author || 'Autor desconocido') + '</p>',
    seguir,
    '<h2>' + capitulos.length + (capitulos.length === 1 ? ' capítulo en disco' : ' capítulos en disco') + '</h2>',
    capitulos.length
      ? '<ul class="caps">' + filas.join('') + '</ul>'
      : '<p class="vacio">Todavía no hay ningún capítulo descargado de esta obra.</p>'
  ];
  return pagina({ titulo: obra.title || 'Obra', base, cuerpo: cuerpo.join('\n') });
}

function posicionDelPc(obra, indice) {
  const guardada = obra.scrollPositions && obra.scrollPositions[indice];
  return { capitulo: indice, ancla: (guardada && guardada.ancla) || null,
    en: leidaEn(obra), revision: Number(obra.lecturaRevision) || 0 };
}

function paginaCapitulo({ obra, indice, html, idioma, consulta, idiomas, capitulos, base }) {
  const titulos = obra.chapterList || [];
  const nombre = (titulos[indice] && titulos[indice].title) || 'Capítulo ' + (indice + 1);
  const enlaceObra = base + '/obra/' + encodeURIComponent(obra.id);
  const posiciones = capitulos.map(c => c.indice);
  const dondeEstoy = posiciones.indexOf(indice);
  const anterior = dondeEstoy > 0 ? posiciones[dondeEstoy - 1] : null;
  const siguiente = dondeEstoy >= 0 && dondeEstoy < posiciones.length - 1 ? posiciones[dondeEstoy + 1] : null;

  const sufijo = i => enlaceObra + '/cap/' + i + (consulta ? '?idioma=' + encodeURIComponent(consulta) : '');

  let barra = '';
  if (idiomas.length) {
    const opciones = [
      idioma
        ? '<a href="' + enlaceObra + '/cap/' + indice + '?idioma=original">Original</a>'
        : '<strong>Original</strong>'
    ];
    for (const l of idiomas) {
      opciones.push(
        l === idioma
          ? '<strong>' + escaparHtml(l) + '</strong>'
          : '<a href="' + enlaceObra + '/cap/' + indice + '?idioma=' + encodeURIComponent(l) + '">' + escaparHtml(l) + '</a>'
      );
    }
    barra = '<p class="idiomas">' + opciones.join(' · ') + '</p>';
  }

  const pasos = [
    anterior !== null ? '<a href="' + sufijo(anterior) + '">← Anterior</a>' : '<span>← Anterior</span>',
    '<a href="' + enlaceObra + '">Índice</a>',
    siguiente !== null ? '<a href="' + sufijo(siguiente) + '">Siguiente →</a>' : '<span>Siguiente →</span>'
  ].join('');

  const cuerpo = [
    '<p class="migas"><a href="' + base + '/">Biblioteca</a> · <a href="' + enlaceObra + '">' + escaparHtml(obra.title || 'Obra') + '</a></p>',
    '<h1>' + escaparHtml(nombre) + '</h1>',
    barra,
    '<main id="lectura" data-obra="' + escaparHtml(obra.id) + '" data-capitulo="' + indice + '"' +
      datoJson('posicion', posicionDelPc(obra, indice)) +
      datoJson('siguientes', posiciones.slice(dondeEstoy + 1, dondeEstoy + 6).map(sufijo)) + '>',
    '<div class="texto">' + limpiarCapitulo(html) + '</div>',
    '</main>',
    '<nav class="pasos">' + pasos + '</nav>'
  ];
  return pagina({ titulo: nombre, base, cuerpo: cuerpo.join('\n'),
    datos: datoJson('revision', Number(obra.lecturaRevision) || 0) });
}

module.exports = {
  escaparHtml,
  limpiarCapitulo,
  pagina,
  paginaBiblioteca,
  paginaObra,
  paginaCapitulo,
  CSS
};
