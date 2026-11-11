const obra = { type: 'string', minLength: 1, maxLength: 300, description: 'Título o id de la obra' };

const capitulo = { type: 'integer', minimum: 1, maximum: 100000, description: 'Número del capítulo tal como lo dice el usuario, empezando en 1' };
const indice = (n) => n - 1;
const texto = { type: 'string', minLength: 1, maxLength: 300 };
const conObra = (fn) => async (a, c) => fn(c.obra.id, a, c);

const dominio = (url) => { try { return new URL(url).hostname || url; } catch { return String(url).slice(0, 80); } };

function capituloQueExiste(n, obra) {
  const total = obra?.totalChapters || obra?.chapterList?.length || 0;
  if (total && n > total) {
    throw Object.assign(new Error(`«${obra.title}» tiene ${total} capítulos: no hay un capítulo ${n}. No se ha marcado nada.`), { delUsuario: true });
  }
  return n;
}

function umbralDe(a) {
  const u = { kudosMinimos: a.kudos_minimos, palabrasMinimas: a.palabras_minimas, soloCompletas: a.solo_completas };
  const pedido = Object.fromEntries(Object.entries(u).filter(([, v]) => v !== undefined));
  return Object.keys(pedido).length ? pedido : undefined;
}

function ritmoLegible(r, c) {
  const total = (c.obra?.chapterList || []).length || c.obra?.totalChapters || 0;
  const actual = Number(c.obra?.currentChapter) || 0;

  const empezada = Boolean(c.obra?.lastReadAt) || actual > 0;
  return {
    obra: c.obra?.title,
    capitulosTotales: total,
    vasPorElCapitulo: empezada ? actual + 1 : null,
    capitulosPorLeer: empezada ? Math.max(0, total - actual - 1) : total,
    palabrasPorMinuto: r?.ppm ?? null,
    minutosDeLecturaQueFaltan: r?.restantes ?? null,
    horasDeLecturaQueFaltan: r?.restantes != null ? Math.round(r.restantes / 6) / 10 : null,
    ...(r?.ppm ? {} : { aviso: `Aún no hay ritmo medido: faltan ${r?.faltan ?? '?'} lecturas.` })
  };
}

async function traduccionDicha(r, c) {
  const idioma = await c.idioma();
  return { traducido: true, yaEstaba: !!r?.cacheado, mismoIdioma: !!r?.mismoIdioma, idioma,
    ...require('./traduccion-aviso.js').quienYComo(r),
    aviso: `Está en «${idioma}», el idioma de la app. A otro idioma no se traduce desde aquí: habría que cambiar el de la app en Ajustes > Idioma.` };
}

async function ritmoDeTodas(r, c, a = {}) {
  const { estadoDeLectura } = require('./asistente-obra');
  const obras = (await c.obras()).filter(o => a.sin_empezar ? estadoDeLectura(o) !== 'terminada' && estadoDeLectura(o) !== 'al día' : estadoDeLectura(o) === 'a medias');
  const porObra = [];
  for (const o of obras) porObra.push({ ...ritmoLegible(await c.llamar('get-reading-pace', [o.id]), { obra: o }) });
  const medidas = porObra.filter(p => p.minutosDeLecturaQueFaltan != null);
  const minutos = medidas.reduce((n, p) => n + p.minutosDeLecturaQueFaltan, 0);
  return {
    obrasContadas: porObra.length, palabrasPorMinuto: r?.ppm ?? null,
    capitulosPorLeer: porObra.reduce((n, p) => n + p.capitulosPorLeer, 0),
    minutosDeLecturaQueFaltan: minutos, horasDeLecturaQueFaltan: Math.round(minutos / 6) / 10,
    ...(medidas.length < porObra.length ? { sinMedir: porObra.filter(p => p.minutosDeLecturaQueFaltan == null).map(p => p.obra), avisoSinMedir: 'Las de sinMedir no entran en las horas: no se sabe cuánto ocupan.' } : {}),
    porObra: porObra.sort((x, y) => (y.horasDeLecturaQueFaltan || 0) - (x.horasDeLecturaQueFaltan || 0))
      .map(p => ({ obra: p.obra, capitulosPorLeer: p.capitulosPorLeer, horas: p.horasDeLecturaQueFaltan })),
    ...(r?.ppm ? {} : { aviso: `Aún no hay ritmo medido: faltan ${r?.faltan ?? '?'} lecturas.` })
  };
}

async function repetidosDe(primero, c, a = {}) {
  const total = (c.obra?.chapterList || []).length || c.obra?.totalChapters || 0;
  const numeros = a.capitulos?.length ? a.capitulos : Array.from({ length: total }, (_, i) => i + 1);
  return { obra: c.obra?.title, ...await require('./en-hilo.js').enHilo('repetidos', { capitulos: await capitulosDelDisco(numeros, primero, c) }) };
}

async function capitulosDelDisco(numeros, primero, c) {
  const capitulos = [];
  for (const numero of numeros) {
    const html = numero === 1 ? primero : await c.llamar('get-chapter-content', [c.obra.id, indice(numero)]);
    capitulos.push({ numero, html: typeof html === 'string' ? html : '' });
  }
  return capitulos;
}

async function apariciones(primero, c, a = {}) {
  const total = (c.obra?.chapterList || []).length || c.obra?.totalChapters || 0;
  const empezada = Boolean(c.obra?.lastReadAt) || (Number(c.obra?.currentChapter) || 0) > 0;
  const hastaSuPunto = a.mas_alla_de_donde_voy ? total : (empezada ? Math.min(total, (Number(c.obra.currentChapter) || 0) + 1) : 0);

  const hasta = a.hastaCapitulo != null ? Math.min(hastaSuPunto, a.hastaCapitulo) : hastaSuPunto;
  const numeros = Array.from({ length: hasta }, (_, i) => i + 1);
  const limite = hasta < total
    ? { soloHastaElCapitulo: hasta, aviso: (hasta ? `Sólo hasta el capítulo ${hasta}, por el que va: más allá sería destripe.` : 'No ha empezado la obra: buscar en ella sería destripe.')

      + (a.hastaCapitulo != null ? ' Desde el lector no se busca más allá; si lo pide expresamente, puede hacerlo en el chat de la biblioteca (fuera del lector), que sí busca en toda la obra.' : '') }
    : {};
  return { obra: c.obra?.title, buscado: a.texto, ...limite, ...await require('./en-hilo.js').enHilo('buscar', { capitulos: await capitulosDelDisco(numeros, primero, c), buscado: a.texto }) };
}

function guardadoEn(r) {
  if (r?.status === 'cancelado') return { hecho: false, aviso: 'Cerró el diálogo sin guardar: no se ha exportado nada.' };
  const enOriginal = r?.traducido && r.capitulosTraducidos != null ? r.capitulos - r.capitulosTraducidos : 0;
  return { hecho: true, guardadoEn: r?.ruta, capitulos: r?.capitulos, total: r?.total, traducido: r?.traducido,
    idiomaOriginal: r?.idiomaOriginal || 'no consta', idiomaSolicitado: r?.idiomaSolicitado,
    ...(r?.traducido && r.capitulosTraducidos != null ? { traducidos: r.capitulosTraducidos, enIdiomaOriginal: enOriginal } : {}),
    aviso: 'Ya está guardado en esa ruta: el usuario eligió el sitio en el diálogo, que ya se cerró. Díselo con la ruta.'
      + (enOriginal ? ` De esos capítulos, ${enOriginal} no tenían traducción y van en el idioma original: díselo. El idioma original es ${r?.idiomaOriginal || 'desconocido'}; no afirmes que es el solicitado sin comprobarlo.` : '') };
}

function sugerenciasCortas(lista) {
  const vacio = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
  return (Array.isArray(lista) ? lista : []).map(o => Object.fromEntries(Object.entries({ title: o.title, author: o.author, source: o.source, url: o.url,
    completa: o.completa, capitulos: o.totalChapters || (o.chapterList || []).length, palabras: o.wordCount,
    etiquetas: (o.tags || []).map(t => t?.name || t).filter(Boolean).slice(0, 6), sinopsis: String(o.synopsis || '').slice(0, 300) })
    .filter(([, v]) => !vacio(v) && v !== 0)));
}

function sinLasDeLaMisma(lista, c) {
  const n = (t) => String(t || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
  const autor = n(c.obra?.author), titulo = n(c.obra?.title);
  return (Array.isArray(lista) ? lista : []).filter(o => !(autor && n(o.author) === autor) && !(titulo && n(o.title).includes(titulo)));
}

const SOLO_DEL_ASISTENTE = ['abrir-obra-en-pantalla', 'importar-texto', 'recordar-lectura'];

function sugerenciasEnCorto(lista, filtro) {
  const n = (t) => String(t || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const palabras = n(filtro).split(/\s+/).filter(Boolean);
  const todas = Array.isArray(lista) ? lista : [];
  const elegidas = todas.filter(o => palabras.every(p => n([o.title, o.author, ...(o.tags || []).map(t => t?.name || t)].join(' ')).includes(p)));
  return { total: todas.length, ...(filtro ? { coinciden: elegidas.length } : {}),

    obras: elegidas.map(o => ({ id: String(o.id), title: o.title, author: o.author, source: o.source, totalChapters: o.totalChapters || 0,
      palabras: o.wordCount || undefined, completa: o.completa, popularidad: o.kudos || 0 })) };
}

const CATALOGO = [

  { nombre: 'estadisticas', nivel: 'lectura', canal: 'get-stats', args: async () => [],

    descripcion: 'Cifras de la biblioteca: obras totales, terminadas (leídas hasta el último capítulo y concluidas), al día (leídas hasta el último pero siguen abiertas), en curso, cuál es la más larga con título y capítulos, capítulos listados y en disco, traducidos, leídos, obras por sitio, espacio en disco y descargas en cola. No tiene palabras leídas ni rachas: dilo si te las piden.' },

  { nombre: 'ritmo_de_lectura', nivel: 'lectura', canal: 'get-reading-pace', parametros: { obra, sin_empezar: { type: 'boolean', description: 'Sin obra: contar también las que no ha empezado' } },
    requeridos: [], obraOpcional: true, enLectura: true, enLecturaDevuelve: (r, c) => ritmoLegible(r, c),
    args: async (a, c) => [c.obra ? c.obra.id : null], resultado: (r, c, a) => c.obra ? ritmoLegible(r, c) : ritmoDeTodas(r, c, a),
    descripcion: 'A qué ritmo lee el usuario y cuánto le queda: con obra, de esa obra (capítulos que le faltan, minutos y horas). Sin obra, la suma de todas las que tiene empezadas (con sin_empezar, también las demás), con el desglose: una sola llamada para «¿cuánto tardaría en terminar todo?». Para «¿y a X horas al día?», divide las horas: no vuelvas a llamar.' },
  { nombre: 'capitulos_de', nivel: 'lectura', canal: 'get-chapter-titles', parametros: { obra }, parcialVale: true,
    args: conObra(id => [id]), descripcion: 'Los títulos de los capítulos de una obra, con su índice.' },
  { nombre: 'resumen_de_capitulo', nivel: 'lectura', hastaElPunto: true, canal: 'get-recap', parametros: { obra, capitulo },
    args: conObra((id, a) => [id, indice(a.capitulo), {}]), descripcion: 'Resumen de un capítulo descargado de una obra de la biblioteca.' },

  { nombre: 'recordar_lectura', nivel: 'lectura', canal: 'recordar-lectura',
    parametros: { obra, modo: { type: 'string', enum: ['progreso', 'breve'], description: 'progreso: dónde se quedó (sin leer capítulos); breve: recordatorio de lo ya leído' } },
    requeridos: ['obra'], args: conObra((id, a) => [id, a.modo === 'progreso' ? 'progreso' : 'breve']),
    descripcion: 'Recuerda al usuario por dónde iba en una obra, sin spoilers: sólo usa capítulos que ya terminó de leer (el abierto y los siguientes quedan fuera). Sólo usa capítulos de los que CONSTA que terminó (con el texto actual), uno a uno: no deduce lecturas de en qué capítulo está. Devuelve los capítulos usados, `sinEvidencia` y el coste (siempre 0 modelo, 0 web). No modifica el progreso. Si el texto viene vacío o `sinEvidencia` es true, di que no consta qué ha leído y que no puedes resumir sin riesgo de destripar; no lo rellenes con tu conocimiento de la obra ni adivines por el capítulo abierto.' },

  { nombre: 'capitulos_repetidos', nivel: 'lectura', canal: 'get-chapter-content',
    parametros: { obra, capitulos: { type: 'array', maxItems: 5000, items: capitulo, description: 'Sólo estos (opcional; por defecto, todos)' } },
    requeridos: ['obra'], args: conObra(id => [id, 0]), resultado: repetidosDe,
    descripcion: 'Lee el texto de los capítulos descargados de una obra y dice cuáles se repiten entre sí (y en qué parte) y cuáles repiten tramos dentro. Úsala cuando pregunten si hay capítulos repetidos o duplicados: un resumen no sirve para eso.' },

  { nombre: 'obras_repetidas', nivel: 'lectura', canal: 'get-library', parametros: {}, requeridos: [],
    args: async () => [], resultado: (lista) => require('./obras-repetidas.js').obrasRepetidas(lista),
    descripcion: 'Busca en la biblioteca entera las obras que están dos veces: la misma dirección, o el mismo título y el mismo autor (AO3 y FanFiction.net, el EPUB y la web). No toca nada. Úsala para «¿tengo alguna repetida?» o antes de importar algo que quizá ya tiene con otro nombre de sitio.' },

  { nombre: 'buscar_en_la_obra', nivel: 'lectura', hastaElPunto: true, canal: 'get-chapter-content',
    parametros: { obra, texto: { ...texto, description: 'Nombre, palabra o frase a buscar' },
      mas_alla_de_donde_voy: { type: 'boolean', description: 'Sólo si el usuario pide expresamente buscar más allá del capítulo por el que va' } },
    requeridos: ['obra', 'texto'], args: conObra(id => [id, 0]), resultado: apariciones,
    descripcion: 'Busca un nombre, palabra o frase en el texto descargado de una obra y dice en qué capítulos sale, cuántas veces y con un trozo de contexto. Por defecto sólo hasta el capítulo por el que va el usuario. Úsala para «¿en qué capítulo aparece…?», «¿cuándo pasa…?», «¿quién era…?»; no contestes eso de memoria.' },
  { nombre: 'glosario_de', nivel: 'lectura', canal: 'get-glossary', parametros: { obra },
    args: conObra(id => [id]), descripcion: 'El glosario de traducción de una obra. Para cambiarlo, regla_traduccion.' },

  { nombre: 'descubrimientos', nivel: 'lectura', canal: 'get-discoveries', args: async () => [],
    parametros: { filtro: { ...texto, description: 'Palabras del título, el autor o las etiquetas (opcional)' },
      completa: { type: 'boolean', description: 'true: sólo las terminadas' } }, requeridos: [],

    resultado: (lista, c, a = {}) => sugerenciasEnCorto(a.completa === true ? (lista || []).filter(o => o.completa === true) : lista, a.filtro),
    descripcion: 'Las obras que la app ha descubierto sola para el usuario, pendientes de guardar o descartar: título, autor, sitio, capítulos y popularidad. Con filtro, sólo las que lo nombran.' },

  { nombre: 'sugerencias_para', nivel: 'lectura', enLectura: true, deOtrasObras: (r, c) => sugerenciasCortas(sinLasDeLaMisma(r, c)),
    resultado: (r) => sugerenciasCortas(r), canal: 'get-suggestions', parametros: { obra },
    args: conObra(id => [id]), descripcion: 'Obras parecidas a una de la biblioteca.' },
  { nombre: 'busquedas_vigiladas', nivel: 'lectura', canal: 'get-subscriptions', args: async () => [],
    descripcion: 'Las búsquedas de AO3 que la app vigila y su listón de kudos.' },
  { nombre: 'autores_seguidos', nivel: 'lectura', canal: 'get-followed-authors', args: async () => [],
    descripcion: 'Los autores que sigue el usuario.' },
  { nombre: 'buscar_en_otros_sitios', nivel: 'lectura', canal: 'buscar-en-otros-sitios', parametros: { obra },
    args: conObra(id => [id]), descripcion: 'Busca la misma obra en otros sitios, p. ej. si en el suyo faltan capítulos.' },

  { nombre: 'sesiones', nivel: 'lectura', canal: 'listar-sesiones', args: async () => [],
    descripcion: 'En qué sitios (AO3, FanFiction.net, RoyalRoad, We Tried TLs) tiene la app la sesión iniciada: dentro true o false, null si aún no se ha mirado (entonces, comprobar_sesiones). Tú no puedes iniciar sesión: el usuario entra en Ajustes > Tus cuentas, en el PC; ahí también, en «Otro sitio», en CUALQUIER web (con «Iniciar sesión con Google» si el sitio lo ofrece), y desde entonces navegar_web entra con su sesión.' },
  { nombre: 'comprobar_sesiones', nivel: 'lectura', canal: 'comprobar-sesiones', args: async () => [],
    descripcion: 'Mira de verdad, cargando cada sitio, si la sesión sigue iniciada. Tarda unos segundos.' },
  { nombre: 'acceso_movil', nivel: 'lectura', canal: 'lan-estado', args: async () => [],
    descripcion: 'Si está encendido «Leer desde el móvil» y en qué dirección.' },

  { nombre: 'reanudar_descarga', enLectura: true, nivel: 'accion', diagnostica: true, canal: 'resume-download', parametros: { obra },
    args: conObra(id => [id]), descripcion: 'Reanuda la descarga de los capítulos que le faltan a una obra.' },

  { nombre: 'buscar_capitulos_nuevos', enLectura: true, nivel: 'accion', diagnostica: true,
    enLecturaDevuelve: (r) => ({ capitulosNuevos: Number(r?.nuevos) || 0, antes: r?.before, ahora: r?.after }), canal: 'refresh-chapters', parametros: { obra },
    args: conObra(id => [id]), descripcion: 'Relee el índice de una obra en su sitio y encola los capítulos nuevos.' },

  { nombre: 'pausar_la_cola', nivel: 'accion', canal: 'queue-pause',
    parametros: { pausar: { type: 'boolean', description: 'true pausa, false la vuelve a poner en marcha' } },
    args: async a => [a.pausar],
    resultado: r => ({ enMarcha: !!r?.enMarcha,
      seReanudaSola: r?.reanudaA ? new Date(r.reanudaA).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : undefined }),
    descripcion: 'Pausa o reanuda la cola de trabajos de fondo (descargar capítulos, comprobar autores, búsquedas vigiladas y capítulos nuevos, importar marcadores, traducir sinopsis). Pausar deja terminar lo que esté a medias y no empieza nada más; vuelve a andar sola a las 2 h y al reiniciar la app. Qué hay en la cola: descargas_en_curso.',
    inverso: a => ({ canal: 'queue-pause', args: [!a.pausar], queda: a.pausar ? 'la cola vuelve a andar' : 'la cola vuelve a estar en pausa' }) },
  { nombre: 'elegir_capitulos', nivel: 'accion', canal: 'elegir-capitulos',
    parametros: { obra, indices: { type: 'array', maxItems: 5000, items: capitulo } },
    args: conObra((id, a) => [id, a.indices.map(indice)]), descripcion: 'En una obra que pide elegir capítulos, fija cuáles descargar.' },
  { nombre: 'traducir_capitulo', enLectura: true, nivel: 'accion', canal: 'translate-chapter', parametros: { obra, capitulo },
    args: conObra(async (id, a, c) => [id, indice(a.capitulo), await c.idioma()]),
    descripcion: 'Traduce un capítulo al idioma de la app (el de Ajustes > Idioma). No traduce a otro idioma: para eso hay que cambiar el de la app.',

    resultado: traduccionDicha, enLecturaDevuelve: traduccionDicha },
  { nombre: 'traducir_sinopsis', nivel: 'accion', canal: 'translate-synopsis', parametros: { obra },
    args: conObra(async (id, a, c) => [id, await c.idioma()]), descripcion: 'Traduce la sinopsis de una obra.' },
  { nombre: 'marcar_progreso', enLectura: true, nivel: 'accion', canal: 'update-progress', parametros: { obra, capitulo },
    args: conObra((id, a, c) => [id, indice(capituloQueExiste(a.capitulo, c.obra))]), descripcion: 'Marca por qué capítulo va el usuario en una obra. Sólo cuando diga por cuál va: no abre la obra ni sirve para otra cosa.',

    inverso: (a, c) => ({ canal: 'update-progress', args: [c.obra.id, c.obra.currentChapter || 0],
      queda: (c.obra.currentChapter || 0) > 0 || c.obra.lastReadAt ? `vuelve al capítulo ${(c.obra.currentChapter || 0) + 1}` : 'vuelve a estar sin empezar' }) },
  { nombre: 'mi_lista', enLectura: true, nivel: 'accion', canal: 'set-in-my-list', parametros: { obra, dentro: { type: 'boolean' } },
    args: conObra((id, a) => [id, a.dentro]), descripcion: 'Mete o saca una obra de «Mi lista». Cambia la lista: para saber si está, biblioteca (enMiLista).',

    inverso: (a, c) => ({ canal: 'set-in-my-list', args: [c.obra.id, !!c.obra.enMiLista],
      queda: c.obra.enMiLista ? 'sigue en Mi lista: ya estaba antes' : 'fuera de Mi lista' }) },

  { nombre: 'marcar_estado', enLectura: true, nivel: 'accion', canal: 'set-reading-status',
    parametros: { obra, estado: { type: 'string', enum: ['en pausa', 'abandonada', 'leída fuera', 'ninguno'] } },
    args: conObra((id, a) => [id, a.estado === 'ninguno' ? null : a.estado]),
    descripcion: 'Marca cómo lleva el usuario una obra cuando no sale del progreso: «en pausa», «abandonada» o «leída fuera» (la leyó en otro sitio o hace años); «ninguno» lo quita. Para saberlo, biblioteca (marcada).',

    inverso: (a, c) => ({ canal: 'set-reading-status', args: [c.obra.id, c.obra.estadoLectura || null],
      queda: c.obra.estadoLectura ? `vuelve a estar ${c.obra.estadoLectura}` : 'sin marcar' }) },
  { nombre: 'portada', enLectura: true, nivel: 'accion', canal: 'set-cover-preference',
    parametros: { obra, valor: { type: 'string', enum: ['autor', 'generada'] } },
    args: conObra((id, a) => [id, a.valor]), descripcion: 'Qué portada enseña una obra: la del autor o la generada.',
    inverso: (a, c) => (c.obra.portadaPreferida ? { canal: 'set-cover-preference', args: [c.obra.id, c.obra.portadaPreferida] } : null) },
  { nombre: 'decidir_genero', nivel: 'accion', canal: 'decidir-genero',
    parametros: { obra, genero: texto, aceptar: { type: 'boolean' } },
    args: conObra((id, a) => [id, a.genero, a.aceptar]), descripcion: 'Acepta o rechaza un género propuesto para una obra.' },
  { nombre: 'guardar_descubrimiento', nivel: 'accion', canal: 'adopt-work', parametros: { obra }, ambito: 'descubiertas',
    args: conObra(id => [id, {}]), descripcion: 'Pasa un descubrimiento a la biblioteca y descarga sus capítulos.' },
  { nombre: 'descartar_descubrimiento', nivel: 'accion', canal: 'discard-work', parametros: { obra }, ambito: 'descubiertas',
    args: conObra(id => [id]), descripcion: 'Descarta un descubrimiento que no interesa.' },
  { nombre: 'preferencias_descubrimientos', nivel: 'lectura', canal: 'get-discovery-preferences', args: async () => [],
    descripcion: 'Fandoms y autores de TODOS los descubrimientos, incluidos los ocultos, con cantidades y preferencias de bloqueo. totalVisibles dice cuántos se recomiendan ahora, totalOcultas cuántos se ocultan. Consulta antes de descartar por fandom o bloquear un autor; no deduzcas el fandom del título.' },
  { nombre: 'descartar_fandom', nivel: 'confirmar', canal: 'decidir-descubrimientos', parametros: { fandom: texto },
    args: async a => [{ accion: 'descartarFandom', fandom: a.fandom }],
    resumen: a => `Descartar todos los descubrimientos de «${a.fandom}». Tu biblioteca no cambia.`,
    descripcion: 'Descarta de una vez TODOS los descubrimientos del fandom elegido por su nombre exacto en preferencias_descubrimientos. No toca biblioteca ni impide importar. El usuario confirma la tarjeta.' },
  { nombre: 'filtrar_descubrimientos', nivel: 'accion', canal: 'decidir-descubrimientos',
    parametros: { accion: { type: 'string', enum: ['bloquearAutor', 'desbloquearAutor', 'ocultarFandom', 'mostrarFandom', 'aprender', 'formato'] },
      autor: texto, fandom: texto, aprender: { type: 'boolean' },
      minPalabras: { type: 'integer', minimum: 0, maximum: 5000000 }, minCapitulos: { type: 'integer', minimum: 0, maximum: 100000 },
      romance: { type: 'string', enum: ['', 'hundir', 'ocultar'] } },
    requeridos: ['accion'], args: async a => [a],
    descripcion: 'Cambia preferencias sólo si lo pide: bloquearAutor/desbloquearAutor con el nombre del autor o su clave de preferencias_descubrimientos; ocultarFandom/mostrarFandom con su nombre; aprender con booleano; formato con minPalabras y/o minCapitulos para ocultar one-shots, drabbles y lo corto (0 lo quita), y con romance «hundir» (abajo, a la vista) u «ocultar» para las de romance como centro («» lo quita); lo que no se manda se conserva. Reversible con la acción contraria. No impide importar ni borra obras propias.' },
  { nombre: 'vigilar_busqueda', nivel: 'accion', canal: 'add-subscription',

    parametros: { consulta: texto, kudos_minimos: { type: 'integer', minimum: 0, maximum: 1000000 },
      palabras_minimas: { type: 'integer', minimum: 0, maximum: 5000000 }, solo_completas: { type: 'boolean' } }, requeridos: ['consulta'],
    args: async (a) => [a.consulta, umbralDe(a)],

    descripcion: 'Vigila una búsqueda en AO3, RoyalRoad y FanFiction.net y trae las obras nuevas que pasen del listón: kudos_minimos (500 por defecto), palabras_minimas (20000) y solo_completas.',
    inverso: async (a, c) => {
      const sub = (await c.llamar('get-subscriptions', [])).find(s => s.consulta === a.consulta.trim());
      return sub ? { canal: 'remove-subscription', args: [sub.id] } : null;
    } },
  { nombre: 'dejar_de_vigilar_busqueda', nivel: 'accion', canal: 'remove-subscription', parametros: { consulta: texto },

    args: async (a, c) => [(await suscripcion(a.consulta, c)).id], resultado: (r, c, a) => ({ quitada: a.consulta, aviso: 'Quitada del todo: una búsqueda vigilada no se puede pausar, sólo quitar (deshacer la vuelve a poner).' }),
    descripcion: 'Quita una búsqueda vigilada de AO3. No se puede pausar: si piden pausarla, díselo y pregunta si la quitas.',

    siPidePausar: 'No se ha quitado: el usuario ha pedido PAUSARLA, y una búsqueda vigilada no se puede pausar. Díselo y pregúntale si la quitas del todo (deshacer la vuelve a poner).',
    inverso: async (a, c) => {
      const sub = await suscripcion(a.consulta, c);
      return { canal: 'add-subscription', args: [sub.consulta, sub.umbral] };
    } },
  { nombre: 'seguir_autor', enLectura: true, nivel: 'accion', canal: 'follow-author', parametros: { obra },
    args: conObra(id => [id]), descripcion: 'Sigue al autor de una obra: la app avisará de sus obras nuevas.',
    inverso: (a, c) => (c.obra.autorUrl ? { canal: 'unfollow-author', args: [c.obra.autorUrl] } : null) },
  { nombre: 'dejar_de_seguir_autor', nivel: 'accion', canal: 'unfollow-author', parametros: { autor: texto },
    args: async (a, c) => [(await autorSeguido(a.autor, c)).url], descripcion: 'Deja de seguir a un autor, por su nombre.',

    inverso: async (a, c) => {
      const autor = await autorSeguido(a.autor, c);
      const { urlDeAutor } = require('./scrapers');
      const canonica = (u) => { try { return urlDeAutor(u) || u; } catch { return u; } };
      const suya = (await c.obras()).find(o => o.autorUrl && canonica(o.autorUrl) === autor.url);
      return suya ? { canal: 'follow-author', args: [String(suya.id)], queda: autor.nombre || autor.url } : null;
    } },
  { nombre: 'importar_marcadores', nivel: 'accion', canal: 'import-bookmarks',
    parametros: { url: { type: 'string', minLength: 1, maxLength: 500, description: 'Perfil de AO3 con marcadores públicos' } },
    args: async (a) => [a.url], descripcion: 'Trae a descubrimientos los marcadores públicos de un usuario de AO3.' },
  { nombre: 'exportar_epub', enLectura: true, nivel: 'accion', canal: 'exportar-epub', parametros: { obra, traducido: { type: 'boolean' } },
    requeridos: ['obra'], args: conObra((id, a) => [id, a.traducido === undefined ? {} : { traducido: a.traducido }]),
    alternativaMovil: 'En el móvil o cliente web, abre la ficha de la obra y toca «Exportar EPUB»: se descargará en este dispositivo.',

    resultado: (r) => guardadoEn(r), enLecturaDevuelve: (r) => guardadoEn(r),
    descripcion: 'Exporta una obra a EPUB. Se abre el diálogo de guardar: el usuario elige dónde, y la herramienta vuelve cuando ya está guardado.' },

  { nombre: 'mp3_de_la_obra', enLectura: true, nivel: 'accion', canal: 'audio-obra',
    parametros: { obra, idioma: { type: 'string', enum: ['es', 'en'] }, preparar: { type: 'boolean' } }, requeridos: ['obra'],
    args: conObra((id, a) => [id, { idioma: a.idioma || 'es', pedir: a.preparar !== false }]),
    enLecturaDevuelve: (r) => r,
    descripcion: 'Cuántos capítulos de una obra están ya en MP3 (voces neuronales) y, con preparar (por defecto), pone en la cola los que faltan, sin prioridad: una obra larga son horas. Si dice que faltan las voces, en Windows se instalan desde el botón del lector («Instalar las voces»). Para llevárselos todos de una vez, guardar_mp3_de_la_obra.' },
  { nombre: 'guardar_mp3_de_la_obra', nivel: 'accion', canal: 'guardar-audio-obra',
    parametros: { obra, idioma: { type: 'string', enum: ['es', 'en'] } }, requeridos: ['obra'],
    args: conObra((id, a) => [id, { idioma: a.idioma || 'es' }]),
    alternativaMovil: 'En el móvil, en el lector: ajustes del lector, «Toda la obra», «Bajar los N MP3 de una vez» (baja un ZIP a este dispositivo).',
    resultado: (r) => (r?.status === 'ok' ? { guardadoEn: r.ruta, capitulos: r.capitulos, deTotal: r.total } : r),
    descripcion: 'Guarda en el PC, de una vez, los MP3 de una obra que ya estén hechos: se abre el diálogo para elegir carpeta y la herramienta vuelve cuando están copiados. Los que falten siguen en la cola (mp3_de_la_obra dice cuántos).' },

  { nombre: 'abrir_obra', nivel: 'accion', soloEnElPc: true, canal: 'abrir-obra-en-pantalla', parametros: { obra, leer: { type: 'boolean' } },
    enElMovil: 'En el móvil, la obra se abre tocando su portada en la Biblioteca.',
    requeridos: ['obra'], args: conObra((id, a) => [id, { leer: a.leer !== false }]),
    descripcion: 'Abre una obra en la pantalla del PC: en el lector por donde iba (por defecto) o su ficha con leer=false. Úsala cuando pidan «ábreme…», «ponme…», «quiero leer…».' },

  { nombre: 'importar_enlace_libro', nivel: 'confirmar', canal: 'importar-enlace-libro', parametros: { url: { type: 'string', minLength: 1, maxLength: 4000 } },
    args: async a => [a.url], resultado: r => ({ titulo: r.data?.title, capitulos: r.data?.totalChapters, yaEstaba: !!r.yaEstaba, aviso: r.aviso }),
    resumen: a => `Descargar e importar el libro de ${dominio(a.url)}.`,
    descripcion: 'Descarga un EPUB, PDF o HTML de AO3 de un enlace directo dado por el usuario (una tienda sin DRM, Project Gutenberg, su propia nube). Lo añade a la biblioteca sin descargar a mano. Si es una página que exige sesión o un botón, ofrece abrir_importador_web en el PC.' },
  { nombre: 'importar_texto', nivel: 'accion', canal: 'importar-texto',
    parametros: { titulo: { type: 'string', minLength: 1, maxLength: 300 },
      texto: { type: 'string', minLength: 1, maxLength: 2097152 },
      autor: { type: 'string', maxLength: 300 }, fuente: { type: 'string', maxLength: 100 },
      url_origen: { type: 'string', maxLength: 4000 } }, requeridos: ['titulo', 'texto'],
    args: async a => [{ titulo: a.titulo, texto: a.texto, autor: a.autor, fuente: a.fuente, urlOrigen: a.url_origen }],
    resultado: r => ({ titulo: r.data?.title, capitulos: r.data?.totalChapters, yaEstaba: !!r.yaEstaba, aviso: r.aviso }),
    descripcion: 'Añade a la biblioteca un texto pegado por el usuario o el texto de una obra que acabas de leer con navegar_web; sirve también para un share público de ChatGPT. Pasa el texto completo, un título y, si constan, autor, fuente y url_origen. Separa capítulos por encabezados. No descargues nada para esta herramienta.' },
  { nombre: 'abrir_importador_web', nivel: 'confirmar', canal: 'abrir-importador-web', parametros: { url: { type: 'string', minLength: 1, maxLength: 4000 } }, requeridos: [],
    args: async a => [a.url], resumen: a => `Abrir el importador web en ${a.url ? dominio(a.url) : 'Project Gutenberg'}.`, descripcion: 'Abre en el PC un navegador en la web que diga el usuario (si no dice ninguna, Project Gutenberg). El usuario entra en su cuenta si hace falta y pulsa el EPUB, PDF o HTML de AO3; la app captura la descarga y lo importa. No eliges libros por tu cuenta. Abrir la ventana NO significa libro importado.' },

  { nombre: 'abrir_en_el_pc', nivel: 'confirmar', canal: 'abrir-en-navegador', parametros: { url: { type: 'string', minLength: 8, maxLength: 2000 } },
    args: async a => [a.url], resumen: a => `Abrir ${dominio(a.url)} en el navegador del PC.`,
    descripcion: 'Abre una página en el navegador del PC para que el usuario la vea él mismo, con sus cuentas. Sólo si él lo pide («ábremela», «quiero verla»). Desde el móvil no se puede: dale el enlace.' },
  { nombre: 'importar_libro', nivel: 'accion', canal: 'importar-libro', parametros: { ruta: { type: 'string', minLength: 1, maxLength: 500 } }, requeridos: [],
    args: async (a) => [a.ruta ? { rutaSugerida: a.ruta } : {}],
    siElUsuarioDice: ['import', 'fichero', 'archivo', 'disco', 'file', 'ordenador', 'mi pc', 'del pc', 'carpeta'],
    descripcion: 'Abre en el PC el diálogo para importar un EPUB, un PDF o un HTML de descarga de AO3 que el usuario YA TIENE en su disco; él elige el fichero. Si ha dicho la ruta del fichero, pásala en ruta: el diálogo se abre en él. No sirve para conseguir libros: nunca para «descárgame…» o «búscame…».' },
  { nombre: 'apagar_acceso_movil', nivel: 'accion', canal: 'lan-apagar', args: async () => [],
    descripcion: 'Apaga «Leer desde el móvil».' },

  { nombre: 'borrar_obra', nivel: 'confirmar', canal: 'delete-fanfic', parametros: { obra },
    args: conObra(id => [id]), resumen: (a, c) => `Borrar «${c.obra.title}» y todos sus capítulos descargados`,
    descripcion: 'Borra una obra de la biblioteca. No se hace hasta que el usuario lo confirme con el botón.' },

  { nombre: 'fundir_obras', nivel: 'confirmar', canal: 'merge-works',
    parametros: { obra: { ...obra, description: 'La que se QUEDA: su id (de obras_repetidas) o su título' },
      sobra: { ...obra, description: 'La que se funde en la otra y sale de la biblioteca: su id' } },
    requeridos: ['obra', 'sobra'],
    args: conObra(async (id, a, c) => {
      c.sobra = require('./asistente-app-ejecutar.js').resolverObra(a.sobra, await c.obras());
      if (String(c.sobra.id) === String(id)) throw Object.assign(new Error('Es la misma obra: dime cuál se queda y cuál sobra.'), { delUsuario: true });
      return [id, String(c.sobra.id)];
    }),
    resumen: (a, c) => `Fundir «${c.sobra.title}» (${c.sobra.source || 'sin sitio'}) en «${c.obra.title}» (${c.obra.source || 'sin sitio'}): ` +
      'pasan el glosario, el estado, Mi lista, estanterías, vigilancias y, si tienen los mismos capítulos, el progreso y las notas. La otra sale de la biblioteca y se guarda en «fundidas/», no se borra',
    resultado: r => ({ estado: r?.status, mensaje: r?.message, pasado: r?.pasado, sinMover: r?.sinMover }),
    descripcion: 'Funde dos obras repetidas (las que da obras_repetidas): la que se queda recibe lo que el autor puso en la otra y la otra sale de la biblioteca (apartada, no borrada). Cuál se queda lo decide el autor: si no lo ha dicho, pregúntale con sus señas (sitio, capítulos, por dónde va). Requiere confirmación.' },

  { nombre: 'reparar_obra', nivel: 'confirmar', canal: 'repair-work', parametros: { obra },
    args: conObra(id => [id]), resumen: (a, c) => `Revisar «${c.obra.title}» y volver a bajar del sitio sus capítulos vacíos o duplicados (lo apartado se guarda en «reparados/», no se borra)`,
    resultado: r => ({ estado: r?.status, mensaje: r?.message, rehechos: r?.aRehacer, vacios: r?.vacios, duplicados: r?.duplicados,
      sinTocarPorqueSoloSeParecen: r?.soloAviso?.parecidos, conTramosRepetidosSinTocar: r?.soloAviso?.conTramosRepetidos, faltan: r?.faltan }),
    descripcion: 'Repara una obra rota: aparta los capítulos vacíos (o que son sólo la cabecera de la web) y los que son idénticos a otro, y los vuelve a bajar del sitio. Los que sólo se parecen o repiten un tramo dentro se dicen y no se tocan: pueden ser de la obra. No sirve para libros importados de un fichero. Para mirar sin tocar, capitulos_repetidos. Requiere confirmación.' },
  { nombre: 'rehacer_traducciones', nivel: 'confirmar', canal: 'redo-translations', parametros: { obra },
    args: conObra(id => [id]), resumen: (a, c) => `Rehacer todas las traducciones de «${c.obra.title}» (gasta cuota de traducción)`,
    descripcion: 'Borra y rehace las traducciones de una obra con el glosario actual. Requiere confirmación.' },

  { nombre: 'rehacer_traducciones_de_varias', nivel: 'confirmar', canal: 'redo-translations-many',
    parametros: { obras: { type: 'array', maxItems: 500, items: obra }, todas: { type: 'boolean' } }, requeridos: [],
    args: async (a, c) => [await idsDeVarias(a, c)],
    resumen: a => (a.todas ? 'Rehacer las traducciones de TODAS las obras de la biblioteca (gasta cuota de traducción)'
      : `Rehacer las traducciones de ${(a.obras || []).length} obras: ${(a.obras || []).slice(0, 4).join(', ')}${(a.obras || []).length > 4 ? '…' : ''} (gasta cuota de traducción)`),
    descripcion: 'Borra y rehace las traducciones de varias obras (lista de títulos) o de todas (todas: true), con UNA sola tarjeta. Sólo se rehace de inmediato por donde va cada una; el resto, al leerlo.' },
  { nombre: 'encender_acceso_movil', nivel: 'confirmar', canal: 'lan-encender', args: async () => [],
    resumen: () => 'Encender «Leer desde el móvil»: la biblioteca queda accesible desde tu red',
    descripcion: 'Enciende «Leer desde el móvil». Requiere confirmación.' }
];

async function idsDeVarias(a, c) {
  const lista = (await c.llamar('get-library', [])).filter(o => o.origen !== 'descubierta' && o.origen !== 'descartada');
  if (a.todas) return lista.map(o => String(o.id));
  const normal = s => String(s || '').trim().toLowerCase();
  const faltan = [], ids = [];
  for (const t of a.obras || []) {
    const o = lista.find(x => String(x.id) === String(t) || normal(x.title) === normal(t));
    if (o) ids.push(String(o.id)); else faltan.push(t);
  }
  if (faltan.length) throw Object.assign(new Error(`No están en la biblioteca: ${faltan.join(', ')}. No se ha rehecho nada.`), { delUsuario: true });
  if (!ids.length) throw Object.assign(new Error('Dime qué obras, o todas.'), { delUsuario: true });
  return ids;
}

async function suscripcion(consulta, c) {
  const lista = await c.llamar('get-subscriptions', []);
  const buscada = String(consulta).trim().toLowerCase();
  const sub = lista.find(s => s.consulta.toLowerCase() === buscada) || lista.find(s => s.consulta.toLowerCase().includes(buscada));
  if (!sub) throw new Error(`No hay ninguna búsqueda vigilada como «${consulta}». Vigiladas: ${lista.map(s => s.consulta).join(', ') || 'ninguna'}.`);
  return sub;
}

async function autorSeguido(nombre, c) {
  const lista = await c.llamar('get-followed-authors', []);
  const buscado = String(nombre).trim().toLowerCase();
  const autor = lista.find(x => String(x.nombre || x.name || '').toLowerCase() === buscado || x.url === nombre);
  if (!autor) throw new Error(`No sigues a «${nombre}». Seguidos: ${lista.map(x => x.nombre || x.name || x.url).join(', ') || 'ninguno'}.`);
  return autor;
}

const enElLector = () => CATALOGO.filter(e => e.enLectura).map(e => e.nombre);
const conResultadoEnElLector = () => CATALOGO.filter(e => e.enLectura && e.deOtrasObras).map(e => e.nombre);
const soloLoLeidoEnElLector = () => CATALOGO.filter(e => e.hastaElPunto).map(e => e.nombre);
const loQueSeDeshace = () => [...CATALOGO.filter(e => e.inverso).map(e => e.nombre), ...require('./asistente-estanterias').DESHACIBLES, 'ajustar_lector'];

module.exports = { CATALOGO, enElLector, conResultadoEnElLector, soloLoLeidoEnElLector, loQueSeDeshace };
