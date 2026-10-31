import { useCallback, useEffect, useState } from 'react';

export default function useActualizacion() {
  const [estado, setEstado] = useState(null);
  const [instalando, setInstalando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vivo = true;
    window.api?.buscarActualizacion?.().then(r => { if (vivo) setEstado(r); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const actualizar = useCallback(async () => {
    setInstalando(true);
    setError(null);
    const r = await window.api?.instalarActualizacion?.().catch(e => ({ ok: false, error: e?.message }));

    if (!r?.ok) { setInstalando(false); setError(r?.error || 'No se pudo actualizar.'); }
  }, []);

  return { estado, instalando, error, actualizar };
}
