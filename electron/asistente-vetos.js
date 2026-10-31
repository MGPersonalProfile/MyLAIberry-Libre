const CATEGORIAS = [
  { categoria: 'M/M', patron: /\bm\s*\/\s*m\b|(?<![a-z])slash\b|\byaoi\b/i },
  { categoria: 'F/F', patron: /\bf\s*\/\s*f\b|\bfemslash\b|\byuri\b/i }
];

const DE_FUERA = /^(buscar_obras|buscar_fanfics_a_fondo|investigar_fanfics_web|seguir_pistas_web|abrir_ficha_web)$/;

function categoriasVetadas(preferences = []) {
  const confirmadas = (preferences || []).filter(p => p?.status === 'confirmed');
  const dicen = (kind, patron) => confirmadas.some(p => p.kind === kind && patron.test(String(p.text || '')));
  return CATEGORIAS.filter(c => dicen('dislike', c.patron) && !dicen('exception', c.patron)).map(c => c.categoria);
}

function choca(obra, vetadas) {
  if (!obra || typeof obra !== 'object' || !obra.url || !Array.isArray(obra.tags)) return null;

  if (obra.enBiblioteca) return null;
  const nombres = obra.tags.map(t => String(t?.name ?? t).trim().toUpperCase());
  return vetadas.find(c => nombres.includes(c)) || null;
}

function sinVetadas(resultado, vetadas) {
  if (!vetadas.length || !resultado || typeof resultado !== 'object') return resultado;
  const propia = choca(resultado, vetadas);
  if (propia) {
    return { ...resultado, vetada: `Es ${propia}, y el usuario no lee ${propia} (sus disgustos): no se la recomiendes ni la importes salvo que la pida él sabiéndolo.` };
  }
  const aviso = (n) => `${n === 1 ? 'Se quitó 1 obra' : `Se quitaron ${n} obras`} ${vetadas.join(' o ')} por los disgustos del usuario; no las busques por otro camino.`;
  const filtrar = (lista) => {
    let quitadas = 0;
    const quedan = lista.filter(x => { const c = choca(x, vetadas); if (c) quitadas++; return !c; }).map(limpiar);
    return { quedan, quitadas };
  };
  function limpiar(v) {
    if (Array.isArray(v)) return filtrar(v).quedan;
    if (!v || typeof v !== 'object') return v;

    if (/^Tu biblioteca/.test(String(v.fuente || ''))) return v;
    let quitadas = 0;
    const fuera = Object.fromEntries(Object.entries(v).map(([k, x]) => {
      if (!Array.isArray(x)) return [k, limpiar(x)];
      const r = filtrar(x);
      quitadas += r.quitadas;
      return [k, r.quedan];
    }));
    return quitadas ? { ...fuera, vetadasPorDisgusto: aviso(quitadas) } : fuera;
  }
  return limpiar(resultado);
}

async function aplicarVetos(nombre, resultado, state) {
  if (!DE_FUERA.test(nombre)) return resultado;
  const s = await state?.read?.();
  return sinVetadas(resultado, categoriasVetadas(s?.preferences));
}

module.exports = { categoriasVetadas, choca, sinVetadas, aplicarVetos, DE_FUERA };
