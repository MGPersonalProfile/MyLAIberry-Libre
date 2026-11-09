import { PrimaryButton } from '../ui/Buttons';
import { equipoActual } from '../../equipo';

export default function SinPuente() {
  const { tipo, nombre } = equipoActual();

  const pista = tipo === 'pc'
    ? 'Comprueba que MyLAIberry está abierto en el PC, con «Leer desde el móvil» encendido, y que el móvil tiene conexión.'
    : `Comprueba que el ${nombre} está encendido, que el móvil tiene internet y, si estás fuera de casa, que Tailscale está activado en el móvil.`;
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-background px-8 text-center text-text-primary">
      <p className="text-title-3">No se puede hablar con el {nombre}</p>
      <p className="text-small text-text-secondary">{pista}</p>
      <PrimaryButton onClick={() => location.reload()}>Reintentar</PrimaryButton>
    </div>
  );
}
