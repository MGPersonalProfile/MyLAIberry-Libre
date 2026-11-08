import { PrimaryButton } from '../ui/Buttons';

export default function SinPuente() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-background px-8 text-center text-text-primary">
      <p className="text-title-3">No se puede hablar con tu PC</p>
      <p className="text-small text-text-secondary">Comprueba que MyLAIberry está abierto en el PC, con «Leer desde el móvil» encendido, y que el móvil tiene conexión.</p>
      <PrimaryButton onClick={() => location.reload()}>Reintentar</PrimaryButton>
    </div>
  );
}
