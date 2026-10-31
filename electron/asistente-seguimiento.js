const str = { type: 'string', minLength: 1, maxLength: 300 };
const { MODELOS } = require('./asistente-estado');
const normal = (t) => String(t || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

const palabras = (t) => normal(t).replace(/[^\p{L}\p{N} ]/gu, ' ').split(' ').filter(w => w.length > 2);
const seParecen = (a, b) => {
  const x = normal(a), y = normal(b);
  if (!x || !y) return false;
  if (x.includes(y) || y.includes(x)) return true;
  const de = palabras(b), en = new Set(palabras(a));
  return de.length > 0 && de.filter(w => en.has(w)).length / de.length >= 0.6;
};

async function titulosDe(services) {
  const obras = (await (services.obrasCompletas?.() || services.library?.())) || [];
  const porId = new Map(obras.map(o => [String(o.id), o.title]));
  return (id) => porId.get(String(id)) || 'una obra que ya no está';
}

const GENERAL = /^(?:general|ninguna|sin obra|none|global)$/i;
const deLaObra = (m, obra, titulo) => !obra || (GENERAL.test(String(obra).trim()) ? !m.workId
  : (m.workId && String(titulo(m.workId)).toLowerCase().includes(String(obra).toLowerCase().trim())));
const conObra = (m, titulo) => m.text + (m.workId ? ` (de «${titulo(m.workId)}»)` : '');

function unoDe(candidatos, pedido, que, nombre) {
  if (candidatos.length === 1) return candidatos[0];
  if (!candidatos.length) throw new Error(`No hay ${que} que se parezca a «${pedido}».`);
  throw new Error(`«${pedido}» puede ser: ${candidatos.map(c => `«${nombre(c)}»`).join(', ')}. Pregúntale cuál.`);
}

function herramientasDeSeguimiento(add, { state, services }) {
  add('olvidar_gusto', 'Borra un gusto que tenías apuntado (por su texto o una parte), cuando el usuario diga que lo olvides o que no es verdad. Con obra, sólo el de esa obra; obra «general», sólo el que no es de ninguna.',
    { gusto: str, obra: { type: 'string', minLength: 1, maxLength: 300 } }, async ({ gusto, obra }) => {
      const s = await state.read();
      const titulo = await titulosDe(services);
      const candidatos = (s.preferences || []).filter(m => seParecen(m.text, gusto) && deLaObra(m, obra, titulo));

      const mismo = (m) => conObra(m, titulo).toLowerCase().trim() === conObra(candidatos[0], titulo).toLowerCase().trim();
      const p = candidatos.length > 1 && candidatos.every(mismo) ? candidatos[0] : unoDe(candidatos, gusto, 'ningún gusto apuntado', m => conObra(m, titulo));
      for (const m of candidatos.filter(mismo)) await state.forget(m.id);
      return { olvidado: p.text, ...(p.workId ? { deLaObra: titulo(p.workId) } : {}) };
    }, ['gusto']);

  add('dejar_de_vigilar', 'Para una investigación (por lo que busca) o una obra vigilada por si vuelve a publicar o se termina (por su título). pausar=true la deja en pausa en vez de cerrarla. Las búsquedas vigiladas de AO3 van con dejar_de_vigilar_busqueda.',
    { que: str, pausar: { type: 'boolean' } }, async ({ que, pausar }) => {
      const s = await state.read();
      const titulos = new Map((await services.library()).map(o => [String(o.id), o.title]));
      const vivas = (x) => x.status !== 'closed';
      const candidatos = [
        ...(s.radar || []).filter(vivas).filter(r => seParecen(titulos.get(String(r.workId)), que)).map(r => ({ tipo: 'radar', id: r.id, nombre: titulos.get(String(r.workId)) })),
        ...(s.investigations || []).filter(vivas).filter(j => seParecen(j.query, que)).map(j => ({ tipo: 'investigations', id: j.id, nombre: j.query }))
      ];

      const cerrada = !candidatos.length && (s.investigations || []).find(j => j.status === 'closed' && seParecen(j.query, que));
      if (cerrada) return { yaEstabaCerrada: cerrada.query, aviso: 'Esa investigación ya estaba cerrada: no busca nada y no hay nada que pausar ni cerrar.' };

      const iguales = new Set(candidatos.map(c => c.tipo + '|' + normal(c.nombre))).size === 1;
      const elegidos = iguales ? candidatos : [unoDe(candidatos, que, 'ninguna investigación ni obra vigilada', c => c.nombre)];
      const estado = pausar ? 'paused' : 'closed';
      await state.update(n => {
        for (const e of elegidos) { const x = (n[e.tipo] || []).find(v => v.id === e.id); if (x) x.status = estado; }
      });
      return { [pausar ? 'pausada' : 'cerrada']: elegidos[0].nombre, era: elegidos[0].tipo === 'radar' ? 'vigilancia de regreso' : 'investigación' };
    }, ['que']);
}

function herramientasDeIniciativa(add, { state, services = {} }) {
  const dia = (t) => (t ? new Date(t).toISOString().slice(0, 10) : undefined);
  add('avisos', 'Los avisos que has dejado al usuario (candidatas nuevas de una investigación, una obra vigilada que ya se puede retomar…): lo que has hecho por tu cuenta. Para «¿qué has hecho mientras no estaba?», junto con investigaciones.', {},
    async () => ((await state.read()).inbox || []).map(m => ({ aviso: m.text, cuando: dia(m.at) })));
  add('quitar_avisos', 'Quita avisos ya atendidos: el que se parezca a aviso, o todos con todos=true.',
    { aviso: str, todos: { type: 'boolean' } }, async ({ aviso, todos }) => {
      const s = await state.read();
      const quitar = todos ? (s.inbox || []) : [unoDe((s.inbox || []).filter(m => seParecen(m.text, aviso)), aviso, 'ningún aviso', m => m.text)];
      const ids = new Set(quitar.map(m => m.id));
      await state.update(n => { n.inbox = (n.inbox || []).filter(m => !ids.has(m.id)); });
      return { quitados: quitar.length };
    }, []);
  add('descartar_hallazgo', 'Descarta una obra que encontró una investigación (por su título; y la investigación, si hay más de una), para que no vuelva a proponerse.',
    { obra: str, investigacion: str }, async ({ obra, investigacion }) => {
      const s = await state.read();
      const trabajos = (s.investigations || []).filter(j => !investigacion || seParecen(j.query, investigacion));
      const pares = trabajos.flatMap(j => (j.findings || []).filter(f => !(j.excluded || []).includes(f.url) && seParecen(f.title, obra)).map(f => ({ j, f })));
      const { j, f } = unoDe(pares, obra, 'ningún hallazgo de tus investigaciones', p => `${p.f.title} (de «${p.j.query}»)`);
      await state.update(n => { const x = n.investigations.find(v => v.id === j.id); if (x && !x.excluded.includes(f.url)) x.excluded.push(f.url); });
      return { descartado: f.title, de: j.query };
    }, ['obra']);

  add('uso_del_asistente', 'Cuántas llamadas al modelo y cuántos tokens lleva el asistente hoy y en los últimos siete días, y el límite diario. El dinero no: depende de la tarifa de la clave de DeepSeek del usuario.', {},
    async () => {
      const s = await state.read();
      const hoy = new Date().toISOString().slice(0, 10);
      const dias = Object.entries(s.usage || {}).sort(([a], [b]) => b.localeCompare(a)).slice(0, 7);
      const suma = (k) => dias.reduce((n, [, u]) => n + (u[k] || 0), 0);
      const h = (s.usage || {})[hoy] || { calls: 0, input: 0, output: 0 };
      return { hoy: { llamadas: h.calls, tokensDeEntrada: h.input, tokensDeSalida: h.output },
        ultimosSieteDiasConUso: { llamadas: suma('calls'), tokensDeEntrada: suma('input'), tokensDeSalida: suma('output') },

        limiteDiario: s.settings?.dailyCalls, modelo: s.settings?.model,
        dondeSeCambia: 'El límite es un tope de la propia app, no de DeepSeek: lo sube el usuario en Ajustes > Asistente > Llamadas al día.' };
    });

  add('ajustar_asistente', `Cambia cómo funcionas tú: proactivo=false deja de buscar e investigar por tu cuenta en segundo plano (true lo vuelve a encender); modelo: ${MODELOS.join(' o ')} (el rápido es deepseek-flash). El límite diario de llamadas no: lo cambia el usuario en Ajustes > Asistente.`,
    { proactivo: { type: 'boolean' }, modelo: { type: 'string', enum: MODELOS } }, async ({ proactivo, modelo }) => {
      const cambio = { ...(typeof proactivo === 'boolean' ? { proactive: proactivo } : {}), ...(modelo ? { model: modelo } : {}) };
      if (!Object.keys(cambio).length) throw new Error('Di qué cambiar: proactivo o modelo.');
      await state.settings(cambio);
      const s = (await state.read()).settings;
      return { proactivo: s.proactive, modelo: s.model };
    }, []);
  add('gustos', 'Los gustos del usuario que tienes: los confirmados y los que propusiste tú y aún no ha confirmado.', {},
    async () => {

      const titulo = await titulosDe(services);
      return require('./asistente-estado').gustosUnaVez((await state.read()).preferences)
        .map(p => ({ gusto: p.text, tipo: p.kind, confirmado: p.status === 'confirmed', ...(p.workId ? { obra: titulo(p.workId) } : {}) }));
    });
  add('confirmar_gusto', 'Confirma (confirmar=true) o descarta (false) un gusto que propusiste tú, por su texto (y su obra, si hay dos iguales; «general» para el que no es de ninguna).',
    { gusto: str, confirmar: { type: 'boolean' }, obra: { type: 'string', minLength: 1, maxLength: 300 } }, async ({ gusto, confirmar, obra }) => {
      const titulo = await titulosDe(services);
      const p = unoDe((await state.read()).preferences.filter(m => m.status !== 'confirmed' && seParecen(m.text, gusto) && deLaObra(m, obra, titulo)), gusto, 'ninguna propuesta de gusto', m => conObra(m, titulo));
      if (confirmar) await state.editMemory(p.id, p.text, 'confirmed'); else await state.forget(p.id);
      return { [confirmar ? 'confirmado' : 'descartado']: p.text };
    }, ['gusto', 'confirmar']);
}

module.exports = { herramientasDeSeguimiento, herramientasDeIniciativa };
