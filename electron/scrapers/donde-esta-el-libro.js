const { JSDOM } = require('jsdom');

const IDIOMAS = { spa: 'es', eng: 'en', fre: 'fr', fra: 'fr', ger: 'de', deu: 'de', ita: 'it', por: 'pt', cat: 'ca', rus: 'ru', jpn: 'ja' };
const ACCESO = { public: 'se lee gratis', borrowable: 'se puede tomar prestado gratis', printdisabled: 'sólo para personas con discapacidad lectora', no_ebook: 'no hay libro electrónico' };
const AGENTE = { 'user-agent': 'MyLAIberry/1.0 (lector personal)' };

async function deOpenLibrary(consulta, { pedir = fetch } = {}) {
  const campos = 'key,title,author_name,first_publish_year,language,ebook_access,ia,edition_count';
  const r = await pedir(`https://openlibrary.org/search.json?${new URLSearchParams({ q: consulta, limit: '6', fields: campos })}`,
    { headers: AGENTE, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`Open Library respondió ${r.status}`);
  return ((await r.json()).docs || []).map(d => ({
    titulo: d.title, autor: (d.author_name || []).slice(0, 2).join(', '), anio: d.first_publish_year, ediciones: d.edition_count,
    idiomas: [...new Set((d.language || []).map(l => IDIOMAS[l]).filter(Boolean))],
    acceso: ACCESO[d.ebook_access] || d.ebook_access || 'no consta',
    url: `https://openlibrary.org${d.key}`,
    ...(d.ebook_access === 'public' && d.ia?.length ? { leer: `https://archive.org/details/${d.ia[0]}` } : {})
  }));
}

async function deStandardEbooks(consulta, { pedir = fetch } = {}) {
  const r = await pedir(`https://standardebooks.org/ebooks?${new URLSearchParams({ query: consulta })}`,
    { headers: AGENTE, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`Standard Ebooks respondió ${r.status}`);
  return librosDeStandardEbooks(await r.text());
}

function librosDeStandardEbooks(html) {
  const doc = new JSDOM(html).window.document;
  return [...doc.querySelectorAll('li[typeof="schema:Book"]')].slice(0, 6).map(li => ({
    titulo: (li.querySelector('p > a > [property="schema:name"]')?.textContent || '').trim(),
    autor: (li.querySelector('.author [property="schema:name"]')?.textContent || '').trim(),
    acceso: 'gratis (dominio público)', url: `https://standardebooks.org${li.getAttribute('about')}`
  })).filter(l => l.titulo);
}

async function dondeEstaElLibro({ consulta } = {}, { pedir = fetch, gutenberg = require('./buscar-gutenberg.js').buscar } = {}) {
  const q = String(consulta || '').trim();
  if (!q) throw Object.assign(new Error('Dime el título o el autor del libro.'), { delUsuario: true });
  const fuentes = {
    'Project Gutenberg': () => gutenberg({ consulta: q }).then(l => l.slice(0, 6).map(o => ({ titulo: o.title, autor: o.author, idiomas: o.language ? [o.language] : [],
      acceso: 'gratis (dominio público), se puede importar', url: o.url }))),
    'Standard Ebooks': () => deStandardEbooks(q, { pedir }),
    'Open Library': () => deOpenLibrary(q, { pedir })
  };
  const resultados = {}, errores = {};
  await Promise.all(Object.entries(fuentes).map(([nombre, f]) => f().then(l => { resultados[nombre] = l; }, e => { errores[nombre] = e.message; })));
  return { consulta: q, resultados, ...(Object.keys(errores).length ? { errores } : {}),
    aviso: 'Para comprarlo, busca las tiendas con buscar_en_internet. Lo de Project Gutenberg se puede importar con importar_enlace_libro o preparar_obra.' };
}

module.exports = { dondeEstaElLibro, librosDeStandardEbooks, deOpenLibrary };
