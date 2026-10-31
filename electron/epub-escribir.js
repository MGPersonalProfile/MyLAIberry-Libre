const crypto = require('crypto');
const { crearZip, crc32 } = require('./epub-zip');
const { escaparTexto, escaparAtributo, normalizarTexto } = require('./epub-xml');
const { sanearHtml } = require('./epub-sanear');

const CARPETA = 'OEBPS';

const HOJA_DE_ESTILO = [
  'body { margin: 0 5%; line-height: 1.5; text-align: justify; }',
  '[hidden] { display: none; }',
  'h1, h2, h3 { text-align: left; line-height: 1.25; font-weight: bold; }',
  'h1.capitulo { margin: 1.5em 0 1em; page-break-before: always; }',
  'p { margin: 0 0 0.85em; text-indent: 0; }',
  'blockquote { margin: 1em 2em; font-style: italic; }',
  'hr { border: 0; border-top: 1px solid currentColor; margin: 2em 20%; }',
  'img { max-width: 100%; height: auto; }',
  'pre { white-space: pre-wrap; font-size: 0.9em; }',
  'table { border-collapse: collapse; margin: 1em auto; }',
  'td, th { border: 1px solid currentColor; padding: 0.3em 0.6em; }',
  '.portada { margin: 0; padding: 0; text-align: center; }',
  '.portada img { max-height: 100%; max-width: 100%; }',
  '.sinopsis { margin: 1em 0 2em; font-size: 0.95em; }',
  'nav ol { list-style: none; padding-left: 0; }',
  'nav li { margin: 0.35em 0; }'
].join('\n');

const ESPACIO = Buffer.from('6d796c61-6962-4572-7279-2d6570756273'.replace(/-/g, ''), 'hex');

function identificadorDe(titulo, autor) {
  const suma = crypto.createHash('sha1')
    .update(ESPACIO)
    .update(String(titulo || '') + ' | ' + String(autor || ''), 'utf8')
    .digest();
  const b = Buffer.from(suma.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return 'urn:uuid:' + h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16)
    + '-' + h.slice(16, 20) + '-' + h.slice(20);
}

const IDIOMAS = {
  'español': 'es', 'espanol': 'es', 'castellano': 'es', 'spanish': 'es',
  'inglés': 'en', 'ingles': 'en', 'english': 'en',
  'francés': 'fr', 'frances': 'fr', 'french': 'fr',
  'alemán': 'de', 'aleman': 'de', 'german': 'de',
  'italiano': 'it', 'italian': 'it',
  'portugués': 'pt', 'portugues': 'pt', 'portuguese': 'pt',
  'japonés': 'ja', 'japones': 'ja', 'japanese': 'ja',
  'coreano': 'ko', 'korean': 'ko',
  'chino': 'zh', 'chinese': 'zh', 'ruso': 'ru', 'russian': 'ru'
};

function normalizarIdioma(idioma) {
  const crudo = String(idioma || '').trim();
  if (!crudo) return 'es';
  if (/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(crudo)) return crudo.toLowerCase();
  return IDIOMAS[crudo.toLowerCase()] || 'es';
}

function tipoDeImagen(datos, declarado) {
  if (datos && datos.length >= 12) {
    if (datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff) return 'image/jpeg';
    if (datos.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
    if (datos.subarray(0, 3).toString('latin1') === 'GIF') return 'image/gif';
    if (datos.subarray(0, 4).toString('latin1') === 'RIFF'
      && datos.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
    const cabeza = datos.subarray(0, 200).toString('latin1');
    if (/<svg[\s>]/i.test(cabeza)) return 'image/svg+xml';
  }
  const t = String(declarado || '').toLowerCase();
  return /^image\/(jpeg|png|gif|webp|svg\+xml)$/.test(t) ? t : 'image/jpeg';
}

const EXTENSIONES = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/svg+xml': 'svg'
};

function selloDeTiempo(fecha) {
  return fecha.toISOString().replace(/\.\d+Z$/, 'Z');
}

function cabeceraXhtml(titulo, idioma, profundidad, extra = '') {
  const arriba = '../'.repeat(profundidad);
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<!DOCTYPE html>',
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"'
      + ' lang="' + escaparAtributo(idioma) + '" xml:lang="' + escaparAtributo(idioma) + '">',
    '<head>',
    '<meta charset="utf-8"/>',
    '<title>' + escaparTexto(titulo) + '</title>',
    '<link rel="stylesheet" type="text/css" href="' + arriba + 'estilo.css"/>',
    extra,
    '</head>'
  ].filter(Boolean).join('\n');
}

function prepararObra(obra) {
  const entrantes = Array.isArray(obra.capitulos) ? obra.capitulos : [];
  if (!entrantes.length) throw new Error('No se puede exportar una obra sin capítulos');

  const ancho = Math.max(3, String(entrantes.length).length);
  const numero = (indice) => String(indice + 1).padStart(ancho, '0');

  const titulo = String(obra.titulo || 'Sin título').trim() || 'Sin título';
  const autor = String(obra.autor || 'Autor desconocido').trim() || 'Autor desconocido';

  return {
    titulo,
    autor,
    idioma: normalizarIdioma(obra.idioma),
    editorial: String(obra.editorial || 'MyLAIberry'),
    fecha: obra.fecha instanceof Date ? obra.fecha : new Date(),
    identificador: String(obra.identificador || identificadorDe(titulo, autor)),
    portada: prepararPortada(obra.portada),
    capitulos: entrantes.map((cap, indice) => ({
      titulo: String((cap && cap.titulo) || '').trim() || 'Capítulo ' + (indice + 1),
      html: (cap && cap.html) || '',
      id: 'cap-' + numero(indice),
      ruta: 'texto/cap-' + numero(indice) + '.xhtml'
    }))
  };
}

function prepararPortada(portada) {
  if (!portada || !portada.datos || !portada.datos.length) return null;
  const datos = Buffer.isBuffer(portada.datos) ? portada.datos : Buffer.from(portada.datos);
  const tipo = tipoDeImagen(datos, portada.tipo);
  return { datos, tipo, ruta: 'imagenes/portada.' + EXTENSIONES[tipo] };
}

function paginaContenedor() {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">',
    '  <rootfiles>',
    '    <rootfile full-path="' + CARPETA + '/content.opf" media-type="application/oebps-package+xml"/>',
    '  </rootfiles>',
    '</container>'
  ].join('\n');
}

function paginaPortada(portada, titulo, idioma) {
  return [
    cabeceraXhtml('Portada', idioma, 0),
    '<body class="portada">',
    '<div class="portada"><img src="' + escaparAtributo(portada.ruta)
      + '" alt="Portada de ' + escaparAtributo(titulo) + '"/></div>',
    '</body>',
    '</html>'
  ].join('\n');
}

function paginaCapitulo(cap, idioma, imagenesRemotas) {
  return [
    cabeceraXhtml(cap.titulo, idioma, 1),
    '<body>',
    '<h1 class="capitulo">' + escaparTexto(cap.titulo) + '</h1>',
    sanearHtml(cap.html, { imagenesRemotas }),
    '</body>',
    '</html>'
  ].join('\n');
}

function paginaNav(capitulos, portada, idioma) {
  const entradas = capitulos
    .map((c, k) => '<li><a href="' + escaparAtributo(c.ruta) + '">'
      + escaparTexto(String(k + 1) + '. ' + c.titulo) + '</a></li>')
    .join('\n');

  return [
    cabeceraXhtml('Índice', idioma, 0),
    '<body>',
    '<nav epub:type="toc" id="toc">',
    '<h1>Índice</h1>',
    '<ol>',
    entradas,
    '</ol>',
    '</nav>',
    '<nav epub:type="landmarks" id="landmarks" hidden="hidden">',
    '<h2>Puntos de referencia</h2>',
    '<ol>',
    portada ? '<li><a epub:type="cover" href="portada.xhtml">Portada</a></li>' : '',
    '<li><a epub:type="bodymatter" href="' + escaparAtributo(capitulos[0].ruta) + '">Comienzo</a></li>',
    '</ol>',
    '</nav>',
    '</body>',
    '</html>'
  ].filter(Boolean).join('\n');
}

function paginaNcx({ capitulos, titulo, autor, idioma, identificador }) {
  const puntos = capitulos.map((c, k) => [
    '    <navPoint id="np-' + (k + 1) + '" playOrder="' + (k + 1) + '">',
    '      <navLabel><text>' + escaparTexto(c.titulo) + '</text></navLabel>',
    '      <content src="' + escaparAtributo(c.ruta) + '"/>',
    '    </navPoint>'
  ].join('\n')).join('\n');

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="'
      + escaparAtributo(idioma) + '">',
    '  <head>',
    '    <meta name="dtb:uid" content="' + escaparAtributo(identificador) + '"/>',
    '    <meta name="dtb:depth" content="1"/>',
    '    <meta name="dtb:totalPageCount" content="0"/>',
    '    <meta name="dtb:maxPageNumber" content="0"/>',
    '  </head>',
    '  <docTitle><text>' + escaparTexto(titulo) + '</text></docTitle>',
    '  <docAuthor><text>' + escaparTexto(autor) + '</text></docAuthor>',
    '  <navMap>',
    puntos,
    '  </navMap>',
    '</ncx>'
  ].join('\n');
}

function manifiestoDe(capitulos, portada) {
  const lineas = [
    '    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
    '    <item id="estilo" href="estilo.css" media-type="text/css"/>'
  ];
  if (portada) {
    lineas.push('    <item id="portada-imagen" href="' + escaparAtributo(portada.ruta)
      + '" media-type="' + portada.tipo + '" properties="cover-image"/>');
    lineas.push('    <item id="portada" href="portada.xhtml" media-type="application/xhtml+xml"/>');
  }
  for (const cap of capitulos) {
    lineas.push('    <item id="' + cap.id + '" href="' + escaparAtributo(cap.ruta)
      + '" media-type="application/xhtml+xml"/>');
  }
  return lineas;
}

function metadatosDe(libro, obra) {
  const { titulo, autor, idioma, editorial, fecha, identificador, portada } = libro;

  const lineas = [
    '    <dc:identifier id="id-libro">' + escaparTexto(identificador) + '</dc:identifier>',
    '    <dc:title>' + escaparTexto(titulo) + '</dc:title>',
    '    <dc:language>' + escaparTexto(idioma) + '</dc:language>',
    '    <dc:creator id="autor">' + escaparTexto(autor) + '</dc:creator>',
    '    <meta refines="#autor" property="role" scheme="marc:relators">aut</meta>',
    '    <dc:publisher>' + escaparTexto(editorial) + '</dc:publisher>',
    '    <dc:date>' + selloDeTiempo(fecha) + '</dc:date>',

    '    <meta property="dcterms:modified">' + selloDeTiempo(fecha) + '</meta>'
  ];

  const sinopsisPlana = String(obra.sinopsis || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (sinopsisPlana) {
    lineas.push('    <dc:description>' + escaparTexto(sinopsisPlana) + '</dc:description>');
  }
  if (obra.url) lineas.push('    <dc:source>' + escaparTexto(obra.url) + '</dc:source>');

  for (const etiqueta of (Array.isArray(obra.etiquetas) ? obra.etiquetas : [])) {
    const texto = String((etiqueta && etiqueta.name) || etiqueta || '').trim();
    if (texto) lineas.push('    <dc:subject>' + escaparTexto(texto) + '</dc:subject>');
  }
  if (portada) {

    lineas.push('    <meta name="cover" content="portada-imagen"/>');
  }
  return lineas;
}

function paginaOpf(libro, obra) {
  const { capitulos, portada, idioma } = libro;

  const orden = [];
  if (portada) orden.push('    <itemref idref="portada"/>');
  for (const cap of capitulos) orden.push('    <itemref idref="' + cap.id + '"/>');

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<package xmlns="http://www.idpf.org/2007/opf" version="3.0"'
      + ' unique-identifier="id-libro" xml:lang="' + escaparAtributo(idioma) + '">',
    '  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">',
    metadatosDe(libro, obra).join('\n'),
    '  </metadata>',
    '  <manifest>',
    manifiestoDe(capitulos, portada).join('\n'),
    '  </manifest>',
    '  <spine toc="ncx">',
    orden.join('\n'),
    '  </spine>',
    '</package>'
  ].join('\n');
}

function crearEpub(obra = {}) {
  const libro = prepararObra(obra);
  const { titulo, idioma, fecha, capitulos, portada } = libro;

  const ficheros = [
    { nombre: 'mimetype', datos: 'application/epub+zip', comprimir: false },
    { nombre: 'META-INF/container.xml', datos: paginaContenedor() },
    { nombre: CARPETA + '/estilo.css', datos: HOJA_DE_ESTILO }
  ];

  if (portada) {
    ficheros.push({ nombre: CARPETA + '/' + portada.ruta, datos: portada.datos, comprimir: false });
    ficheros.push({
      nombre: CARPETA + '/portada.xhtml',
      datos: paginaPortada(portada, titulo, idioma)
    });
  }

  const imagenesRemotas = obra.imagenesRemotas === true;
  for (const cap of capitulos) {
    ficheros.push({
      nombre: CARPETA + '/' + cap.ruta,
      datos: paginaCapitulo(cap, idioma, imagenesRemotas)
    });
  }

  ficheros.push({ nombre: CARPETA + '/nav.xhtml', datos: paginaNav(capitulos, portada, idioma) });
  ficheros.push({ nombre: CARPETA + '/toc.ncx', datos: paginaNcx(libro) });
  ficheros.push({ nombre: CARPETA + '/content.opf', datos: paginaOpf(libro, obra) });

  return crearZip(ficheros, fecha);
}

const BARRA = String.fromCharCode(92);
const ILEGALES_EN_WINDOWS = new RegExp('[<>:"/|?*' + BARRA + BARRA + ']', 'g');

function nombreSugerido({ titulo, autor } = {}) {
  const limpiar = (s) => [...String(s || '')]
    .filter((c) => c.charCodeAt(0) >= 32)
    .join('')
    .replace(ILEGALES_EN_WINDOWS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .replace(/[. ]+$/, '');

  const t = limpiar(titulo) || 'obra';
  const a = limpiar(autor);
  return (a ? t + ' - ' + a : t) + '.epub';
}

module.exports = {
  crearEpub,
  nombreSugerido,

  sanearHtml,
  normalizarTexto,
  escaparTexto,
  escaparAtributo,
  normalizarIdioma,
  identificadorDe,
  crearZip,
  crc32
};