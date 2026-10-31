export function pulsable(alPulsar, etiqueta) {
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': etiqueta,
    onClick: alPulsar,
    onKeyDown: (evento) => {
      if (evento.key !== 'Enter' && evento.key !== ' ') return;
      evento.preventDefault();
      alPulsar(evento);
    }
  };
}
