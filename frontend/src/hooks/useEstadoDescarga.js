import { useMemo } from 'react';

export default function useEstadoDescarga(obra, downloads) {
  return useMemo(() => {
    const vivo = obra ? downloads[String(obra.id)] : null;
    const hechos = vivo?.downloaded ?? obra?.downloadedChapters ?? 0;
    const total = vivo?.total || obra?.totalChapters || 0;
    return {
      hechos,
      total,
      pendiente: total > 0 && hechos < total,
      enCurso: !!vivo?.active,
      mensaje: vivo?.message || '',
      error: vivo?.error || null
    };
  }, [obra, downloads]);
}
