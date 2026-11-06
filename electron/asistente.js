const { randomUUID } = require('node:crypto');
const { crearEstado, texto, MODELOS, gustosUnaVez } = require('./asistente-estado');
const { crearProveedor } = require('./asistente-proveedor');
const { crearTools } = require('./asistente-tools');
const { leerHasta, validarPunto, antesOIgual } = require('./asistente-contexto');
const { estaCompleta, capitulosNuevos } = require('./asistente-obra');
const { aplanar } = require('./asistente-busqueda');
const { contrastarCaso } = require('./asistente-rescate');
const { instrucciones } = require('./asistente-instrucciones');
const { loQueSueleLeer } = require('./afinidad.js');
const { esDeLaBiblioteca } = require('./origen.js');
const { obrasDe, juntar, historialParaElModelo } = require('./asistente-vistas');
const { confirmar, rechazar, deshacer, CADUCIDAD } = require('./asistente-app-ejecutar');
const { conTope, topeDe, TOPE_HERRAMIENTA } = require('./asistente-tope');
const { completarCitas, seArrepiente } = require('./asistente-comprobado');
const { avisoAntesDeResponder, cambioAlgo, sinDisculpa } = require('./asistente-redes');
const { anotarAvance, resumenLimite } = require('./asistente-limite');
const MAX_RONDAS = 24;

async function conSuObra(memoria, services) {
  if (!memoria.some(p => p.workId)) return memoria;
  const obras = (await (services.obrasCompletas?.() || services.library?.())) || [];
  const porId = new Map(obras.map(o => [String(o.id), o.title]));

  return memoria.map(p => (p.workId ? { ...p, obra: porId.get(String(p.workId)) || 'una obra que ya no está' } : p));
}

function crearAsistente({ db, services, provider = crearProveedor(), topeHerramienta = TOPE_HERRAMIENTA }) {
  const state = crearEstado({ read: db.getAssistantState, update: db.updateAssistantState, getChapter: db.getChapterContent });
  const running = new Map();

  const claveEnCurso = (scope, desdeElMovil, hilo) => `${scope}|${desdeElMovil ? 'movil' : 'pc'}|${hilo}`;

  const respondeEnElOtro = (scope, desdeElMovil, hilo) => Boolean(hilo) && running.has(claveEnCurso(scope, !desdeElMovil, hilo));
  const porPeticion = new Map();
  async function contextFor(point) {
    if (!point) return null;
    validarPunto(point);
    const s = await state.read();
    const ctx = await leerHasta({ point, getChapter: db.getChapterContent, receipts: s.receipts[point.workId] });

    let obra;
    try { obra = await db.getFanficById?.(String(point.workId)); } catch {  }
    const total = obra?.totalChapters || (obra?.chapterList || []).length || 0;

    const guardado = (obra?.currentChapter || 0) > 0 || obra?.lastReadAt ? (obra?.currentChapter || 0) + 1 : null;
    return { ...ctx, ...(obra?.title ? { titulo: obra.title } : {}), ...(total ? { total } : {}), ...(guardado ? { guardado } : {}) };
  }

  async function correrHerramientas({ calls, toolset, controller, messages, actions, vistas, pendientes, retiradas, capturas = [], avance }) {

    for (const call of calls.slice(8)) {
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: 'No hecha: como mucho 8 herramientas a la vez. Dile al usuario cuáles quedaron sin hacer, o sigue en la ronda siguiente.' }) });
    }
    for (const call of calls.slice(0, 8)) {
      if (controller.signal.aborted) throw new Error('Petición cancelada.');
      let result;

      try { result = await conTope(toolset.run(call.function.name, JSON.parse(call.function.arguments)), call.function.name, controller.signal, topeDe(call.function.name, topeHerramienta)); }
      catch (e) {
        if (controller.signal.aborted) throw new Error('Petición cancelada.');

        result = e.delUsuario ? { error: e.message, aviso: `No se ha hecho: ${e.message} Díselo así al usuario.` } : {
          error: e.message,
          aviso: `La herramienta falló con: «${e.message}». Comunica este fallo al usuario con claridad tal como vino. Ya está anotado automáticamente en el buzón; NO uses anotar_idea.`
        };

        try {
          if (!e.delUsuario) services.buzon?.().anotar({ tipo: 'fallo', texto: `${call.function.name}: ${e.message}`, contexto: String(call.function.arguments).slice(0, 1500) });
        } catch {  }
      }

      actions.push({ name: call.function.name, ok: !result?.error, args: String(call.function.arguments || '{}').slice(0, 300) });
      anotarAvance(avance, call.function.name, result, call.function.arguments);
      vistas.push(...obrasDe(call.function.name, result));

      if (typeof result?.captura === 'string') capturas.push({ imagen: result.captura, url: result.url, titulo: result.titulo });
      if (result?.pendiente) pendientes.push({ id: result.id, resumen: result.resumen });
      if (result?.anuladaId) retiradas.push(result.anuladaId);
      if (Array.isArray(result?.anuladaIds)) retiradas.push(...result.anuladaIds);
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(require('./asistente-recorte').conCuenta(result ?? { ok: true })) });
    }
  }

  async function rondas({ messages, toolset, controller, modelo, background, context, point, thread, redes }) {
    const actions = [];
    const vistas = [];
    const capturas = [];
    const pendientes = [];
    const retiradas = [];
    const avance = { importadas: [], fichas: [], limiteWeb: null };
    const corregidas = new Set();
    const usoTurno = { prompt_tokens: 0, completion_tokens: 0 };
    const maxRondas = background ? 6 : MAX_RONDAS;
    const responder = async (texto, resumido = false) => {

      texto = require('./asistente-vetos-salida').sinNombrarRetiradas(texto, toolset.registroVetos);
      if (avance.limiteWeb && !resumido) texto = `${resumenLimite('investigación', { acciones: actions, vistas, pendientes, avance })}\n\n${texto}`;
      if (corregidas.has('guardadoReal') && require('./asistente-evidencia').guardadoSinEvidencia(texto, { actions })) {
        texto = 'No he podido guardar ese encargo o esas pistas; no han quedado registrados. Puedes volver a pedírmelo.';
      }
      const answer = {

        id: randomUUID(), role: 'assistant', text: corregidas.size ? sinDisculpa(texto) : texto, point, at: Date.now(),
        citations: context?.blocks.filter(b => texto.includes('[' + b.ref + ']')) || [],

        actions, vistas: juntar(vistas), ...(capturas.length ? { capturas: capturas.slice(-4) } : {}), pendientes: pendientes.filter(p => !retiradas.includes(p.id)), retiradas,
        ...(actions.some(a => /fanfics|ficha_web|pistas_web/.test(a.name))
          ? { costeEstimado: require('./asistente-coste').estimar(modelo, usoTurno) } : {})
      };
      await state.update(next => { next.threads.find(t => t.id === thread.id).messages.push(answer); });
      return { threadId: thread.id, answer };
    };

    for (let round = 0; round < maxRondas; round++) {
      if (controller.signal.aborted) throw new Error('Petición cancelada.');
      let day;
      try {
        day = await state.reserve(background);
        require('./asistente-recorte').cabeEnElTope(messages, toolset.specs, require('./asistente-proveedor').MAX_ENTRADA_BYTES);
      } catch (e) {
        const motivo = /límite diario/i.test(e.message) ? 'llamadas diarias' : /tope de entrada/i.test(e.message) ? 'entrada del modelo' : null;
        if (!motivo) throw e;
        return responder(resumenLimite(motivo, { acciones: actions, vistas, pendientes, avance }), true);
      }

      const result = await provider({ messages, tools: toolset.specs, model: modelo, signal: controller.signal })
        .catch(e => {
          if (/tope de entrada/i.test(e.message)) return { topeEntrada: true };
          e.hechas = actions; throw e;
        });
      if (result.topeEntrada) return responder(resumenLimite('entrada del modelo', { acciones: actions, vistas, pendientes, avance }), true);
      await state.usage(day, result.usage);
      usoTurno.prompt_tokens += Number(result.usage?.prompt_tokens) || 0;
      usoTurno.completion_tokens += Number(result.usage?.completion_tokens) || 0;
      if (controller.signal.aborted) throw new Error('Petición cancelada.');

      const message = result.message;
      const calls = message.tool_calls || [];

      const contenido = point ? completarCitas(String(message.content || ''), context) : String(message.content || '');

      const siguen = !calls.length && redes.tarjetasQueRetirar.length ? (await state.read()).pendientes || [] : [];

      const tarjetasQueRetirar = redes.tarjetasQueRetirar.filter(t => siguen.some(p => p.id === t.id) || retiradas.includes(t.id));
      const aviso = !calls.length && avisoAntesDeResponder(contenido, { ...redes, registroVetos: toolset.registroVetos, tarjetasQueRetirar, messages, corregidas, pendientes, actions, point, retiradas });
      if (aviso) {
        messages.push({ role: 'assistant', content: message.content }, { role: 'user', content: aviso });
        continue;
      }

      if (!calls.length) return responder(contenido);

      messages.push({ role: 'assistant', content: message.content || null, tool_calls: calls });
      await correrHerramientas({ calls, toolset, controller, messages, actions, vistas, pendientes, retiradas, capturas, avance });
    }

    return responder(resumenLimite(`${maxRondas} vueltas`, { acciones: actions, vistas, pendientes, avance }), true);
  }

  async function hiloDe({ s, threadId, scope, text }) {
    const existente = s.threads.find(t => t.id === threadId && t.scope === scope);
    if (existente) return existente;
    if (threadId) throw new Error('Esa conversación ya no existe o pertenece a otro espacio. Abre una nueva.');

    const nuevo = { id: randomUUID(), scope, title: text.slice(0, 80), messages: [], createdAt: Date.now() };
    await state.update(next => { next.threads.push(nuevo); });
    return nuevo;
  }

  async function chat({ text, point = null, threadId = null, background = false, fuera = false, desdeElMovil = false, onProgress, onThread, requestId = null }) {
    text = texto(text, 12000);
    if (point) validarPunto(point);
    const scope = point ? point.workId : 'library';

    let enCurso = claveEnCurso(scope, desdeElMovil, threadId || `nueva:${randomUUID()}`);
    if (running.has(enCurso)) throw new Error('Ya hay una respuesta en curso en esta conversación.');
    if (respondeEnElOtro(scope, desdeElMovil, threadId)) throw new Error('Esta conversación ya está respondiendo en el otro aparato.');
    const controller = new AbortController();
    let web;
    running.set(enCurso, controller);
    const peticion = requestId ? String(requestId).slice(0, 80) : null;
    if (peticion) porPeticion.set(peticion, controller);
    let thread;
    try {
      const s = await state.read();
      thread = await hiloDe({ s, threadId, scope, text });
      if (!threadId) { running.delete(enCurso); enCurso = claveEnCurso(scope, desdeElMovil, thread.id); running.set(enCurso, controller); }
      const context = await contextFor(point);

      const previos = thread.messages.filter(m => !m.error && (!point ? !m.point : m.point && antesOIgual(m.point, point)));
      const history = previos.slice(-14);
      const memory = await conSuObra(point ? [] : gustosUnaVez(s.preferences).filter(p => p.status === 'confirmed' && p.kind !== 'mood'), services);
      const annotations = point ? await state.visible(point) : null;
      if (!point && !background && services.crearInvestigador) {
        web = services.crearInvestigador({ signal: controller.signal, progreso: onProgress, origen: desdeElMovil ? 'movil' : 'local' });
      }
      const toolset = crearTools({ state, services: { ...services, web }, point, context, background, explicitText: text, desdeElMovil, hilo: thread.id });

      const suele = fuera && !point && services.obrasCompletas
        ? loQueSueleLeer((await services.obrasCompletas()).filter(esDeLaBiblioteca)) : null;
      const prompt = instrucciones({ point, memory, annotations, context, fuera: fuera && !point, desdeElMovil, modelo: s.settings?.model, suele, fueraDeVista: previos.length - history.length, desarrollador: s.settings?.desarrollador === true })
        + require('./idioma-del-mensaje.js').avisoDeIdioma(text);
      const messages = [{ role: 'system', content: prompt }, ...historialParaElModelo(history), { role: 'user', content: text }];

      const user = { id: randomUUID(), role: 'user', text, point, at: Date.now() };
      await state.update(next => { next.threads.find(t => t.id === thread.id).messages.push(user); });
      onThread?.(thread.id);

      const vivas = (s.pendientes || []).filter(p => p.hilo === thread.id && Date.now() - p.at < CADUCIDAD);

      const redes = {
        hayTarjetaViva: vivas.length > 0,
        tarjetasQueRetirar: seArrepiente(text) ? vivas.map(p => ({ id: p.id, resumen: p.resumen })) : [],
        huboTarjeta: thread.messages.some(m => m.pendientes?.length || m.retiradas?.length),
        huboAcciones: thread.messages.some(m => m.actions?.some(a => a.ok && cambioAlgo(a.name))),
        textoDelUsuario: text,

        guardado: context?.guardado || null
      };
      return await rondas({ messages, toolset, controller, modelo: s.settings.model, background, context, point, thread, redes });
    } catch (error) {
      const hechas = (error.hechas || []).filter(a => a.ok);
      const textoError = hechas.length ? `${error.message} Antes del corte sí se ${hechas.length === 1 ? 'hizo 1 acción' : `hicieron ${hechas.length} acciones`}: pregúntame qué hice y te lo cuento.` : error.message;
      if (thread) await state.update(s => { s.threads.find(t => t.id === thread.id)?.messages.push({ id: randomUUID(), role: 'assistant', text: textoError, point, error: true, at: Date.now(), ...(hechas.length ? { actions: hechas } : {}) }); });
      if (hechas.length) error.message = textoError;

      if (thread) error.threadId = thread.id;
      throw error;
    } finally { web?.cerrar(); running.delete(enCurso); if (peticion) porPeticion.delete(peticion); }
  }

  async function operacionesConProgreso(operaciones = []) {
    if (!operaciones.length) return [];
    const obras = await services.library();

    return operaciones.map(op => {
      const obra = obras.find(o => o.id === String(op.workId));
      if (!obra) return { ...op, estado: 'desaparecida' };
      const total = obra.totalChapters || 0;
      const hechos = obra.downloadedChapters || 0;
      return {
        ...op, title: obra.title, descargados: hechos, total,
        estado: total && hechos >= total ? 'lista' : 'descargando'
      };
    });
  }

  async function view(point = null, { solo = null } = {}) {
    const s = await state.read();

    if (!point && Array.isArray(solo) && solo.length) {
      const ligera = { settings: s.settings, undo: s.undo };
      if (solo.includes('shelves')) ligera.shelves = await require('./asistente-estanterias').estanteriasParaPintar(s.shelves, services);
      if (solo.includes('radar')) ligera.radar = await require('./asistente-radar').radarParaPintar(s, services);
      return ligera;
    }
    if (!point) return { ...s, receipts: undefined, modelos: MODELOS, threads: require('./asistente-historial').prepararHistorial(s.threads.filter(t => t.scope === 'library'), s.pendientes),
      notes: [], theories: [], operations: await operacionesConProgreso(s.operations),
      shelves: await require('./asistente-estanterias').estanteriasParaPintar(s.shelves, services),

      radar: await require('./asistente-radar').radarParaPintar(s, services),
      buzon: services.buzon ? services.buzon().pendientes() : [] };
    validarPunto(point);
    return { settings: s.settings, usage: s.usage, ...await state.visible(point),
      threads: require('./asistente-historial').prepararHistorial(s.threads.filter(t => t.scope === point.workId).map(t => ({ ...t,

        title: 'Conversación de lectura', messages: t.messages.filter(m => m.point && antesOIgual(m.point, point)) })), s.pendientes),
      inbox: s.inbox.filter(m => m.point && antesOIgual(m.point, point)) };
  }
  async function marcarLeido(id, point) {
    await state.update(s => {
      const hilo = s.threads.find(t => t.id === id && t.scope === (point?.workId || 'library'));
      if (hilo) delete hilo.unreadAt;
    });
    return { ok: true };
  }
  async function command({ action, args = {}, point = null, desdeElMovil = false }) {
    if (action === 'markRead') return marcarLeido(args.id, point);
    if (action === 'receipt') return state.receipt(args);

    if (action === 'cancel') {
      if (args.requestId) { porPeticion.get(String(args.requestId).slice(0, 80))?.abort(); return { ok: true }; }
      const prefijo = claveEnCurso(point?.workId || 'library', desdeElMovil, '');
      for (const [clave, c] of running) if (clave.startsWith(prefijo)) c.abort();
      return { ok: true };
    }
    if (action === 'deleteThread') return require('./asistente-historial').borrarConversacion({ state, running, id: args.id, point });
    if (action === 'note' && point) return state.note({ ...args, point });
    if (action === 'editNote' && point) return state.editNote(args.id, args.text);
    if (action === 'deleteNote' && point) return state.deleteNote(args.id);
    if (action === 'settings') return state.settings(args);
    if (point) throw new Error('Abre el asistente de biblioteca para realizar esta acción.');
    if (action === 'remember') return state.remember(args);
    if (action === 'editMemory') return state.editMemory(args.id, args.text, args.status);
    if (action === 'forget') return state.forget(args.id);

    if (require('./asistente-estanterias').ACCIONES_DE_ESTANTERIA.includes(action)) {
      return require('./asistente-estanterias').accionDeEstanteria(action, args, { state, services });
    }
    if (action === 'undoShelf') return state.update(s => {
      const undo = s.undo.find(u => u.id === args.id && u.type === 'shelf');
      if (!undo) throw new Error('Cambio no encontrado.');
      require('./asistente-estanterias').deshacerEstanteria(s, undo);
    });

    if (require('./asistente-reglas').ACCIONES_DE_REGLAS.includes(action)) {
      return require('./asistente-reglas').accionDeRegla(action, args, { state, services });
    }

    if (require('./asistente-radar').ACCIONES_DE_RADAR.includes(action)) {
      return require('./asistente-radar').accionDeRadar(action, args, { state, services });
    }

    if (require('./asistente-investigacion-editar').ACCIONES_DE_INVESTIGACION.includes(action)) {
      return require('./asistente-investigacion-editar').accionDeInvestigacion(action, args, { state });
    }

    if (action === 'dismiss') return state.update(s => {
      if (!s.inbox.some(m => m.id === args.id)) throw new Error('Ese aviso ya no está.');
      s.inbox = s.inbox.filter(m => m.id !== args.id);
    });
    if (action === 'sendChange') return services.sendChange(args.id, state);

    if (action === 'confirm') return confirmar(args.id, { services, state, desdeElMovil });
    if (action === 'reject') return rechazar(args.id, { state });
    if (action === 'undoCall') return deshacer(args.id, { services, state });
    throw new Error('Acción no disponible.');
  }

  function avisoDeHallazgos(job, cuantas) {
    if (job.kind !== 'lost') return `${cuantas} candidatas nuevas para «${job.query}»`;
    const encajan = (job.contrastadas || []).filter(c => c.veredicto === 'encaja').length;
    return encajan
      ? `${encajan} de ${job.findings.length} candidatas encajan con tus pistas sobre «${job.query}»`
      : `Ninguna de las ${job.findings.length} candidatas de «${job.query}» encaja todavía con tus pistas`;
  }

  async function enInternet(consulta) {
    if (!services.crearInvestigador) return { results: [], errors: [] };
    const controller = new AbortController();
    const tope = setTimeout(() => controller.abort(), 90000);
    const web = services.crearInvestigador({ signal: controller.signal });
    try {
      const r = await web.buscarEnInternet({ consulta });
      const results = (r?.resultados || []).filter(x => /^https?:/.test(x?.url || '')).slice(0, 8)
        .map(x => ({ title: String(x.titulo || x.url).slice(0, 200), url: x.url, synopsis: String(x.extracto || '').slice(0, 300), fuente: 'Internet' }));
      return { results, errors: results.length ? [] : (r?.errores || []).map(e => `Internet: ${e}`) };
    } catch (e) {
      return { results: [], errors: [`Internet: ${e.message}`] };
    } finally { clearTimeout(tope); web.cerrar?.(); }
  }

  let ticking = false;
  async function tick() {
    if (ticking) return;
    ticking = true;
    try {
      const s = await state.read();
      if (s.settings.paused || !s.settings.proactive) return;
      const job = s.investigations.find(j => j.status === 'active' && j.nextAt <= Date.now());
      if (job) {

        await state.update(next => { next.investigations.find(j => j.id === job.id).nextAt = Date.now() + job.intervalHours * 3600000; });
        try {

          const result = aplanar(await services.search(job.query));

          if (job.kind === 'lost') {
            const web = await enInternet(job.query);
            result.results.push(...web.results);
            result.errors.push(...web.errors);
          }
          await state.update(next => {
            const current = next.investigations.find(j => j.id === job.id);
            if (!current || current.status !== 'active') return;
            const added = result.results.filter(r => !current.findings.some(f => f.url === r.url) && !current.excluded.includes(r.url));
            current.findings.push(...added); current.lastAt = Date.now(); current.errors = result.errors;

            if (current.kind === 'lost') {
              current.contrastadas = contrastarCaso(current.findings, current.pistas || []);
            }

            if (added.length) next.inbox.push({ id: randomUUID(), text: avisoDeHallazgos(current, added.length), investigationId: job.id, at: Date.now() });
          });
        } catch (e) { await state.update(next => { next.investigations.find(j => j.id === job.id).errors = [e.message]; }); }
      }
      const works = await services.library();
      await state.update(next => {
        for (const radar of next.radar.filter(r => r.status === 'active')) {
          const work = works.find(w => w.id === radar.workId);
          if (!work) continue;

          const cumple = radar.condition === 'complete'
            ? estaCompleta(work)
            : capitulosNuevos(work, radar.baseline) >= radar.chapters;
          if (cumple) {
            radar.status = 'notified';
            next.inbox.push({ id: randomUUID(), text: `Puedes retomar «${work.title}»: se cumple la condición guardada. Motivo de pausa: ${radar.reason}`, at: Date.now() });
          }
        }
      });
    } finally { ticking = false; }
  }
  return { state, chat, view, command, tick, contextFor };
}
module.exports = { crearAsistente, conSuObra, MAX_RONDAS };
