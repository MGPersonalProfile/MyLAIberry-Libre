export async function prepararAlmacenamiento(storage) {
  let libres = null;
  try {
    const { usage, quota } = await storage?.estimate?.() || {};
    if (Number.isFinite(quota - usage)) libres = Math.max(0, quota - usage);
  } catch {  }
  if (libres === 0) return { permitido: false, libres, persistente: null };
  let persistente = null;
  try { if (storage?.persist) persistente = await storage.persist(); }
  catch { persistente = false; }
  return { permitido: true, libres, persistente };
}
