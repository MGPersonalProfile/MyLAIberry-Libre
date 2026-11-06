const { randomUUID } = require('node:crypto');
const { parrafos, huella, validarPunto, antesOIgual } = require('./asistente-contexto');

const MODELOS = ['deepseek-flash', 'deepseek-v4-pro'];

const LLAMADAS_AL_DIA = 300;

function inicial() {
  return { version: 1, preferences: [], threads: [], receipts: {}, investigations: [], shelves: [], undo: [],
    radar: [], theories: [], notes: [], translationRules: [], translations: [], changes: [], inbox: [], usage: {},

    operations: [],

    pendientes: [],

    settings: { proactive: true, dailyCalls: LLAMADAS_AL_DIA, backgroundCalls: 6, model: 'deepseek-flash', paused: false, desarrollador: false } };
}
function normalizar(s) {
  if (s && s.version !== 1) throw new Error('Versión de datos del asistente no compatible.');
  if (!s) return inicial();
  const settings = { ...inicial().settings, ...s.settings };

  if (!settings.topeSubido) {
    if (settings.dailyCalls === 30) settings.dailyCalls = LLAMADAS_AL_DIA;
    settings.topeSubido = true;
  }
  return { ...inicial(), ...s, settings };
}
function texto(s, max = 4000) {
  if (typeof s !== 'string' || !s.trim() || s.length > max) throw new Error(`Escribe un texto de 1 a ${max} caracteres.`);
  return s.trim();
}
function crearEstado({ read, update, getChapter, now = () => Date.now() }) {
  const leer = async () => normalizar(await read());
  const cambiar = fn => update(s => { const next = normalizar(s); fn(next); return next; });
  return {
    read: leer, update: cambiar,
    async receipt(point) {
      validarPunto(point);
      const html = await getChapter(point.workId, point.chapter);
      if (!html) throw new Error('El capítulo todavía no está disponible.');
      const blocks = parrafos(html);
      if (point.paragraph >= blocks.length) throw new Error('Párrafo fuera del capítulo.');
      const hash = huella(blocks.join('\n'));
      await cambiar(s => {
        s.receipts[point.workId] ||= {};
        const old = s.receipts[point.workId][point.chapter];
        s.receipts[point.workId][point.chapter] = { hash, paragraph: old?.hash === hash ? Math.max(old.paragraph, point.paragraph) : point.paragraph, at: now() };
      });
      return { paragraphs: blocks.length, hash };
    },
    async remember({ text, kind = 'preference', workId = null, evidence = '', status = 'confirmed' }) {
      text = texto(text);
      if (!['preference', 'dislike', 'exception', 'mood', 'hypothesis'].includes(kind)) throw new Error('Tipo de memoria inválido.');
      if (!['confirmed', 'proposed'].includes(status)) throw new Error('Estado de memoria inválido.');
      const entry = { id: randomUUID(), text, kind, workId, evidence: texto(evidence || text), status, at: now() };

      const igual = (m) => m.kind === kind && (m.workId || null) === (workId || null) && m.text.toLowerCase().replace(/\s+/g, ' ').trim() === text.toLowerCase().replace(/\s+/g, ' ').trim();
      let yaEstaba = null;
      await cambiar(s => {
        yaEstaba = s.preferences.find(igual) || null;
        if (!yaEstaba) s.preferences.push(entry);
        else if (status === 'confirmed') yaEstaba.status = 'confirmed';
      });
      return yaEstaba ? { ...yaEstaba, status: status === 'confirmed' ? 'confirmed' : yaEstaba.status, yaEstaba: true } : entry;
    },
    async editMemory(id, text, status = 'confirmed') {
      text = texto(text);
      if (!['confirmed', 'proposed'].includes(status)) throw new Error('Estado inválido.');
      await cambiar(s => { const m = s.preferences.find(x => x.id === id); if (!m) throw new Error('Memoria no encontrada.'); m.text = text; m.status = status; m.updatedAt = now(); });
    },
    async forget(id) { await cambiar(s => { s.preferences = s.preferences.filter(m => m.id !== id); }); },
    async reserve(background = false) {
      const day = new Date(now()).toISOString().slice(0, 10);
      await cambiar(s => {
        if (s.settings.paused) throw new Error('El asistente está en pausa.');
        const u = s.usage[day] ||= { calls: 0, background: 0, input: 0, output: 0 };
        if (u.calls >= s.settings.dailyCalls || (background && u.background >= s.settings.backgroundCalls)) throw new Error(`Se ha alcanzado el límite diario del asistente (${s.settings.dailyCalls} llamadas). Se sube en Ajustes → Asistente → Llamadas al día.`);
        u.calls++; if (background) u.background++;
      }); return day;
    },
    async usage(day, usage = {}) {
      await cambiar(s => { const u = s.usage[day]; if (!u) return; u.input += Math.max(0, Number(usage.prompt_tokens) || 0); u.output += Math.max(0, Number(usage.completion_tokens) || 0); });
    },
    async settings(input) {
      const valid = {};
      for (const [key, value] of Object.entries(input || {})) {
        if (['proactive', 'paused', 'desarrollador'].includes(key) && typeof value === 'boolean') valid[key] = value;
        else if (['dailyCalls', 'backgroundCalls'].includes(key) && Number.isInteger(value) && value >= 0 && value <= 1000) valid[key] = value;
        else if (key === 'model' && MODELOS.includes(value)) valid[key] = value;
        else throw new Error('Ajuste del asistente inválido: ' + key);
      }
      await cambiar(s => { Object.assign(s.settings, valid); });
    },
    async note({ point, text, type = 'note' }) {
      validarPunto(point);
      if (!['note', 'theory', 'fact'].includes(type)) throw new Error('Tipo de anotación inválido.');
      const item = { id: randomUUID(), point, text: texto(text), type, at: now() };
      await cambiar(s => { (type === 'note' ? s.notes : s.theories).push(item); }); return item;
    },

    async editNote(id, text) {
      text = texto(text);
      await cambiar(s => { const n = [...s.notes, ...s.theories].find(x => x.id === id); if (!n) throw new Error('Anotación no encontrada.'); n.text = text; n.updatedAt = now(); });
    },
    async deleteNote(id) { await cambiar(s => { s.notes = s.notes.filter(n => n.id !== id); s.theories = s.theories.filter(n => n.id !== id); }); },
    async visible(point) {
      validarPunto(point); const s = await leer();
      return { notes: s.notes.filter(n => antesOIgual(n.point, point)), theories: s.theories.filter(n => antesOIgual(n.point, point)) };
    },
  };
}

function gustosUnaVez(preferences) {
  const unos = new Map();
  for (const p of preferences || []) {

    const k = `${p.kind}|${p.workId ?? ''}|${String(p.text).toLowerCase().trim()}`;
    const g = unos.get(k) || { ...p };
    if (p.status === 'confirmed') g.status = 'confirmed';
    unos.set(k, g);
  }
  return [...unos.values()];
}

module.exports = { crearEstado, inicial, normalizar, texto, MODELOS, gustosUnaVez };
