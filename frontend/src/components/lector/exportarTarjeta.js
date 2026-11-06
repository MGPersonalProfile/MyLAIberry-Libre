import { datosDeAnotacion, tarjetaPng, textoDeTarjeta } from './tarjetaCita';

export async function copiarCita(anotacion, obra, capitulo, incluirNota) {
  const texto = textoDeTarjeta(datosDeAnotacion(anotacion, obra, capitulo), { incluirNota });
  await navigator.clipboard.writeText(texto);
  return texto;
}

export async function guardarTarjeta(anotacion, obra, capitulo, opciones) {
  const r = await tarjetaPng(datosDeAnotacion(anotacion, obra, capitulo), opciones);
  if (!r.ok) return r;
  const archivo = new File([r.blob], 'cita.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo] }); return r; } catch (e) { if (e?.name === 'AbortError') return r; }
  }
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(r.blob); enlace.download = 'cita.png';
  document.body.append(enlace); enlace.click(); enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 10000);
  return r;
}
