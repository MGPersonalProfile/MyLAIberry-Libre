export default function SinPuente() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-[#141414] px-8 text-center text-gray-200">
      <p className="text-lg font-semibold">No se puede hablar con tu PC</p>
      <p className="text-sm text-gray-400">Comprueba que MyLAIberry está abierto en el PC, con «Leer desde el móvil» encendido, y que el móvil tiene conexión.</p>
      <button
        onClick={() => location.reload()}
        className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black active:scale-95 transition-transform"
      >
        Reintentar
      </button>
    </div>
  )
}
