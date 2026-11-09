import { useCallback, useEffect, useRef, useState } from 'react';

const TERMINALES = new Set(['caducado', 'sin-sesion', 'ventana-destruida', 'sin-reto', 'no-autorizado']);

const IMAGEN_VIEJA_MS = 5000;

const clienteDeEsteMovil = () => {
  try {
    const guardado = sessionStorage.getItem('mylaiberry.reto-cliente');
    if (guardado) return guardado;
    const nuevo = `movil-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem('mylaiberry.reto-cliente', nuevo);
    return nuevo;
  } catch { return `movil-${Math.random().toString(36).slice(2, 10)}`; }
};
let contadorDeToques = 0;

export default function useRetoRemoto(reto, { api = window.api, imagenViejaMs = IMAGEN_VIEJA_MS } = {}) {
  const [estado, setEstado] = useState('abriendo');
  const [imagen, setImagen] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [ahora, setAhora] = useState(0);
  const [ultimaOk, setUltimaOk] = useState(0);
  const vivo = useRef({ id: 0, url: null, fallos: 0 });
  const [caducaEn, setCaducaEn] = useState(0);

  useEffect(() => {
    let sigo = true, reloj = null;
    const v = vivo.current;

    const terminar = (codigo) => { if (sigo) { sigo = false; clearTimeout(reloj); setEstado('cerrada'); setMotivo(codigo || 'otro'); } };
    async function vuelta() {
      if (!sigo) return;
      let espera = 2000;
      try {
        const f = await api.fotogramaRetoRemoto(reto.id, reto.token, v.id || null);
        if (!sigo) return;
        setUltimaOk(Date.now());
        v.fallos = 0;
        espera = f.cadenciaMs || 1000;
        if (f.blob) {
          if (v.url) URL.revokeObjectURL(v.url);
          v.url = URL.createObjectURL(f.blob); v.id = f.id;
          setImagen({ url: v.url, id: f.id, viewport: f.viewport });
        }
        setEstado('activa');
      } catch (e) {
        if (TERMINALES.has(e?.codigo)) { terminar(e.codigo); return; }

        if (++v.fallos % 3 === 0) {
          api.asistenteRetoRemotoEstado?.(reto.id, reto.token).then(r => { if (sigo && r && !r.activa) terminar('sin-sesion'); },
            x => { if (TERMINALES.has(x?.codigo)) terminar(x.codigo); });
        }
      }
      reloj = setTimeout(vuelta, espera);
    }
    (async () => {
      try {
        const r = await api.asistenteRetoRemotoIniciar(reto.id, reto.token, { cliente: clienteDeEsteMovil() });
        if (!sigo) return;
        setCaducaEn(r?.caducaEn || 0);
        vuelta();
      } catch (e) { if (sigo) { setEstado('cerrada'); setMotivo(e?.codigo || 'otro'); setError(String(e?.message || e)); } }
    })();
    const pulso = setInterval(() => setAhora(Date.now()), 1000);
    reloj = setTimeout(() => setAhora(Date.now()), 0);
    return () => {
      sigo = false; clearTimeout(reloj); clearInterval(pulso);
      if (v.url) URL.revokeObjectURL(v.url);
      api.asistenteRetoRemotoFinalizar?.(reto.id, reto.token).catch(() => {});
    };
  }, [reto.id, reto.token, api]);

  const imagenVieja = estado === 'activa' && ahora > 0 && ahora - ultimaOk > imagenViejaMs;
  const puedeTocar = estado === 'activa' && !!imagen && !imagenVieja;

  const tocar = useCallback(async (punto) => {
    if (!puedeTocar || !punto) return false;
    setError('');
    try {
      await api.asistenteRetoRemotoTocar(reto.id, reto.token, { frame: imagen.id, x: punto.x, y: punto.y, id: `toque-${Date.now()}-${++contadorDeToques}` });
      return true;
    } catch (e) {
      if (TERMINALES.has(e?.codigo)) { setEstado('cerrada'); setMotivo(e.codigo); }
      else setError(String(e?.message || e));
      return false;
    }
  }, [api, imagen, puedeTocar, reto.id, reto.token]);

  const restanteMs = caducaEn && ahora ? Math.max(0, caducaEn - ahora) : null;
  return { estado, imagen, imagenVieja, puedeTocar, tocar, motivo, error, restanteMs };
}
