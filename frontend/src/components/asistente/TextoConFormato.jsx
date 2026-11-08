const EN_LINEA = /(\*\*[^*\n]+\*\*|\*[^*\s][^*\n]*\*|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s)<>'"]+)/g;

function abrir(e, url) {
  e.preventDefault();
  window.api?.abrirEnNavegador?.(url);
}

function Enlace({ url, children }) {
  return (
    <a href={url} onClick={(e) => abrir(e, url)} className="underline decoration-white/30 hover:decoration-white break-all">
      {children}
    </a>
  );
}

function EnLinea({ texto }) {
  return String(texto).split(EN_LINEA).map((trozo, i) => {
    if (i % 2 === 0) return trozo;
    if (trozo.startsWith('**')) return <strong key={i}>{trozo.slice(2, -2)}</strong>;
    if (trozo.startsWith('`')) return <code key={i} className="font-mono text-[0.9em] opacity-90">{trozo.slice(1, -1)}</code>;
    if (trozo.startsWith('[')) {
      const [, etiqueta, url] = trozo.match(/^\[([^\]]+)\]\((.+)\)$/);
      return <Enlace key={i} url={url}>{etiqueta}</Enlace>;
    }
    if (trozo.startsWith('http')) {

      const [, url, cola] = trozo.match(/^(.*?)([.,;:!?]*)$/);
      return <span key={i}><Enlace url={url}>{url}</Enlace>{cola}</span>;
    }
    return <em key={i}>{trozo.slice(1, -1)}</em>;
  });
}

const ITEM = /^\s*(?:[-*•]|\d+[.)])\s+/;

function bloques(texto) {
  const salida = [];
  let codigo = null;
  for (const linea of String(texto || '').split('\n')) {

    if (linea.trim().startsWith('```')) {
      if (codigo) { salida.push({ tipo: 'codigo', texto: codigo.join('\n') }); codigo = null; } else codigo = [];
      continue;
    }
    if (codigo) { codigo.push(linea); continue; }
    const esItem = ITEM.test(linea);
    const ultimo = salida[salida.length - 1];
    if (!linea.trim()) { salida.push({ tipo: 'hueco' }); continue; }
    const limpia = linea.replace(/^\s*#{1,6}\s+/, '');
    if (esItem && ultimo?.tipo === 'lista') ultimo.items.push(limpia.replace(ITEM, ''));
    else if (esItem) salida.push({ tipo: 'lista', ordenada: /^\s*\d/.test(linea), items: [limpia.replace(ITEM, '')] });
    else if (ultimo?.tipo === 'parrafo') ultimo.lineas.push(limpia);
    else salida.push({ tipo: 'parrafo', lineas: [limpia] });
  }
  if (codigo) salida.push({ tipo: 'codigo', texto: codigo.join('\n') });
  return salida.filter(b => b.tipo !== 'hueco');
}

export default function TextoConFormato({ texto }) {
  return (
    <div className="space-y-2 leading-relaxed text-sm break-words">
      {bloques(texto).map((b, i) => {
        if (b.tipo === 'codigo') {
          return <pre key={i} className="rounded-md bg-background border border-border/60 p-3 overflow-x-auto font-mono text-small text-text-primary">{b.texto}</pre>;
        }
        if (b.tipo === 'parrafo') {
          return <p key={i} className="whitespace-pre-wrap"><EnLinea texto={b.lineas.join('\n')} /></p>;
        }
        const Lista = b.ordenada ? 'ol' : 'ul';
        return (
          <Lista key={i} className={`pl-5 space-y-1 ${b.ordenada ? 'list-decimal' : 'list-disc'}`}>
            {b.items.map((it, j) => <li key={j}><EnLinea texto={it} /></li>)}
          </Lista>
        );
      })}
    </div>
  );
}
