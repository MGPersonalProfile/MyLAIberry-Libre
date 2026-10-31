const { randomUUID } = require('node:crypto');
const { COMO_ESCRIBIR_UNA_REGLA, leerRegla } = require('./asistente-traduccion');

const str = { type: 'string', minLength: 1, maxLength: 4000 };
const OBRA = { type: 'string', minLength: 1, maxLength: 300, description: '«global» para todas las obras, o el título o id de una' };

const mismoTermino = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();

function herramientasDeReglas(add, { state, services, resolverObra, obraFija = null }) {
  const obraDe = async (pedida) => {
    if (pedida === 'global') return 'global';
    if (!pedida && obraFija) return String(obraFija);
    if (!pedida) throw new Error('Falta la obra: su título, o «global» para todas.');
    return String(resolverObra(pedida, await services.library()).id);
  };
  const deLaObra = obraFija ? ' Sin workId, la obra que está leyendo.' : '';

  add('regla_traduccion', 'Guarda una preferencia de traducción general (workId "global") o por obra, y la aplica a las traducciones futuras.' +
    deLaObra + ' Una regla por término: para dos términos, dos llamadas. ' + COMO_ESCRIBIR_UNA_REGLA,
  { workId: OBRA, text: str }, async args => {

    const workId = await obraDe(args.workId);
    const rule = { ...args, workId, id: randomUUID(), at: Date.now() };

    const aplicada = await services.translationRule(rule);

    const termino = leerRegla(rule.text).termino;
    await state.update(s => {
      s.translationRules = s.translationRules.filter(r => !(termino && String(r.workId) === workId && mismoTermino(leerRegla(r.text).termino, termino)));
      s.translationRules.push({ ...rule, aplicable: aplicada.aplicable });
    });
    return aplicada;
  }, obraFija ? ['text'] : ['workId', 'text']);

  add('reglas_de_traduccion', 'Las reglas de traducción que hay: las generales y, si se da una obra, las suyas y su glosario.' + deLaObra,
    { workId: OBRA }, async args => {
      const workId = (args.workId || obraFija) ? await obraDe(args.workId) : null;
      const reglas = (await state.read()).translationRules || [];

      const legible = (r) => r.aplicable === false ? `${r.text} (guardada, pero el traductor no puede aplicarla)` : r.text;
      const generales = reglas.filter(r => r.workId === 'global').map(legible);

      if (workId === 'global') return { generales };
      if (!workId) {
        const obras = (await services.obrasCompletas?.()) || [];

        const repetido = (o) => obras.filter(x => x.title === o.title).length > 1;
        const nombre = new Map(obras.map(o => [String(o.id), o.title + (repetido(o) && o.addedAt ? ` (añadida el ${new Date(o.addedAt).toISOString().slice(0, 10)})` : '')]));
        const porObra = Object.create(null);
        for (const r of reglas.filter(r => r.workId !== 'global')) (porObra[nombre.get(String(r.workId)) || 'obra que ya no está'] ||= []).push(legible(r));

        return { generales, porObra: Object.entries(porObra).map(([obra, suyas]) => ({ obra, reglas: suyas })), aviso: 'El glosario de cada obra se ve dando la obra.' };
      }
      const deEstaObra = reglas.filter(r => String(r.workId) === workId);
      const yaDichos = new Set(deEstaObra.map(r => String(leerRegla(r.text).termino || '').toLowerCase()));
      const glosario = ((await services.glosario?.(workId)) || []).filter(g => !yaDichos.has(String(g.termino).toLowerCase()));
      return { generales, deEstaObra: deEstaObra.map(legible),
        glosario: glosario.map(g => g.accion === 'fijar' ? `${g.termino} → ${g.valor}` : `${g.termino} (sin traducir)`) };
    }, []);

  add('quitar_regla_traduccion', 'Quita la regla de traducción de un término (general con workId "global", o de una obra) y su entrada del glosario.' + deLaObra,
    { workId: OBRA, termino: str }, async args => {
      const workId = await obraDe(args.workId);
      let quitadas = 0;
      await state.update(s => {
        const antes = s.translationRules.length;

        const esa = (r) => { const t = leerRegla(r.text).termino; return t ? mismoTermino(t, args.termino) : String(r.text).toLowerCase().includes(String(args.termino).toLowerCase()); };
        s.translationRules = s.translationRules.filter(r => !(String(r.workId) === workId && esa(r)));
        quitadas = antes - s.translationRules.length;
      });
      const delGlosario = workId === 'global' ? 0 : await services.quitarDelGlosario(workId, args.termino);
      if (!quitadas && !delGlosario) throw new Error(`No hay ninguna regla sobre «${args.termino}» ${workId === 'global' ? 'general' : 'en esa obra'}.`);
      return { quitada: args.termino, nota: 'Vale para las traducciones nuevas. Lo ya traducido sigue como estaba hasta rehacer sus traducciones.' };
    }, obraFija ? ['termino'] : ['workId', 'termino']);
}

const NOMBRES_DE_REGLAS = Object.freeze(['regla_traduccion', 'reglas_de_traduccion', 'quitar_regla_traduccion']);

const ACCIONES_DE_REGLAS = ['addGlobalRule', 'removeRule'];

async function accionDeRegla(action, args, { state, services }) {
  if (action === 'addGlobalRule') {
    const termino = String(args.termino || '').trim().replace(/[«»"]/g, '');
    const valor = String(args.valor || '').trim().replace(/[«»"]/g, '');
    if (!termino || termino.length > 60 || valor.length > 60) throw new Error('Escribe el término (y su traducción, si la tiene) en menos de 60 caracteres.');

    if (termino.length < 3) throw new Error(`«${termino}» es demasiado corto para una regla de todas las obras: pon un nombre o término de 3 letras o más.`);
    const text = valor ? `traduce «${termino}» como «${valor}»` : `no traduzcas «${termino}»`;
    if (leerRegla(text).tipo === 'libre') throw new Error(`«${termino}» es una categoría, no un término: pon una regla por nombre.`);
    const rule = { workId: 'global', text, id: randomUUID(), at: Date.now() };
    const aplicada = await services.translationRule(rule);
    await state.update(s => {
      s.translationRules = s.translationRules.filter(r => !(String(r.workId) === 'global' && mismoTermino(leerRegla(r.text).termino, termino)));
      s.translationRules.push({ ...rule, aplicable: aplicada.aplicable });
    });
    return rule;
  }
  if (action === 'removeRule') {
    let quitada = null;
    await state.update(s => {
      quitada = s.translationRules.find(r => r.id === args.id);
      if (!quitada) throw new Error('Esa regla ya no está.');
      s.translationRules = s.translationRules.filter(r => r.id !== args.id);
    });

    const termino = leerRegla(quitada.text).termino;
    if (quitada.workId !== 'global' && termino) await services.quitarDelGlosario(quitada.workId, termino);
    return { ok: true };
  }
  throw new Error('Acción no disponible.');
}

module.exports = { herramientasDeReglas, NOMBRES_DE_REGLAS, ACCIONES_DE_REGLAS, accionDeRegla };
