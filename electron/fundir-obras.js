const normal = (t) => String(t || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
const vacio = (v) => v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
const cuando = (o) => Math.max(Number(o?.progresoEn) || 0, Number(o?.lastReadAt) || 0);
const leida = (o) => (Number(o?.currentChapter) || 0) > 0 || !vacio(o?.scrollPositions);

function mismosCapitulos(a, b) {
  const n = (o) => Number(o?.totalChapters) || (Array.isArray(o?.chapterList) ? o.chapterList.length : 0);
  return n(a) > 0 && n(a) === n(b);
}

function unirGlosario(queda = [], sobra = []) {
  const vistos = new Set((queda || []).map(e => normal(e?.termino)));
  const nuevos = (sobra || []).filter(e => e?.termino && !vistos.has(normal(e.termino)) && vistos.add(normal(e.termino)));
  return { glosario: [...(queda || []), ...nuevos], anadidos: nuevos.length };
}

function rellenarPorIdioma(queda, sobra) {
  if (vacio(sobra)) return { valor: queda, cambio: false };
  const out = { ...(queda || {}) };
  let cambio = false;
  for (const [idioma, v] of Object.entries(sobra)) {
    if (vacio(out[idioma]) && !vacio(v)) { out[idioma] = v; cambio = true; }
  }
  return { valor: out, cambio };
}

function rellenarRecaps(queda, sobra) {
  if (vacio(sobra)) return { valor: queda, cambio: false };
  const out = { ...(queda || {}) };
  let cambio = false;
  const vieja = (e) => !!e && typeof e.texto === 'string';
  for (const [indice, porIdioma] of Object.entries(sobra)) {
    if (vacio(porIdioma)) continue;
    if (vacio(out[indice])) { out[indice] = porIdioma; cambio = true; continue; }
    if (vieja(out[indice]) || vieja(porIdioma)) continue;
    const r = rellenarPorIdioma(out[indice], porIdioma);
    if (r.cambio) { out[indice] = r.valor; cambio = true; }
  }
  return { valor: out, cambio };
}

function planDeFundir(queda, sobra) {
  if (!queda || !sobra) throw new Error('Faltan las dos obras.');
  if (String(queda.id) === String(sobra.id)) throw new Error('Es la misma obra: no hay nada que fundir.');
  const cambios = {};
  const hecho = [];
  const sinMover = [];

  const g = unirGlosario(queda.glosario, sobra.glosario);
  if (g.anadidos) { cambios.glosario = g.glosario; hecho.push(`${g.anadidos} término(s) del glosario`); }
  const quitados = [...new Set([...(queda.glosarioQuitados || []), ...(sobra.glosarioQuitados || [])])];
  if (quitados.length > (queda.glosarioQuitados || []).length) cambios.glosarioQuitados = quitados;

  if (!queda.estadoLectura && sobra.estadoLectura) {
    cambios.estadoLectura = sobra.estadoLectura;
    cambios.estadoLecturaDesde = sobra.estadoLecturaDesde ?? null;
    hecho.push(`el estado de lectura («${sobra.estadoLectura}»)`);
  }
  if (!queda.enMiLista && sobra.enMiLista) { cambios.enMiLista = sobra.enMiLista; hecho.push('Mi lista'); }

  const bajo = (n) => String(n || '').toLowerCase();
  const descartadosQueda = new Set((queda.generosDescartados || []).map(bajo));
  const generosQueda = new Set((queda.tags || []).filter(t => t?.category === 'genre').map(t => bajo(t.name)));
  const puestos = (sobra.tags || []).filter(t => t?.category === 'genre' && t.origen === 'usuario' &&
    !generosQueda.has(bajo(t.name)) && !descartadosQueda.has(bajo(t.name)));
  if (puestos.length) { cambios.tags = [...(queda.tags || []), ...puestos]; hecho.push(`${puestos.length} género(s) que pusiste a mano`); }
  const usuarioQueda = new Set((queda.tags || []).filter(t => t?.category === 'genre' && t.origen === 'usuario').map(t => bajo(t.name)));
  const quitadosSobra = (sobra.generosDescartados || []).filter(g => !descartadosQueda.has(bajo(g)) && !usuarioQueda.has(bajo(g)));
  if (quitadosSobra.length) cambios.generosDescartados = [...(queda.generosDescartados || []), ...quitadosSobra];
  if (!queda.portadaPreferida && sobra.portadaPreferida) cambios.portadaPreferida = sobra.portadaPreferida;

  const mismos = mismosCapitulos(queda, sobra);

  if (leida(sobra) && (!leida(queda) || cuando(sobra) > cuando(queda))) {
    if (mismos) {
      for (const k of ['currentChapter', 'scrollPositions', 'progress', 'lastReadAt', 'progresoEn']) {
        if (sobra[k] !== undefined) cambios[k] = sobra[k];
      }
      hecho.push(`el progreso (capítulo ${(Number(sobra.currentChapter) || 0) + 1})`);
    } else {
      sinMover.push(`el progreso (capítulo ${(Number(sobra.currentChapter) || 0) + 1} de ${sobra.totalChapters ?? '?'}): ` +
        `las dos no tienen los mismos capítulos (${sobra.totalChapters ?? '?'} y ${queda.totalChapters ?? '?'}) y el número no vale de una a otra`);
    }
  }

  if (mismos) {
    for (const k of ['recaps', 'titulosTraducidos']) {
      const r = k === 'recaps' ? rellenarRecaps(queda[k], sobra[k]) : rellenarPorIdioma(queda[k], sobra[k]);
      if (r.cambio) { cambios[k] = r.valor; hecho.push(k === 'recaps' ? 'los resúmenes de capítulos' : 'los títulos traducidos'); }
    }
  } else if (!vacio(sobra.recaps) || !vacio(sobra.titulosTraducidos)) {
    sinMover.push('los resúmenes y títulos traducidos, que van por número de capítulo');
  }
  const sin = rellenarPorIdioma(queda.sinopsisTraducida, sobra.sinopsisTraducida);
  if (sin.cambio) { cambios.sinopsisTraducida = sin.valor; hecho.push('la sinopsis traducida'); }

  return { cambios, hecho, sinMover };
}

function reasignarEstado(s, sobraId, quedaId, { mismos = false } = {}) {
  const sobra = String(sobraId), queda = String(quedaId);
  const es = (v) => v != null && String(v) === sobra;
  const movido = [];

  let estanterias = 0;
  for (const e of s.shelves || []) {
    if (!(e.ids || []).some(es)) continue;
    e.ids = [...new Set(e.ids.map(id => (es(id) ? queda : String(id))))];
    estanterias++;
  }
  if (estanterias) movido.push(`${estanterias} estantería(s)`);

  const gustos = (s.preferences || []).filter(m => es(m.workId));
  for (const m of gustos) m.workId = queda;
  if (gustos.length) movido.push(`${gustos.length} cosa(s) que el asistente recuerda de ella`);

  const activaEnQueda = (c) => (s.radar || []).some(r => r.status === 'active' && String(r.workId) === queda && r.condition === c);
  let vigilancias = 0;
  s.radar = (s.radar || []).filter(r => {
    if (!es(r.workId)) return true;
    if (r.status === 'active' && activaEnQueda(r.condition)) return false;
    r.workId = queda; vigilancias++; return true;
  });
  if (vigilancias) movido.push(`${vigilancias} vigilancia(s)`);

  const reglas = (s.translationRules || []).filter(r => es(r.workId));
  for (const r of reglas) r.workId = queda;
  if (reglas.length) movido.push(`${reglas.length} regla(s) de traducción`);

  const operaciones = (s.operations || []).filter(o => es(o.workId));
  for (const o of operaciones) o.workId = queda;
  if (operaciones.length) movido.push(`${operaciones.length} importación(es) del asistente`);

  const porCapitulo = (s.notes || []).filter(n => es(n.point?.workId)).length + (s.theories || []).filter(n => es(n.point?.workId)).length +
    (s.threads || []).filter(t => es(t.scope)).length + (s.receipts?.[sobra] ? 1 : 0);
  if (porCapitulo && mismos) {
    for (const n of [...(s.notes || []), ...(s.theories || [])]) if (es(n.point?.workId)) n.point.workId = queda;
    for (const t of s.threads || []) {
      if (!es(t.scope)) continue;
      t.scope = queda;
      for (const m of t.messages || []) if (es(m.point?.workId)) m.point.workId = queda;
    }
    if (s.receipts?.[sobra]) {
      s.receipts[queda] = { ...s.receipts[sobra], ...(s.receipts[queda] || {}) };
      delete s.receipts[sobra];
    }
    movido.push('las notas, teorías y conversaciones de dentro de la obra');
  }
  return { movido, sinMover: porCapitulo && !mismos ? ['las notas, teorías y conversaciones de dentro de la obra, que van por capítulo'] : [] };
}

module.exports = { planDeFundir, reasignarEstado, mismosCapitulos, unirGlosario };
