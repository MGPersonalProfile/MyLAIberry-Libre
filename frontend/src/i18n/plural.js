export const esUno = (valor) => (typeof valor === 'number' ? valor === 1 : String(valor ?? '').trim() === '1');
