const { randomUUID } = require('node:crypto');
const { CATALOGO } = require('./asistente-app');
const { SOLO_EN_EL_PC } = require('./lan/puente');
const { conErratas } = require('./titulo-con-erratas');
const { esDeLaBiblioteca } = require('./origen');
const { mismaObra } = require('./misma-obra');
const { recortar, sinRuido } = require('./asistente-recorte');
const { soloCuentaUnFallo, SOLO_CONTO_UN_FALLO } = require('./asistente-comprobado');

const soloEnElPc = (canal) => SOLO_EN_EL_PC.has(canal);

const CADUCIDAD = 60 * 60 * 1000;

const normal = (t) => String(t || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

function senasDe(o) {
  const senas = [o.author && `de ${o.author}`, o.source, o.downloadedChapters != null && `${o.downloadedChapters} capítulos descargados`,
    Number(o.currentChapter) > 0 && `va por el ${Number(o.currentChapter) + 1}`,

    (o.addedAt || /^\d{4}-\d{2}-\d{2}/.test(o.anadida || '')) && `añadida el ${new Date(o.addedAt || o.anadida).toISOString().slice(0, 10)}`].filter(Boolean);
  return `«${o.title}» (id ${o.id}${senas.length ? ', ' + senas.join(', ') : ''})`;
}

function resolverObra(pedida, obras, donde = 'en la biblioteca') {
  const porId = obras.find(o => String(o.id) === String(pedida).trim());
  if (porId) return porId;
  const buscada = normal(pedida);
  const exactas = obras.filter(o => normal(o.title) === buscada);
  if (exactas.length === 1) return exactas[0];
  let parecidas = exactas.length ? exactas : obras.filter(o => normal(o.title).includes(buscada));
  if (!parecidas.length) parecidas = obras.filter(o => conErratas(pedida, o.title));
  if (parecidas.length === 1) return parecidas[0];
  if (!parecidas.length) throw new Error(`No hay ninguna obra «${pedida}» ${donde}.`);

  const repetida = parecidas.every(o => o.url && mismaObra(o.url, parecidas[0].url));
  throw new Error(`«${pedida}» puede ser varias: ${parecidas.slice(0, 6).map(senasDe).join('; ')}. ` +
    (repetida ? 'Son la misma obra repetida en la biblioteca. ' : '') +
    'Si lo que ha dicho el usuario ya elige una, repite con su id; si no, pregúntale con esas señas, nunca por el id. ' +
    'Esta duda es sólo de esta herramienta, que recibe un título: en la app cada obra tiene sus propios botones, así que no explica ningún fallo que cuente el usuario. ' +
    'No la esquives haciendo lo mismo con otras obras o con todas.');
}

function exigirBien(resultado) {
  if (resultado && typeof resultado === 'object' &&
      (resultado.status === 'error' || resultado.ok === false || resultado.success === false)) {
    throw new Error(resultado.message || resultado.codigo || 'La aplicación devolvió un error.');
  }
  return resultado;
}

function obraDeLaEntrada(entrada, pedida, todas) {
  if (entrada.ambito === 'descubiertas') {
    return resolverObra(pedida, todas.filter(o => o.origen === 'descubierta'), 'entre los descubrimientos');
  }
  try { return resolverObra(pedida, todas.filter(esDeLaBiblioteca)); }
  catch (e) {
    if (!/^No hay ninguna obra/.test(e.message)) throw e;
    return resolverObra(pedida, todas.filter(o => o.origen !== 'descartada'));
  }
}

async function contexto(entrada, args, services) {
  const c = {
    llamar: services.llamar,
    obras: async () => (await services.obrasCompletas()).filter(esDeLaBiblioteca),
    idioma: async () => (await services.llamar('get-settings', []))?.lang || 'es'
  };
  if (entrada.parametros?.obra && (args.obra !== undefined || !entrada.obraOpcional)) c.obra = obraDeLaEntrada(entrada, args.obra, await services.obrasCompletas());
  return c;
}

async function pedirConfirmacion(entrada, args, c, state, hilo = null) {
  const pendiente = {
    id: randomUUID().slice(0, 8), herramienta: entrada.nombre, canal: entrada.canal, hilo,
    args: await entrada.args(args, c), resumen: entrada.resumen(args, c), at: Date.now()
  };

  const igual = ((await state.read()).pendientes || []).find(p => Date.now() - p.at < CADUCIDAD && (!hilo || !p.hilo || p.hilo === hilo)
    && p.canal === pendiente.canal && JSON.stringify(p.args) === JSON.stringify(pendiente.args));
  if (igual) {
    return { pendiente: true, id: igual.id, resumen: igual.resumen, yaEstaba: true,
      aviso: 'Esa tarjeta ya estaba en el chat, sin pulsar: no se ha puesto otra. NO está hecho: el usuario tiene que pulsar «Hacerlo» en ella.' };
  }
  await state.update(s => {
    s.pendientes = [...(s.pendientes || []).filter(p => Date.now() - p.at < CADUCIDAD), pendiente].slice(-20);
  });
  return { pendiente: true, id: pendiente.id, resumen: pendiente.resumen,
    aviso: 'NO está hecho. El usuario tiene que pulsar «Hacerlo» en la tarjeta del chat; díselo así.' };
}

async function ejecutar(entrada, args, { services, state, soloHecho = false, hilo = null }) {
  const c = await contexto(entrada, args, services);
  if (entrada.nivel === 'confirmar') return pedirConfirmacion(entrada, args, c, state, hilo);

  const inverso = entrada.inverso ? await entrada.inverso(args, c) : null;
  const crudo = await services.llamar(entrada.canal, await entrada.args(args, c));

  const resultado = entrada.parcialVale && crudo?.status === 'error' && Object.keys(crudo).some(k => !['status', 'message'].includes(k))
    ? { ...crudo, status: 'parcial', aviso: crudo.message } : exigirBien(crudo);
  if (inverso) {
    await state.update(s => {
      s.undo = [...s.undo, { id: randomUUID().slice(0, 8), type: 'llamada', herramienta: entrada.nombre, hilo, obraId: c.obra ? String(c.obra.id) : null,
        etiqueta: (c.obra ? `${entrada.nombre} · ${c.obra.title}` : entrada.nombre) + (inverso.queda ? ` (${inverso.queda})` : ''), ...inverso, at: Date.now() }].slice(-50);
    });
  }

  if (soloHecho) return entrada.deOtrasObras ? recortar(entrada.deOtrasObras(resultado, c))
    : entrada.enLecturaDevuelve ? await entrada.enLecturaDevuelve(resultado, c, args) : { hecho: true };
  return recortar(sinRuido(comoLaVeElUsuario(entrada.resultado ? await entrada.resultado(resultado, c, args) : resultado)));
}

function comoLaVeElUsuario(v) {
  if (Array.isArray(v)) return v.map(comoLaVeElUsuario);
  if (!v || typeof v !== 'object') return v;
  if ('currentChapter' in v && 'title' in v) return require('./asistente-obra').fichaDeObra(v);
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, comoLaVeElUsuario(x)]));
}

async function deshacer(id, { services, state, obraFija = null, hilo = null, sobre = null, ajuste = null }) {

  obraFija = obraFija || sobre;
  const s = await state.read();

  const deEsta = (u) => Boolean(id) || !hilo || u.hilo === hilo;

  const deLaObra = (u) => String(u.obraId ?? u.args?.[0]) === String(obraFija);
  const ajena = !id && hilo ? s.undo.filter(u => u.hilo !== hilo && (!obraFija || (u.type !== 'shelf' && deLaObra(u)))).at(-1) : null;

  const llamadas = s.undo.filter(u => deEsta(u) && (ajuste ? u.type === 'ajuste' && u.key === ajuste
    : (u.type === 'ajuste' && !sobre) || (u.type === 'llamada' && (!obraFija || deLaObra(u)))));

  const vivas = ((obraFija && !sobre) || ajuste) && !id ? [] : (s.pendientes || []).filter(p => Date.now() - p.at < CADUCIDAD && (id || !hilo || !p.hilo || p.hilo === hilo)
    && (id || !sobre || String(p.args?.[0]) === String(sobre)));
  const tarjeta = id ? vivas.find(p => p.id === id) : vivas.at(-1);
  const entrada = id ? llamadas.find(u => u.id === id) : llamadas[llamadas.length - 1];

  const estanteria = obraFija || ajuste ? null : s.undo.filter(u => u.type === 'shelf' && deEsta(u) && (!id || u.id === id)).at(-1);
  if (estanteria && (!entrada || estanteria.at >= entrada.at) && (!tarjeta || estanteria.at >= tarjeta.at)) {
    let deshecho = '';
    await state.update(n => { deshecho = require('./asistente-estanterias').deshacerEstanteria(n, estanteria); });
    return { deshecho };
  }
  if (tarjeta && (!entrada || tarjeta.at >= entrada.at)) {
    await rechazar(tarjeta.id, { state });
    return { anulado: tarjeta.resumen, anuladaId: tarjeta.id, aviso: 'Retirada: la tarjeta ya no se puede pulsar y no se ha hecho nada.' };
  }

  if (!entrada && ajena) {
    return { deshecho: null, aviso: `En esta conversación no has hecho nada que deshacer. Lo último, de otra conversación, fue «${ajena.etiqueta || 'un cambio en una estantería'}»: pregúntale si es eso y, si lo es, repite con id «${ajena.id}».` };
  }

  if (!entrada) throw new Error('No hay nada del asistente que deshacer' + (id ? ` con id «${id}»` : '') + '. ' + queSePuedeDeshacer(s, hilo));
  if (entrada.type === 'ajuste') await services.settings({ key: entrada.key, value: String(entrada.valor) });
  else exigirBien(await services.llamar(entrada.canal, entrada.args));
  await state.update(n => { n.undo = n.undo.filter(u => u.id !== entrada.id); });
  return { deshecho: entrada.etiqueta };
}

function queSePuedeDeshacer(s, hilo) {
  const aqui = (s.undo || []).filter(u => !hilo || u.hilo === hilo).slice(-6);
  const tarjetas = (s.pendientes || []).filter(p => Date.now() - p.at < CADUCIDAD && (!hilo || p.hilo === hilo));
  const cosas = [...aqui.map(u => `«${u.etiqueta || (u.type === 'ajuste' ? 'ajuste ' + u.key : 'un cambio en una estantería')}» (id «${u.id}»)`),
    ...tarjetas.map(p => `la tarjeta «${p.resumen}» (id «${p.id}»)`)];
  return cosas.length ? `En esta conversación se puede deshacer: ${cosas.join('; ')}.` : 'En esta conversación no queda nada que se pueda deshacer: dile que no, sin inventar por qué.';
}

const NADA_QUE_DESHACER = /^No hay nada del asistente que deshacer/;
async function deshacerVarias(cuantas, uno) {
  const n = Math.min(30, Math.max(1, Number(cuantas) || 1));
  if (n === 1) return uno();
  const hechos = [];
  const anuladaIds = [];
  let fallo = null;
  for (let i = 0; i < n; i++) {
    let r;

    try { r = await uno(); } catch (e) { if (!hechos.length) throw e; if (!NADA_QUE_DESHACER.test(e.message)) fallo = e.message; break; }
    if (!r.deshecho && !r.anulado) { if (!hechos.length) return r; break; }
    hechos.push(r.deshecho || r.anulado);
    if (r.anuladaId) anuladaIds.push(r.anuladaId);
  }
  const aviso = fallo ? `Deshechas ${hechos.length}; la siguiente falló: ${fallo}. Lo que falta sigue sin deshacer.`
    : hechos.length < n ? `Sólo había ${hechos.length} que deshacer.` : null;

  return { deshechas: hechos, cuantas: hechos.length, ...(aviso ? { aviso } : {}), ...(anuladaIds.length ? { anuladaIds } : {}) };
}

async function confirmar(id, { services, state, desdeElMovil = false }) {
  let p;

  await state.update(n => {
    p = (n.pendientes || []).find(x => x.id === id);
    if (!p) throw new Error('Esa confirmación ya no está.');
    if (desdeElMovil && soloEnElPc(p.canal)) throw new Error('Eso sólo se puede hacer desde el PC.');
    if (Date.now() - p.at >= CADUCIDAD) throw new Error('Esa confirmación caducó: pídeselo otra vez al asistente.');
    n.pendientes = n.pendientes.filter(x => x.id !== id);
  });
  try {
    const resultado = recortar(exigirBien(await services.llamar(p.canal, p.args)));
    await state.update(n => marcarTarjeta(n, p.hilo, id, 'hecho'));
    return { hecho: p.resumen, resultado };
  } catch (e) {
    await state.update(n => marcarTarjeta(n, p.hilo, id, 'falló'));
    throw e;
  }
}

async function rechazar(id, { state }) {
  await state.update(n => {
    const p = (n.pendientes || []).find(x => x.id === id);
    n.pendientes = (n.pendientes || []).filter(x => x.id !== id);
    if (p) marcarTarjeta(n, p.hilo, id, 'cancelado');
  });
  return { ok: true };
}

function marcarTarjeta(s, hilo, id, estado) {
  const mensaje = (s.threads || []).find(t => t.id === hilo)?.messages?.find(m => (m.pendientes || []).some(p => p.id === id));
  if (mensaje) mensaje.pendientes = mensaje.pendientes.map(p => (p.id === id ? { ...p, estado } : p));
  return s;
}

function enLaObraAbierta(args, obraFija, punto, hastaElPunto) {
  const a = { ...args, obra: obraFija };
  if (!hastaElPunto || !punto) return a;

  if (Number(a.capitulo) === punto.chapter + 1) {
    throw new Error(`El capítulo ${a.capitulo} es el que tiene abierto: esta herramienta es para los anteriores. Resúmelo tú con los pasajes que tienes, que son lo que ya ha leído de él; no es destripe.`);
  }
  if (a.capitulo != null && Number(a.capitulo) > punto.chapter) {
    throw new Error(`El capítulo ${a.capitulo} aún no lo ha terminado (va por el ${punto.chapter + 1}): contarlo sería destripe.`);
  }
  return { ...a, mas_alla_de_donde_voy: false, hastaCapitulo: punto.chapter };
}

function herramientasDeLaApp(add, { state, services, background, obraFija = null, punto = null, desdeElMovil = false, loQueDijo = '', hilo = null }) {
  if (!services.llamar || !services.obrasCompletas) return;
  const dicho = normal(loQueDijo);
  const cuentaUnFallo = soloCuentaUnFallo(loQueDijo);
  for (const entrada of CATALOGO) {

    if (entrada.siElUsuarioDice && !entrada.siElUsuarioDice.some(p => dicho.includes(p))) continue;
    if (background && entrada.nivel !== 'lectura') continue;

    if (obraFija && !entrada.enLectura && !entrada.hastaElPunto) continue;

    if (desdeElMovil && (soloEnElPc(entrada.canal) || entrada.soloEnElPc)) {
      const alternativa = entrada.alternativaMovil;
      add(entrada.nombre, alternativa || `DESDE EL MÓVIL NO SE PUEDE: llamarla no hace nada y sólo devuelve cómo se hace. (En el PC: ${entrada.descripcion})`,
        entrada.parametros || {}, async () => alternativa
          ? { hecho: false, aviso: alternativa }
          : { hecho: false, motivo: 'Esto sólo se hace en el PC.' + (entrada.enElMovil ? ' ' + entrada.enElMovil : '') }, []);
      continue;
    }

    const { obra, mas_alla_de_donde_voy: _masAlla, ...sinObra } = entrada.parametros || {};
    const parametros = obraFija ? sinObra : (entrada.parametros || {});
    const requeridos = (entrada.requeridos || Object.keys(entrada.parametros || {})).filter(k => !obraFija || !['obra', 'mas_alla_de_donde_voy'].includes(k));
    const hastaElPunto = Boolean(obraFija && entrada.hastaElPunto);
    const soloContoUnFallo = entrada.nivel === 'accion' && !entrada.diagnostica && cuentaUnFallo;
    const pidioPausar = entrada.siPidePausar && /\bpaus/.test(dicho);
    add(entrada.nombre, entrada.descripcion + (hastaElPunto ? ' Leyendo: sólo en los capítulos anteriores al abierto.' : ''), parametros,
      soloContoUnFallo ? async () => SOLO_CONTO_UN_FALLO
        : pidioPausar ? async () => ({ hecho: false, aviso: entrada.siPidePausar })
        : args => ejecutar(entrada, obraFija && obra ? enLaObraAbierta(args, obraFija, punto, hastaElPunto) : args, { services, state, soloHecho: !!obraFija && !hastaElPunto, hilo }),
      requeridos);
  }

  if (!background) {
    add('deshacer', `Deshace la última acción tuya que se pueda deshacer (${require('./asistente-app.js').loQueSeDeshace().join(', ')}), o la del id dado.`
      + ' Si lo último fue dejar una tarjeta de confirmación sin pulsar (borrar, encender el móvil…), la retira: úsalo cuando el usuario se arrepienta antes de pulsar «Hacerlo».'
      + (obraFija ? '' : ' Con obra (su título), lo último que hiciste sobre esa obra: para «deja X como estaba».')
      + ' Con ajuste (su clave de ajustar_lector, p. ej. fontSize), el último cambio de ese ajuste: para «deshaz sólo lo de la letra».'
      + ' Con cuantas, las últimas N de una vez: para «deshazlo todo» tras varias acciones, una sola llamada.'
      + (obraFija ? '' : ' Con estanteria (su nombre), lo último hecho sobre esa estantería y sólo eso.'),
      { id: { type: 'string', minLength: 1, maxLength: 20 }, cuantas: { type: 'integer', minimum: 1, maximum: 30 }, ajuste: { type: 'string', enum: require('./asistente-ajustes').CLAVES_DE_AJUSTE }, ...(obraFija ? {} : { obra: { type: 'string', minLength: 1, maxLength: 300 }, estanteria: { type: 'string', minLength: 1, maxLength: 100 } }) },
      async args => args.estanteria ? require('./asistente-estanterias').deshacerLoDeLaEstanteria(args.estanteria, { state, hilo }) : deshacerVarias(args.id ? 1 : args.cuantas, async () => deshacer(args.id, { services, state, obraFija, hilo, ajuste: args.ajuste || null,
        sobre: args.obra ? String(resolverObra(args.obra, (await services.obrasCompletas()).filter(esDeLaBiblioteca)).id) : null })), []);
  }
}

const PROMETE_TARJETA = /\btarjetas?\b|«\s*hacerlo\s*»|pulsa\s+[«"']?hacerlo/i;

const DA_POR_PUESTA = /(?<!\bno\s+(?:te\s+)?)\b(?:te\s+)?(?:he|hemos)\s+(?:dejado|puesto|preparado)\b|^\W*tarjeta\s+(?:lista|puesta|preparada)\b|\bte\s+dej[eé](?![\wáéíóúüñ])|\b(?:ya|ah[ií]|aqu[ií])\s+tienes\s+la\s+tarjeta\b|\bpulsa\s+[«"']?hacerlo|\btienes\s+que\s+pulsar\b|\btarjeta\b[^.?!\n]{0,60}\b(?:est[aá]|queda|qued[oó])\s+(?:lista|puesta|preparada|en el chat|ah[ií])(?![\wáéíóúüñ])/i;
const prometeConfirmacion = (texto, { huboTarjeta = false } = {}) => {
  const t = String(texto || '');
  if (!PROMETE_TARJETA.test(t)) return false;
  if (DA_POR_PUESTA.test(t)) return true;

  const frases = t.split(/(?<=[.!?\n])/).filter(f => PROMETE_TARJETA.test(f));

  return !huboTarjeta && frases.some(f => !/¿[^?]*\?|\?\s*$/.test(f) && !/\bsi\s/i.test(f) && !/\b(?:puedo|podr[ií]a|quieres\s+que|no\s+(?:te\s+)?(?:he|hay))\b/i.test(f));
};
const CORRECCION_TARJETA = '[Aviso del sistema, no del usuario] Tu respuesta dice que has dejado una tarjeta para confirmar, ' +
  'pero en este turno no has llamado a ninguna herramienta que la deje, así que NO existe. Si el usuario quiere esa acción, ' +
  'llama ahora a la herramienta; si no, rehaz la respuesta sin mencionar ninguna tarjeta.';

module.exports = { prometeConfirmacion, CORRECCION_TARJETA, herramientasDeLaApp, resolverObra, recortar, confirmar, rechazar, deshacer, CADUCIDAD, deshacerVariasParaPruebas: deshacerVarias };
