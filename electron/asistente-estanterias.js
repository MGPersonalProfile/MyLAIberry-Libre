const { randomUUID } = require('node:crypto');
const { texto } = require('./asistente-estado');
const { esDeLaBiblioteca } = require('./origen');

const str = { type: 'string', minLength: 1, maxLength: 4000 };
const lista = { type: 'array', items: str, maxItems: 100 };
const normal = (t) => String(t || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

function deshacerEstanteria(s, undo) {
  if (undo.borrada) {

    const otra = s.shelves.some(x => x.id !== undo.borrada.id && normal(x.name) === normal(undo.borrada.name));
    const vuelve = otra ? { ...undo.borrada, name: `${undo.borrada.name} (recuperada)` } : undo.borrada;
    if (!s.shelves.some(x => x.id === undo.borrada.id)) s.shelves.splice(Math.min(undo.pos ?? s.shelves.length, s.shelves.length), 0, vuelve);
    s.undo = s.undo.filter(x => x.id !== undo.id);
    return 'la estantería borrada';
  }
  if (undo.antes) {
    const e = s.shelves.find(x => x.id === undo.shelfId);
    if (e) e.ids = [...undo.antes];
  } else {
    s.shelves = s.shelves.filter(x => x.id !== undo.shelfId);
  }
  s.undo = s.undo.filter(x => x.id !== undo.id);
  return undo.antes ? 'el cambio en la estantería' : 'la estantería creada';
}

function estanteriaLlamada(shelves, nombre) {
  const buscado = normal(nombre);
  const exacta = shelves.filter(e => normal(e.name) === buscado);
  const candidatas = exacta.length ? exacta : shelves.filter(e => normal(e.name).includes(buscado));
  if (candidatas.length === 1) return candidatas[0];
  const nombres = shelves.map(e => `«${e.name}»`).join(', ') || 'ninguna';
  throw new Error(candidatas.length
    ? `«${nombre}» puede ser varias estanterías: ${candidatas.map(e => `«${e.name}»`).join(', ')}.`
    : `No hay ninguna estantería «${nombre}». Las que hay: ${nombres}.`);
}

function estanteriasLegibles(shelves, obras) {
  const porId = new Map(obras.map(o => [String(o.id), o.title + (esDeLaBiblioteca(o) ? '' : ' (descubrimiento, no está en su biblioteca)')]));
  return shelves.map(e => ({ nombre: e.name, obras: e.ids.map(id => porId.get(String(id)) || '(obra que ya no está)') }));
}

async function todasLasObras(services) {

  return (await services.obrasCompletas?.()) || await services.library();
}

function herramientasDeEstanterias(add, { state, services, resolverObra, hilo = null }) {
  add('crear_estanteria', 'Agrupa obras de biblioteca de forma reversible (deshacer la retira). ids: el id o el título de cada obra.',
    { name: str, ids: lista }, async args => {

      const yaAntes = (await state.read()).shelves.find(e => normal(e.name) === normal(args.name));
      if (yaAntes) return { hecho: false, yaExiste: yaAntes.name, aviso: `Ya hay una estantería «${yaAntes.name}»: no se ha creado otra. Para meter o sacar obras de ella, usa cambiar_estanteria.` };
      const available = await services.library();
      const ids = args.ids.map(o => String(resolverObra(o, available).id));
      const shelf = { id: randomUUID(), name: texto(args.name, 100), ids: [...new Set(ids)] };
      let ya = null;
      await state.update(s => {
        ya = s.shelves.find(e => normal(e.name) === normal(args.name));
        if (ya) return;
        s.shelves.push(shelf); s.undo.push({ id: randomUUID().slice(0, 8), type: 'shelf', shelfId: shelf.id, hilo, at: Date.now() });
      });
      if (ya) return { hecho: false, yaExiste: ya.name, aviso: `Ya hay una estantería «${ya.name}»: no se ha creado otra. Para meter o sacar obras de ella, usa cambiar_estanteria.` };
      return { ...shelf, obras: estanteriasLegibles([shelf], available)[0].obras };
    });
  add('estanterias', 'Las estanterías del usuario y las obras que hay en cada una.', {},
    async () => estanteriasLegibles((await state.read()).shelves, await todasLasObras(services)));
  add('cambiar_estanteria', 'Añade o quita obras de una estantería que ya existe (por su nombre), de forma reversible con deshacer. anadir y quitar: el id o el título de cada obra.',
    { estanteria: str, anadir: lista, quitar: lista }, async args => {
      const obras = await services.library();
      const e = estanteriaLlamada((await state.read()).shelves, args.estanteria);

      const todas = await todasLasObras(services);
      const dentro = e.ids.map(id => todas.find(o => String(o.id) === String(id)) || { id, title: '' });
      const fuera = new Set((args.quitar || []).map(o => String(resolverObra(o, dentro, 'en esa estantería').id)));
      const nuevas = (args.anadir || []).map(o => String(resolverObra(o, obras).id));
      const ids = [...new Set([...e.ids.filter(id => !fuera.has(String(id))), ...nuevas])];
      await state.update(s => {
        const viva = s.shelves.find(x => x.id === e.id);
        s.undo.push({ id: randomUUID().slice(0, 8), type: 'shelf', shelfId: e.id, antes: [...viva.ids], hilo, at: Date.now() });
        viva.ids = ids;
      });
      return estanteriasLegibles([{ ...e, ids }], todas)[0];
    }, ['estanteria']);

  add('borrar_estanteria', 'Quita una estantería entera (por su nombre); las obras siguen en la biblioteca. Reversible con deshacer.',
    { estanteria: str }, async args => {
      let e = null;
      await state.update(s => {
        e = estanteriaLlamada(s.shelves, args.estanteria);
        const pos = s.shelves.findIndex(x => x.id === e.id);
        s.shelves.splice(pos, 1);
        s.undo.push({ id: randomUUID().slice(0, 8), type: 'shelf', shelfId: e.id, borrada: e, pos, hilo, at: Date.now() });
      });
      return { borrada: e.name, obras: e.ids.length, aviso: 'Las obras siguen en la biblioteca; sólo se ha quitado la estantería.' };
    }, ['estanteria']);
}

async function deshacerLoDeLaEstanteria(nombre, { state, hilo }) {
  let deshecho = null;
  await state.update(s => {
    const suya = (u) => u.type === 'shelf' && (!hilo || u.hilo === hilo)
      && (normal(u.borrada?.name) === normal(nombre) || normal((s.shelves.find(e => e.id === u.shelfId) || {}).name) === normal(nombre));
    const u = s.undo.filter(suya).at(-1);
    if (u) deshecho = deshacerEstanteria(s, u);
  });
  if (!deshecho) throw Object.assign(new Error(`No hay nada hecho sobre la estantería «${nombre}» en esta conversación que deshacer.`), { delUsuario: true });
  return { deshecho: `${deshecho} («${nombre}»)` };
}

const DESHACIBLES = ['crear_estanteria', 'cambiar_estanteria', 'borrar_estanteria'];

const ACCIONES_DE_ESTANTERIA = ['createShelf', 'renameShelf', 'shelfWorks', 'deleteShelf'];

async function accionDeEstanteria(action, args, { state, services }) {

  const nombre = (action === 'createShelf' || action === 'renameShelf') ? texto(String(args.name || ''), 100) : '';
  const otraLlamada = (s, id) => s.shelves.find(e => e.id !== id && normal(e.name) === normal(nombre));
  const viva = (s) => {
    const e = s.shelves.find(x => x.id === args.id);
    if (!e) throw new Error('Esa estantería ya no existe.');
    return e;
  };

  const deLaBiblioteca = async (ids = []) => {
    if (!ids.length) return [];
    const hay = new Set((await services.library()).map(o => String(o.id)));
    return ids.map(String).filter(id => hay.has(id));
  };

  if (action === 'createShelf') {
    const ids = await deLaBiblioteca(args.ids);
    const shelf = { id: randomUUID(), name: nombre, ids: [...new Set(ids)] };
    await state.update(s => {
      const ya = otraLlamada(s, null);
      if (ya) throw new Error(`Ya hay una estantería «${ya.name}».`);
      s.shelves.push(shelf);
      s.undo.push({ id: randomUUID().slice(0, 8), type: 'shelf', shelfId: shelf.id, hilo: null, at: Date.now() });
    });
    return shelf;
  }
  if (action === 'renameShelf') {
    await state.update(s => {
      const e = viva(s);
      const ya = otraLlamada(s, e.id);
      if (ya) throw new Error(`Ya hay una estantería «${ya.name}».`);
      e.name = nombre;
    });
    return { ok: true };
  }
  if (action === 'shelfWorks') {
    const nuevas = await deLaBiblioteca(args.add);
    const fuera = new Set((args.remove || []).map(String));
    await state.update(s => {
      const e = viva(s);
      const ids = [...new Set([...e.ids.filter(id => !fuera.has(String(id))), ...nuevas])];
      if (ids.length === e.ids.length && ids.every((id, i) => String(id) === String(e.ids[i]))) return;
      s.undo.push({ id: randomUUID().slice(0, 8), type: 'shelf', shelfId: e.id, antes: [...e.ids], hilo: null, at: Date.now() });
      e.ids = ids;
    });
    return { ok: true };
  }
  if (action === 'deleteShelf') {
    await state.update(s => {
      const e = viva(s);
      const pos = s.shelves.findIndex(x => x.id === e.id);
      s.shelves.splice(pos, 1);
      s.undo.push({ id: randomUUID().slice(0, 8), type: 'shelf', shelfId: e.id, borrada: e, pos, hilo: null, at: Date.now() });
    });
    return { ok: true };
  }
  throw new Error('Acción no disponible.');
}

async function estanteriasParaPintar(shelves, services) {
  if (!shelves.length) return shelves;
  const porId = new Map((await todasLasObras(services)).map(o => [String(o.id), o]));
  return shelves.map(e => ({ ...e, obras: e.ids.map(id => {
    const o = porId.get(String(id));
    return { id, title: o?.title || null, enLaBiblioteca: !!o && esDeLaBiblioteca(o) };
  }) }));
}

module.exports = { herramientasDeEstanterias, deshacerEstanteria, deshacerLoDeLaEstanteria, estanteriaLlamada, DESHACIBLES,
  ACCIONES_DE_ESTANTERIA, accionDeEstanteria, estanteriasParaPintar };
