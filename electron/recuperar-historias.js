const { JSDOM } = require('jsdom');

const CAMPOS_RECUPERACION = [
  'titulo', 'autor', 'fandom', 'personajes', 'parejas', 'plataforma',
  'fechaAproximada', 'escenasRecordadas', 'elementosTrama', 'enlacesAntiguos',
  'identificadoresObra', 'referenciasCruzadas'
];

const norm = s => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

function canonizarUrl(u) {
  try {
    const obj = new URL(u);
    return `${obj.origin}${obj.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return String(u || '').trim().toLowerCase();
  }
}

function canonizarId(id) {
  return norm(id).replace(/^[a-z0-9_-]+:/, '');
}

function parsearAo3Fixture(html) {
  if (!html) return {};
  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const title = doc.querySelector('.title, h2')?.textContent?.trim();
    const author = doc.querySelector('.byline, h3')?.textContent?.replace(/^by\s+/i, '').trim();
    const synopsis = doc.querySelector('.summary blockquote')?.textContent?.trim();
    const fandom = doc.querySelector('.fandom a')?.textContent?.trim();
    const characters = [...doc.querySelectorAll('.character a')].map(a => a.textContent.trim()).filter(Boolean);
    const res = {};
    if (title) res.title = title;
    if (author) res.author = author;
    if (synopsis) res.synopsis = synopsis;
    if (fandom) res.fandom = fandom;
    if (characters.length) res.characters = characters;
    return res;
  } catch {
    return {};
  }
}

function comprobarCoincidenciaPista(obra, pista) {
  const campo = pista.campo;
  const buscado = norm(pista.valor || pista.text);
  if (!buscado) return 'no_comprobada';

  if (campo === 'enlacesAntiguos' || campo === 'identificadoresObra') {
    if (obra.url && canonizarUrl(obra.url) === canonizarUrl(buscado)) return 'coincide';
    if (obra.id && canonizarId(obra.id) === canonizarId(buscado)) return 'coincide';
    return 'no_comprobada';
  }

  if (campo === 'fandom') {
    if (!obra.fandom) return 'no_comprobada';
    return norm(obra.fandom).includes(buscado) ? 'coincide' : 'contradice';
  }

  if (campo === 'autor') {
    if (!obra.author) return 'no_comprobada';
    return norm(obra.author).includes(buscado) ? 'coincide' : 'contradice';
  }

  if (campo === 'titulo') {
    if (!obra.title) return 'no_comprobada';
    return norm(obra.title).includes(buscado) ? 'coincide' : 'contradice';
  }

  if (campo === 'elementosTrama' || campo === 'escenasRecordadas') {
    const cuerpo = norm(`${obra.title || ''} ${obra.synopsis || ''}`);
    if (!cuerpo) return 'no_comprobada';
    if (pista.incompatibleCon && cuerpo.includes(norm(pista.incompatibleCon))) {
      return 'contradice';
    }
    const palabrasClave = buscado.split(/\s+/).filter(w => w.length > 3);
    const presentes = palabrasClave.filter(w => cuerpo.includes(w));
    return presentes.length > 0 ? 'coincide' : 'no_comprobada';
  }

  if (campo === 'personajes') {
    const chars = (obra.characters || []).map(norm);
    if (!chars.length) return 'no_comprobada';
    const buscados = [pista.valor].flat().map(norm);
    return buscados.some(b => chars.some(c => c.includes(b))) ? 'coincide' : 'no_comprobada';
  }

  return 'no_comprobada';
}

function clasificarPistasObra(obra, pistas) {
  const coincidencias = [];
  const contradicciones = [];
  const pendientes = [];
  for (const p of pistas) {
    const st = comprobarCoincidenciaPista(obra, p);
    if (st === 'coincide') coincidencias.push(p.valor || p.text);
    else if (st === 'contradice') contradicciones.push(p.valor || p.text);
    else pendientes.push(p.valor || p.text);
  }
  return { coincidencias, contradicciones, pendientes };
}

function verificarFuentesConIdentidad(contexto, pistas, coincidencias) {
  const origenes = new Set(
    (contexto.fuentesIndependientes || []).map(f => {
      try {
        const u = new URL(f.url);
        return `${u.origin}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
      } catch {
        return String(f.fuente || f.url || '').toLowerCase().trim();
      }
    }).filter(Boolean)
  );
  if (origenes.size < 2) return false;
  const coincidentes = pistas.filter(p => coincidencias.includes(p.valor || p.text));
  return coincidentes.some(p =>
    (p.campo === 'enlacesAntiguos' || p.campo === 'identificadoresObra' || p.campo === 'referenciasCruzadas')
    || (p.campo === 'autor' && p.certeza === 'segura' && coincidentes.some(p2 => p2.campo === 'titulo'))
  );
}

function evaluarRecuperacion(obraCruda = {}, pistas = [], contexto = {}) {
  const raw = obraCruda || {};
  const parseado = raw.html ? parsearAo3Fixture(raw.html) : {};
  const obra = { ...raw, ...parseado };
  const { coincidencias, contradicciones, pendientes } = clasificarPistasObra(obra, pistas);
  const determinantes = [];

  if (obra.inaccesible) pendientes.push('Página inaccesible en el sitio de origen');

  const tieneContradiccionSegura = pistas.some(p => p.certeza === 'segura' && contradicciones.includes(p.valor || p.text));
  const tieneEnlaceOIdCanonica = pistas.some(p => (p.campo === 'enlacesAntiguos' || p.campo === 'identificadoresObra')
    && p.certeza === 'segura' && coincidencias.includes(p.valor || p.text));
  const dosFuentesConIdentidad = verificarFuentesConIdentidad(contexto, pistas, coincidencias);

  let estado = 'candidato';
  let veredicto = 'encaja';

  if (tieneContradiccionSegura) {
    estado = 'candidato';
    veredicto = 'descartada';
  } else if (tieneEnlaceOIdCanonica && !obra.inaccesible) {
    estado = 'confirmado';
    determinantes.push('Coincidencia canónica verificada por enlace o identificador de obra');
  } else if (dosFuentesConIdentidad && !tieneContradiccionSegura && !obra.inaccesible) {
    estado = 'confirmado';
    determinantes.push('Identificación cruzada concordante en 2 fuentes independientes con evidencia de identidad');
  } else if (coincidencias.length === 0) {
    veredicto = 'sin comprobar';
  }

  return {
    title: obra.title || 'Obra sin título',
    author: obra.author || 'Autor desconocido',
    url: obra.url || '',
    fuente: obra.fuente || obra.source || contexto.fuente || 'fuente desconocida',
    estado,
    veredicto,
    incompatible: tieneContradiccionSegura,
    coincidencias,
    contradicciones,
    pendientes,
    evidenciasDeterminantes: determinantes
  };
}

function formatearResultadoRecuperacion(r = {}) {
  const fuente = r.fuente || 'fuente desconocida';
  if (r.estado === 'confirmado') {
    return {
      estado: 'confirmado',
      obra: r.title,
      fuente,
      enlace: r.url,
      evidenciasDeterminantes: r.evidenciasDeterminantes || [],
      pistasSinComprobar: r.pistasSinComprobar || r.pendientes || []
    };
  }
  return {
    estado: 'candidato',
    obra: r.title,
    fuente,
    coincidencias: r.coincidencias || [],
    contradicciones: r.contradicciones || [],
    pendientes: r.pendientes || [],
    enlace: r.url
  };
}

function actualizarInvestigacionHistoria(caso, nuevosResultados = [], nuevasEvidencias = []) {
  if (!Array.isArray(caso.candidatos)) caso.candidatos = [];
  for (const r of nuevosResultados) {
    const rCanonica = canonizarUrl(r.url || '');
    const ya = caso.candidatos.find(c => {
      if (c.url === r.url) return true;
      if (rCanonica && canonizarUrl(c.url || '') === rCanonica) return true;
      return false;
    });
    if (!ya) {
      caso.candidatos.push({
        ...r,
        estado: r.estado || 'candidato',
        incompatible: r.incompatible || false,
        historialEvidencias: [`Detectada candidata: ${r.title}`]
      });
    }
  }

  for (const { url, nuevaEvidencia } of nuevasEvidencias) {
    const urlCanonica = canonizarUrl(url || '');
    const c = caso.candidatos.find(x => x.url === url || (urlCanonica && canonizarUrl(x.url || '') === urlCanonica));
    if (c) {
      if (!Array.isArray(c.historialEvidencias)) c.historialEvidencias = [];
      c.historialEvidencias.push(nuevaEvidencia.motivo || 'Actualización de evidencia');
      if (nuevaEvidencia.contradice) {
        c.incompatible = true;
        c.veredicto = 'descartada';
        c.estado = 'candidato';
      }
    }
  }
  return caso;
}

module.exports = {
  CAMPOS_RECUPERACION,
  evaluarRecuperacion,
  formatearResultadoRecuperacion,
  actualizarInvestigacionHistoria
};
