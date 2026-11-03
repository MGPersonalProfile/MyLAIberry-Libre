import { useEffect, useState } from 'react';

export default function useAvisoAsistente() {
  const [estado, setEstado] = useState(null);
  useEffect(() => {
    let vivo = true;
    let generacion = 0;
    const leer = () => {
      const turno = ++generacion;
      window.api?.asistenteVer?.(null, { solo: ['notificaciones'] })
        .then(r => {
          if (!vivo || turno !== generacion || r?.status !== 'ok') return;
          setEstado(r.vista?.enCurso?.length ? 'respondiendo' : r.vista?.sinLeer?.length ? 'listo' : null);
        }).catch(() => {});
    };
    leer();
    const soltar = window.api?.onAsistenteEstadoPeticion?.(dato => {
      if (dato.scope === 'library' && ['inicio', 'fin', 'leido'].includes(dato.fase)) leer();
    });
    window.addEventListener('mylaiberry-conexion', leer);
    document.addEventListener('visibilitychange', leer);
    return () => {
      vivo = false;
      soltar?.();
      window.removeEventListener('mylaiberry-conexion', leer);
      document.removeEventListener('visibilitychange', leer);
    };
  }, []);
  return estado;
}
