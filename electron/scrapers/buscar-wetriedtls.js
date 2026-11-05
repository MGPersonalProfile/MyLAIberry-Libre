const BUSCADOR = 'https://api.wetriedtls.com/query';

const EQUIVALENCIA = { kudos_count: 'total_views', revised_at: 'latest', hits: 'total_views' };

function urlDeBusqueda({ consulta, orden = 'kudos_count', pagina = 1 }) {
  const p = new URLSearchParams({
    query_string: String(consulta || '').trim(),
    series_type: 'Novel',
    orderBy: EQUIVALENCIA[orden] || 'total_views',
    order: 'desc',
    perPage: '20',
    page: String(pagina)
  });
  return `${BUSCADOR}?${p}`;
}

function textoDeHtml(html) {
  return String(html || '')

    .replace(/<br\b[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

function autorDeSinopsis(texto) {
  const m = String(texto || '').match(/^(?:writer|author|autor)\s*:\s*(.+)$/im);
  return m ? m[1].trim() : '';
}

function obrasDeRespuesta(json) {
  return (json?.data || []).filter(s => s?.series_slug && s?.title).map(s => {
    const synopsis = textoDeHtml(s.description);
    const capitulos = Number(s.meta?.chapters_count) || 0;
    return {
      idOrigen: String(s.id ?? s.series_slug),
      title: String(s.title).trim(),
      author: autorDeSinopsis(synopsis),
      synopsis,
      url: `https://wetriedtls.com/series/${s.series_slug}`,
      source: 'WeTriedTLs',
      coverUrl: s.thumbnail || '',
      totalChapters: capitulos,

      sinCifras: ['kudos', 'wordCount'],
      completa: /^completed?$/i.test(String(s.status || '')),
      tags: (s.tags || []).map(t => t?.name).filter(Boolean).map(name => ({ name, category: 'freeform' })),

      otrosTitulos: String(s.alternative_names || '').split('|').map(t => t.trim()).filter(Boolean),
      chapterList: []
    };
  });
}

async function buscar({ consulta, orden, pagina = 1, url } = {}, { pedir = fetch } = {}) {
  if (!url && !String(consulta || '').trim()) return [];
  const r = await pedir(url || urlDeBusqueda({ consulta, orden, pagina }), {
    signal: AbortSignal.timeout(30000),
    headers: { Accept: 'application/json' }
  });
  if (!r.ok) throw new Error(`WeTriedTLs respondió ${r.status}`);
  return obrasDeRespuesta(await r.json());
}

module.exports = { buscar, urlDeBusqueda, obrasDeRespuesta, textoDeHtml, autorDeSinopsis };
