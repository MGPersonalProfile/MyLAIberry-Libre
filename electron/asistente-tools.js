const { randomUUID } = require('node:crypto');
const { texto } = require('./asistente-estado');
const { buscarPasajes } = require('./asistente-contexto');
const { escenaConContexto } = require('./asistente-escena');
const { CLAVES_DE_AJUSTE } = require('./asistente-ajustes');
const { COMO_DAR_UNA_PISTA, pistasDelCaso } = require('./asistente-rescate');
const { herramientasDeLaApp, resolverObra } = require('./asistente-app-ejecutar');
const { herramientasDeEstanterias } = require('./asistente-estanterias');
const { herramientasDeReglas } = require('./asistente-reglas');
const { herramientasDeSeguimiento, herramientasDeIniciativa } = require('./asistente-seguimiento');
const str = { type: 'string', minLength: 1, maxLength: 4000 };
const integer = { type: 'integer', minimum: 0, maximum: 10000 };

function textoDondeToca(args, schema) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return args;
  for (const [k, v] of Object.entries(args)) {
    if (schema.properties?.[k]?.type === 'string' && (typeof v === 'number' || typeof v === 'boolean')) args[k] = String(v);
  }
  return args;
}

async function conLoQueYaTiene(query, services, orden, filtros = {}) {
  const { nombraA } = require('./titulo-con-erratas');
  let suyas = query ? (await services.library()).filter(o => nombraA(query, o.title)) : [];
  suyas = require('./asistente-busqueda').filtrarObras(suyas, filtros);
  suyas = require('./asistente-busqueda').filtrarPareja(suyas, filtros.pareja);
  if (filtros.fuente) suyas = suyas.filter(o => o.source === filtros.fuente);
  suyas = suyas.slice(0, 5);
  const web = await services.search(query, orden, filtros);
  return suyas.length ? [{ fuente: 'Tu biblioteca (ya la tiene)', obras: suyas }, ...web] : web;
}

function validar(value, schema, nombre = '') {
  try { validarSin(value, schema); } catch (e) {
    throw new Error(nombre && !/«/.test(e.message) ? `${e.message.replace(/\.$/, '')} en «${nombre}»${value === '' ? ' (vacío)' : ''}.` : e.message);
  }
}
function validarSin(value, schema) {
  if (schema.enum && !schema.enum.includes(value)) throw new Error('Opción no válida.');
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Se esperaba un objeto.');
    for (const k of Object.keys(value)) if (!Object.hasOwn(schema.properties, k)) throw new Error('Argumento no permitido: ' + k);
    for (const k of schema.required) if (!Object.hasOwn(value, k)) throw new Error('Falta argumento: ' + k);
    for (const [k, v] of Object.entries(value)) validar(v, schema.properties[k], k);
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length > (schema.maxItems || 30)) throw new Error('Lista inválida.');
    for (const v of value) validar(v, schema.items);
  } else if (schema.type === 'integer') {
    if (!Number.isInteger(value) || value < schema.minimum || value > schema.maximum) throw new Error('Número fuera de rango.');
  } else if (schema.type === 'string') {
    if (typeof value !== 'string' || value.length < (schema.minLength || 0) || value.length > (schema.maxLength || 4000)) throw new Error('Texto inválido.');
  } else if (typeof value !== schema.type) throw new Error('Tipo de argumento inválido.');
}

function herramientasDeLectura(add, { state, services, point, context, desdeElMovil, hilo }) {
  add('buscar_escena', 'Localiza pasajes ya leídos por su descripción y devuelve, con cada uno, su localización, lo que el usuario anotó ahí y lo que ya se habló de esa escena. Prueba términos alternativos del texto si no hay coincidencias.',
    { query: str },
    async ({ query }) => {
      const s = await state.read();

      return buscarPasajes(context.blocks, query).map(b => escenaConContexto(b, s, point));
    });
  add('ver_escena', 'Devuelve un pasaje concreto por su referencia con sus anotaciones y su conversación. Con traducir=true lo traduce respetando las reglas guardadas y devuelve original y traducción juntos.',
    { ref: str, traducir: { type: 'boolean' } },
    async ({ ref, traducir }) => {
      const block = context.blocks.find(b => b.ref === ref);
      if (!block) throw new Error('Referencia fuera del contenido leído.');
      const escena = escenaConContexto(block, await state.read(), point);

      if (!traducir) return escena;
      const { traducido, aplicadas, noAplicables } = await services.translateFragment(block, '', state);
      return { ...escena, traduccion: traducido, reglasAplicadas: aplicadas, reglasNoAplicables: noAplicables };
    }, ['ref']);
  add('anotar', 'Guarda una nota, teoría o hecho que el usuario pida guardar, asociado al punto actual. Es sólo una nota: no cambia la traducción ni nada de la app (para traducir un término de otra forma, regla_traduccion).',
    { text: str, type: { type: 'string', enum: ['note', 'theory', 'fact'] } }, args => state.note({ ...args, point }));
  add('consultar_notas', 'Notas y teorías anteriores al punto actual.', {}, () => state.visible(point));
  add('traducir_fragmento', 'Traduce el fragmento visible indicado por su referencia; no consulta futuros.',

    { ref: str, instruction: { type: 'string', minLength: 0, maxLength: 4000 } }, async args => {
      const block = context.blocks.find(b => b.ref === args.ref);
      if (!block) throw new Error('Referencia fuera del contenido leído.');
      return services.translateFragment(block, args.instruction || '', state);
    }, ['ref']);
  herramientasComunes(add, { services, state, hilo, conAjustes: true });
  herramientasDeReglas(add, { state, services, resolverObra, obraFija: point.workId });

  herramientasDeLaApp(add, { state, services, obraFija: point.workId, punto: point, desdeElMovil, hilo });

  add('biblioteca', 'Las obras de la biblioteca y por dónde va el usuario en cada una, sin texto. Para preguntas sobre OTRAS obras.', {}, () => services.library());
}

const ESQUEMA_BUSQUEDA = {
  query: { type: 'string', maxLength: 300 },
  fandom: { type: 'string', minLength: 2, maxLength: 120 },
  orden: { type: 'string', enum: ['popularidad', 'recientes', 'publicadas', 'palabras', 'relevancia'] },
  completa: { type: 'boolean' },
  estado: { type: 'string', enum: ['completa', 'en_curso'] },
  minPalabras: { type: 'integer', minimum: 1, maximum: 5000000 },
  maxPalabras: { type: 'integer', minimum: 1, maximum: 5000000 },
  minCapitulos: { type: 'integer', minimum: 1, maximum: 10000 },
  generos: { type: 'array', maxItems: 4, items: { type: 'string', minLength: 2, maxLength: 40 } },
  sinGeneros: { type: 'array', maxItems: 4, items: { type: 'string', minLength: 2, maxLength: 40 } },
  rating: { type: 'string', enum: ['general', 'adolescente', 'maduro', 'explicito'] },
  idioma: { type: 'string', minLength: 2, maxLength: 2 },
  sinCrossovers: { type: 'boolean' },
  pareja: { type: 'string', minLength: 3, maxLength: 120 },
  personajes: { type: 'array', maxItems: 4, items: { type: 'string', minLength: 2, maxLength: 60 } },
  fuente: { type: 'string', enum: ['AO3', 'FanFiction.net', 'RoyalRoad', 'Wattpad', 'Project Gutenberg', 'WeTriedTLs', 'Webnovel'] },
  pagina: { type: 'integer', minimum: 1, maximum: 50 }
};
const CAMPOS_DE_BUSQUEDA = Object.keys(ESQUEMA_BUSQUEDA).filter(c => c !== 'query' && c !== 'orden');

function herramientasDeBiblioteca(add, { state, services, background, explicitText, desdeElMovil, hilo }) {
  add('biblioteca', 'Lista obras disponibles y su estado (título, autor, totalChapters, capituloActual —el que tiene abierto—, capitulosLeidos —los leídos enteros: para «¿cuántos he leído?», éste—, capitulosPorLeer, capitulosSinDescargar —los que aún no están en disco— y lectura), sin texto de capítulos. Con filtro (un fandom, etiqueta, autor, sitio, parte del título, o cómo va: «a medias», «sin empezar», «al día», «terminada»), sólo las que lo llevan y cuántas son: para «¿cuántas tengo de X?», usa el filtro y da ese número; no las cuentes tú. Dos cosas a la vez van juntas en el filtro: «naruto a medias».',
    { filtro: { type: 'string', minLength: 1, maxLength: 200 } }, async args => filtrarBiblioteca(await services.library(), args.filtro, args.filtro ? await services.obrasCompletas?.() : null), []);
  add('buscar_obras', 'Busca obras en AO3, FanFiction.net, RoyalRoad, Wattpad, Project Gutenberg (clásicos), WeTriedTLs y Webnovel (novelas web traducidas; en Webnovel buena parte es de pago) CON LOS FILTROS DE CADA SITIO: fandom (en FanFiction.net, su sección: Naruto → /anime/Naruto/), orden (popularidad por defecto, recientes = última actualización, publicadas, palabras, relevancia), minPalabras/maxPalabras (más de 40k → minPalabras 40000), minCapitulos, generos y sinGeneros (humor, romance, aventura, drama, angustia, parodia, misterio, terror, fantasia, ciencia_ficcion, sobrenatural, tragedia, familia, amistad, hurt_comfort, accion…), rating (general, adolescente, maduro, explicito), idioma (código de dos letras: en, es), estado (completa / en_curso; completa: true vale igual), pareja (nombres separados por /: Harry Potter/Hermione Granger; AO3 la busca en su campo de relaciones, FanFiction.net con los personajes de la sección, y sólo salen obras cuya pareja publicada coincide), personajes y sinCrossovers. query es opcional si hay fandom, fuente o algún filtro (lo más popular de humor en RoyalRoad: fuente RoyalRoad, generos humor, sin query). fuente: sólo ese sitio. pagina: la siguiente tanda. Devuelve por fuente hasta 8 obras con url, premisa (synopsis), capítulos, palabras, popularidad, si ya está en la biblioteca y sinComprobar (los filtros que esa obra no permitió ver), y por fuente `filtros`: enLaWeb (lo que aplicó el sitio), comprobadoPorLaApp y noVerificable. Al presentar, di qué aplicó el sitio y qué no se pudo verificar: nunca des por aplicado lo que no lo fue.',
    ESQUEMA_BUSQUEDA,
    args => {
      const filtros = Object.fromEntries(CAMPOS_DE_BUSQUEDA.filter(c => args[c] !== undefined && c !== 'pagina').map(c => [c, args[c]]));

      if (!String(args.query || '').trim() && !Object.keys(filtros).length) throw new Error('Hace falta query, fandom, fuente o algún filtro.');
      if (args.pagina !== undefined) filtros.pagina = args.pagina;
      return conLoQueYaTiene(args.query || '', services, args.orden, filtros);
    }, []);

  add('donde_esta_el_libro', 'Dónde leer gratis un libro que no es fanfic: Project Gutenberg y Standard Ebooks (dominio público) y Open Library (si se lee gratis o se toma prestado en Internet Archive, y en qué idiomas tiene ediciones). Para comprarlo, las tiendas con buscar_en_internet.',
    { consulta: { type: 'string', minLength: 1, maxLength: 200 } }, args => require('./scrapers/donde-esta-el-libro.js').dondeEstaElLibro(args), ['consulta']);
  if (!background) require('./asistente-tools-web').herramientasWeb(add, services.web);

  if (!background) require('./asistente-tools-propuestas').herramientasDePropuestas(add, services);
  if (services.novedades) require('./asistente-tools-novedades').herramientasDeNovedades(add, services);
  add('buscar_recomendaciones', 'Lee hilos de Reddit sobre la consulta: corta, de 2-3 palabras («self insert», «SI recs»), porque Reddit exige todas las palabras. Dentro de subreddit si se da (p. ej. NarutoFanfiction, HPfanfiction, ProgressionFantasy, rational): título, texto y comentarios más votados, con los enlaces a obras que traigan. Los títulos que salgan NO están comprobados: búscalos con buscar_obras antes de recomendarlos, salvo los que traigan su enlace, que preparar_obra importa.',
    { query: str, subreddit: { type: 'string', minLength: 1, maxLength: 50 } },
    args => services.recommendations(args.query, args.subreddit), ['query']);
  add('recordar_gusto', 'Registra un gusto explícito o propone una hipótesis apoyada en lo que el usuario ha dicho. text es el gusto concreto (un género, un tropo, un autor, algo que no soporta), nunca una frase genérica ni para decir que no hay gustos. No deduzcas gustos del abandono por sí solo. También lo que pida que recuerdes de él (su nombre, cómo quiere que le hables): kind preference, p. ej. «se llama Carlos».',
    { text: str, kind: { type: 'string', enum: ['preference', 'dislike', 'exception', 'mood', 'hypothesis'] } },
    args => state.remember({ ...args, evidence: explicitText || 'Propuesta del asistente', status: args.kind === 'hypothesis' || background ? 'proposed' : 'confirmed' }));

  if (services.leerAutor) {
    add('obras_del_autor', 'Las obras que ha publicado el autor de una obra (id o título), leídas de su perfil en el sitio, y cuáles tiene ya en la biblioteca. Sólo mira: seguirlo es seguir_autor, y sólo si lo pide.',
      { obra: str }, args => obrasDelAutor(args.obra, services));
  }
  herramientasDeEstanterias(add, { state, services, resolverObra, hilo });
  if (!background) { herramientasDeSeguimiento(add, { state, services }); herramientasDeIniciativa(add, { state, services }); }
  if (services.revisarTodas && !background) {
    add('buscar_capitulos_nuevos_en_todas', 'Pone TODAS las obras de la biblioteca en la cola para revisar su índice y bajar lo nuevo, en segundo plano. Para «busca capítulos nuevos de todas / de lo que sigo»: nunca obra a obra. Vuelve enseguida: el resultado no se sabe aún; lo nuevo se descarga solo y se ve en «Lo que hace por su cuenta».',
      {}, async () => ({ enCola: await services.revisarTodas(), aviso: 'Revisión lanzada, no terminada: no digas si hay capítulos nuevos o no.' }));
  }
  add('preparar_obra', 'Importa una obra por su dirección: una que devolvió buscar_obras o buscar_recomendaciones, o la que dé el usuario (casi cualquier web con capítulos).'
    + ' translate=true sólo si el usuario pide leerla traducida: por defecto no se traduce. La descarga sigue después en segundo plano: el usuario puede seguirla en «Lo que hace por su cuenta».',
    { url: str, translate: { type: 'boolean' } }, async args => {
      const obra = await services.prepare(args);

      await state.update(s => {
        s.operations = [{ id: randomUUID(), workId: String(obra.id), traducir: !!args.translate, at: Date.now() },
          ...s.operations].slice(0, 30);
      });
      return obra;
    }, ['url']);
  herramientasDeInvestigacion(add, { state, services });

  herramientasDeLaApp(add, { state, services, background, desdeElMovil, loQueDijo: explicitText, hilo });
  herramientasComunes(add, { services, state, hilo, conAjustes: !background });
  herramientasDeReglas(add, { state, services, resolverObra });
}

function loApuntado(buzon) {
  const dia = (t) => (t ? new Date(t).toISOString().slice(0, 10) : undefined);
  const todas = buzon.todas();
  return {
    pendientes: todas.filter(n => !n.resuelta).map(n => ({ tipo: n.tipo, texto: String(n.texto).slice(0, 300), apuntada: dia(n.creada) })),
    resueltas: todas.filter(n => n.resuelta).slice(-5).map(n => ({ texto: String(n.texto).slice(0, 200), como: n.como, resuelta: dia(n.resuelta) }))
  };
}

function herramientasComunes(add, { services, state, hilo, conAjustes }) {

  add('anotar_idea', 'Deja apuntada en el buzón de ideas para la app una petición o mejora para quienes programan la app, cuando el usuario lo pida expresamente o cuando falte una capacidad que ninguna herramienta cubre. NO lo uses cuando una herramienta falle o devuelva una limitación (p. ej. autor o sitio no soportado): los fallos de herramientas ya se apuntan solos en el buzón. No es para preguntas sobre obras. Ni para lo que el usuario quiere que recuerdes de él (su nombre, cómo le hablas): eso es recordar_gusto. Si PREGUNTA por algo que la app no tiene («¿cuál es mi racha?»), contéstale primero que no existe; apuntarlo es aparte, y sólo si quiere esa función.',
    { texto: str, contexto: { type: 'string', minLength: 0, maxLength: 2000 } },
    args => anotarSinRepetir(services.buzon(), args), ['texto']);

  add('ideas_apuntadas', 'Lo que hay en el buzón de ideas para la app: los encargos y fallos pendientes y los últimos resueltos, con cómo se resolvieron. Para «¿qué ideas tengo apuntadas?», «¿qué pasó con lo que apunté?».', {},
    () => loApuntado(services.buzon()));

  add('retirar_lo_apuntado', 'Retira una idea pendiente del buzón cuando el usuario ya no la quiere Y habla de lo apuntado («borra lo que apuntaste»). Un «quita esa» sin decir de qué no es esto: pregúntale qué quiere quitar. encargo: su texto o un trozo reconocible, o «último» para el último apuntado. Los fallos no se retiran.',
    { encargo: str }, args => retirarLoApuntado(services.buzon(), args));

  if (services.leerAjustes) {
    add('ver_ajustes', 'Los ajustes que tiene puestos ahora (letra, fuente, tema, idioma, traducción, avisos, voz…) y la versión instalada de la app. Para preguntas sobre ellos: nunca ajustar_lector para mirar.', {},
      () => services.leerAjustes());
  }

  if (conAjustes) {
    add('ajustar_lector', 'Cambia un ajuste existente: letra, fuente, tema, idioma de la interfaz, traducción automática, abrir traducido, avisos de capítulos, seguir en segundo plano y la velocidad de la lectura en voz alta (velocidadVoz, 0.6-2: «más despacio» es «-0.2»); no modifica código. Las voces no: las elige el usuario en Ajustes > Lectura. fontSize: si el usuario no dice un número, SIEMPRE relativo a la actual —«más grande» es «+2», «mucho más grande» «+4», «más pequeña» «-2»—; en píxeles (14-32) sólo si da la cifra. Devuelve el valor que quedó (y el de antes): díselo al usuario con ese número. Se deshace con deshacer (ajuste: su clave).',
      { key: { type: 'string', enum: CLAVES_DE_AJUSTE }, value: str }, args => require('./asistente-ajustes').ajustarConDeshacer(args, { services, state, hilo }));
  }
}

function herramientasDeInvestigacion(add, { state, services }) {
  add('investigar', 'Mantén una búsqueda o caso de historia perdida: repite buscar_obras con query en AO3, FanFiction.net, RoyalRoad, Project Gutenberg, WeTriedTLs y Webnovel cada 24 horas y avisa de obras nuevas; un caso de historia perdida busca además en internet entero (los hilos y foros que la describan), sin gastar llamadas del modelo. Se puede pausar desde Investigaciones. ' + COMO_DAR_UNA_PISTA,
    { query: str, clues: str, kind: { type: 'string', enum: ['search', 'lost'] },
      pistas: { type: 'array', maxItems: 20, items: { type: 'object', required: ['text', 'certeza'], properties: {
        text: str,
        certeza: { type: 'string', enum: ['segura', 'dudosa'] },
        campo: { type: 'string', enum: ['capitulos', 'completa', 'etiqueta', 'autor', 'texto'] },
        op: { type: 'string', enum: ['min', 'max', 'aprox'] },
        valor: { type: 'string', minLength: 0, maxLength: 200 }
      } } } },

    async args => require('./asistente-investigacion-editar').crearInvestigacion(args, { state }), ['query', 'kind']);

  add('investigaciones', 'Las investigaciones (búsquedas mantenidas e historias perdidas) y las obras vigiladas por si vuelven a publicar o se terminan, con su estado.', {}, async () => {
    const s = await state.read();
    const titulos = new Map((await services.library()).map(o => [String(o.id), o.title]));
    return {

      investigaciones: (s.investigations || []).map(j => ({ id: j.id, busqueda: j.query, tipo: j.kind === 'lost' ? 'historia perdida' : 'búsqueda', estado: j.status,
        pistas: pistasDelCaso(j),
        encontradas: (j.findings || []).filter(f => !(j.excluded || []).includes(f.url)).slice(0, 10)
          .map(f => ({ titulo: f.title, url: f.url, capitulos: f.totalChapters, completa: f.completa })) })),
      vigilandoRegreso: (s.radar || []).map(r => ({ id: r.id, obra: titulos.get(String(r.workId)) || r.workId, aviso: r.condition === 'complete' ? 'cuando se termine' : `con ${r.chapters || 1} capítulo(s) nuevo(s)`, estado: r.status }))
    };
  });

  add('vigilar_regreso', 'Vigila una obra (id o título): nuevos capítulos o marcada como completa por su fuente, sin inferir finales de arcos. chapters sólo con condition «chapters» (por defecto 1).',
    { workId: str, reason: str, condition: { type: 'string', enum: ['chapters', 'complete'] }, chapters: integer }, async args => {
      const work = resolverObra(args.workId, await services.library());

      const ya = ((await state.read()).radar || []).find(r => r.status === 'active' && String(r.workId) === String(work.id) && r.condition === args.condition);
      if (ya) return { ...ya, yaEstaba: true };
      const radar = { reason: '', chapters: 1, ...args, workId: work.id, baseline: work.totalChapters, id: randomUUID(), status: 'active', createdAt: Date.now() };
      await state.update(s => { s.radar.push(radar); }); return radar;
    }, ['workId', 'condition']);
}

function filtrarBiblioteca(obras, filtro, crudas = null) {
  if (!filtro) return { cuantas: obras.length, obras };
  const buscado = plano(filtro);

  const porId = new Map((crudas || []).map(o => [String(o.id), o]));
  const etiquetas = (o) => (porId.get(String(o.id))?.tags || o.tags || []).map(t => (t && typeof t === 'object' ? t.name : t));

  const campos = (o) => [o.title, o.author, o.source, o.lectura, ...etiquetas(o)].map(plano);

  const palabras = /\s/.test(String(filtro).trim()) ? buscado.split(' ').filter(p => p.length > 2) : [];

  const casa = (o) => campos(o).some(c => c.includes(buscado)) || (palabras.length > 1 && palabras.every(p => campos(o).some(c => c.split(' ').includes(p))));

  const esUnSitio = obras.some(o => plano(o.source) === buscado);
  const casan = obras.filter(o => (esUnSitio ? plano(o.source) === buscado : casa(o)));
  return { filtro, cuantas: casan.length, obras: casan };
}

async function obrasDelAutor(obra, services) {
  const { claveDeObra } = require('./asistente-busqueda');
  const ficha = resolverObra(obra, await services.library());
  const todas = await services.obrasCompletas();
  const cruda = todas.find(o => String(o.id) === String(ficha.id));
  if (!cruda?.autorUrl) throw new Error('Esta obra no guarda la dirección de su autor: con buscar_capitulos_nuevos se rellena, y luego se puede volver a mirar.');
  const perfil = await services.leerAutor(cruda.autorUrl);
  const tengo = new Set(todas.filter(require('./origen').esDeLaBiblioteca).map(o => claveDeObra(o.url)));
  return { autor: perfil.nombre || cruda.author, cuantas: (perfil.obras || []).length,
    obras: (perfil.obras || []).map(o => ({ titulo: o.title, url: o.url, capitulos: o.totalChapters, ...(o.completa != null ? { completa: o.completa } : {}), ...(tengo.has(claveDeObra(o.url)) ? { enBiblioteca: true } : {}) })) };
}

const plano = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const GENERICAS = new Set(['obras', 'capitulos', 'capitulo', 'lector', 'asistente', 'poder', 'quiero', 'puedo', 'pueda', 'desde', 'ahora', 'tambien', 'biblioteca']);
const palabrasLargas = (t) => new Set((plano(t).match(/\p{L}{5,}/gu) || []).filter(p => !GENERICAS.has(p)));

function seParecen(a, b) {
  if (plano(a) && plano(a) === plano(b)) return true;
  const x = palabrasLargas(a); const y = palabrasLargas(b);
  if (!x.size || !y.size) return false;
  const comunes = [...x].filter(p => y.has(p)).length;
  return comunes / Math.max(x.size, y.size) >= 0.6;
}
const encargosPendientes = (buzon) => (buzon.pendientes?.() || []).filter(n => !n.resuelta && n.tipo === 'encargo');

function anotarSinRepetir(buzon, args) {

  if (!plano(args.texto)) return { hecho: false, aviso: 'El encargo iba vacío: no se ha apuntado nada. Pregúntale qué quiere apuntar.' };
  const pendiente = encargosPendientes(buzon).find(n => seParecen(args.texto, n.texto));
  if (pendiente) return { yaEstaba: true, id: pendiente.id, texto: pendiente.texto, aviso: 'Ya estaba apuntado y sin resolver: no se ha repetido. Díselo así.' };
  return buzon.anotar({ tipo: 'encargo', texto: args.texto, contexto: args.contexto || '', origen: 'asistente' });
}

function retirarLoApuntado(buzon, args) {
  const pendientes = encargosPendientes(buzon);

  const buscado = plano(args.encargo);
  const casan = /^(?:el |lo )?ultimo$|^last$/.test(buscado) ? pendientes.slice(-1)
    : pendientes.filter(n => plano(n.texto).includes(buscado) || seParecen(buscado, n.texto));
  if (casan.length !== 1) {
    throw new Error((casan.length ? 'Ese encargo puede ser varios: ' : 'No hay ningún encargo pendiente así. Los pendientes: ')
      + ((casan.length ? casan : pendientes).map(n => `«${String(n.texto).slice(0, 120)}»`).join('; ') || 'ninguno') + '.');
  }
  const nota = buzon.resolver(casan[0].id, 'Retirado por el usuario desde el chat: ya no lo quiere.');
  return { retirado: casan[0].texto, hecho: !!nota };
}

function crearTools({ state, services, point, context, background = false, explicitText = '', desdeElMovil = false, hilo = null }) {
  const registry = new Map();
  const registroVetos = require('./asistente-vetos').crearRegistro();
  function add(name, description, properties, run, required = Object.keys(properties)) {
    registry.set(name, { spec: { type: 'function', function: { name, description,
      parameters: { type: 'object', properties, required, additionalProperties: false } } }, run });
  }

  if (point) herramientasDeLectura(add, { state, services, point, context, desdeElMovil, hilo });
  else herramientasDeBiblioteca(add, { state, services, background, explicitText, desdeElMovil, hilo });
  if (!point && !background) require('./asistente-investigacion-editar').herramientasEditarInvestigacion(add, { state });

  if (services.descargas) add('descargas_en_curso', 'Qué obras se están descargando ahora o esperan en la cola, cuántos capítulos tiene ya cada una de cuántos, y si alguna espera a reintentar tras un fallo.', {}, () => services.descargas());

  return {
    specs: [...registry.values()].map(t => t.spec),
    registroVetos,
    async run(name, args) {
      const tool = registry.get(name);
      if (!tool) throw new Error('Acción no disponible en este contexto.');
      validar(textoDondeToca(args, tool.spec.function.parameters), tool.spec.function.parameters);

      const vetos = require('./asistente-vetos');
      const resultado = await vetos.aplicarVetos(name, await tool.run(args), state, registroVetos);
      return vetos.DE_FUERA.test(name) ? require('./asistente-sinopsis').marcarSinSinopsis(resultado) : resultado;
    },
  };
}
module.exports = { crearTools, validar, ESQUEMA_BUSQUEDA };
