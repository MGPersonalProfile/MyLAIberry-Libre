import { useEffect, useRef } from 'react';
import { crearCronometro } from '../components/lector/cronometroDeSesion.js';
import { entregarSesion, reenviarSesiones } from '../components/lector/colaDeSesiones.js';

const aparato = () => {
  try {
    const clave = 'mylaiberry:deviceId';
    const guardado = JSON.parse(localStorage.getItem(clave) || 'null');
    if (guardado) return guardado;
    const nuevo = globalThis.crypto?.randomUUID?.() || `d-${Date.now()}`;
    localStorage.setItem(clave, JSON.stringify(nuevo));
    return nuevo;
  } catch { return 'sin-almacen'; }
};

export default function useSesionDeLectura({ storyId, capitulo, avance }) {
  const avanceRef = useRef(avance);
  useEffect(() => { avanceRef.current = avance; }, [avance]);

  useEffect(() => {
    if (!window.api?.registrarSesionLectura || !storyId) return undefined;
    reenviarSesiones(window.api).catch(() => {});
    let cron = crearCronometro({ obraId: storyId, capitulo, deviceId: aparato() });
    const mandar = (reabrir) => {
      const sesion = cron.cerrar();
      if (sesion) {
        if (reabrir) cron = crearCronometro({ obraId: storyId, capitulo, deviceId: aparato() });
        entregarSesion(window.api, sesion).catch(() => {});
      }
    };
    const latir = () => { cron.latir(avanceRef.current); if (cron.largo()) mandar(true); };
    const alVisibilidad = () => { cron.ocultar(document.hidden); if (document.hidden) mandar(true); };
    const eventos = ['pointerdown', 'keydown', 'wheel', 'touchmove', 'scroll'];
    eventos.forEach(e => window.addEventListener(e, latir, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', alVisibilidad);
    window.addEventListener('pagehide', alVisibilidad);
    const pulso = setInterval(latir, 15_000);
    return () => {
      clearInterval(pulso);
      eventos.forEach(e => window.removeEventListener(e, latir, { capture: true }));
      document.removeEventListener('visibilitychange', alVisibilidad);
      window.removeEventListener('pagehide', alVisibilidad);
      cron.latir(avanceRef.current);
      mandar(false);
    };
  }, [storyId, capitulo]);
}
