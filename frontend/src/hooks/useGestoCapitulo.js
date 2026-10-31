import { useEffect, useRef } from 'react';
import { pasoPorGesto } from '../components/lector/gestoCapitulo';

export default function useGestoCapitulo({ scrollRef, esMovil, capitulo, total, panel, irA }) {
  const bloquearHasta = useRef(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !esMovil) return undefined;
    let inicio = null;
    const punto = e => ({ id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now(), scroll: el.scrollTop });
    const alEmpezar = e => {
      inicio = null;
      if (e.pointerType !== 'touch' || !e.isPrimary || panel || !(e.target instanceof Element)) return;
      if (!e.target.closest('.reader-content') || e.target.closest('a, button, input, textarea, [contenteditable]')) return;
      if (String(window.getSelection?.() || '').trim()) return;
      inicio = punto(e);
    };
    const alTerminar = e => {
      const paso = pasoPorGesto(inicio, punto(e), {
        seleccionado: !!String(window.getSelection?.() || '').trim(), panel, capitulo, total
      });
      inicio = null;
      if (!paso) return;
      bloquearHasta.current = Date.now() + 400;
      irA(capitulo + paso);
    };
    const alCancelar = () => { inicio = null; };
    const alClick = e => {
      if (Date.now() >= bloquearHasta.current) return;
      bloquearHasta.current = 0;
      e.preventDefault(); e.stopImmediatePropagation();
    };
    el.addEventListener('pointerdown', alEmpezar);
    el.addEventListener('pointerup', alTerminar);
    el.addEventListener('pointercancel', alCancelar);
    el.addEventListener('click', alClick, true);
    return () => {
      el.removeEventListener('pointerdown', alEmpezar);
      el.removeEventListener('pointerup', alTerminar);
      el.removeEventListener('pointercancel', alCancelar);
      el.removeEventListener('click', alClick, true);
    };
  }, [scrollRef, esMovil, capitulo, total, panel, irA]);
}
