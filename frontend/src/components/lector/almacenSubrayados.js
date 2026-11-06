const BD = 'mylaiberry-subrayados-1', ALMACEN = 'obras';

function abrir(idb) {
  return new Promise((ok, mal) => {
    const peticion = idb.open(BD, 1);
    peticion.onupgradeneeded = () => peticion.result.createObjectStore(ALMACEN);
    peticion.onsuccess = () => ok(peticion.result);
    peticion.onerror = () => mal(peticion.error);
  });
}
const esperar = tx => new Promise((ok, mal) => {
  tx.oncomplete = ok; tx.onerror = () => mal(tx.error); tx.onabort = () => mal(tx.error);
});

export function almacenIndexedDB(idb = globalThis.indexedDB) {
  let abierta = null;
  const bd = () => (abierta ||= abrir(idb));
  return {
    async leer(obra) {
      const db = await bd();
      return new Promise((ok, mal) => {
        const r = db.transaction(ALMACEN).objectStore(ALMACEN).get(obra);
        r.onsuccess = () => ok(r.result || null); r.onerror = () => mal(r.error);
      });
    },
    async guardar(obra, estado) {
      const db = await bd(), tx = db.transaction(ALMACEN, 'readwrite');
      tx.objectStore(ALMACEN).put(JSON.parse(JSON.stringify(estado)), obra);
      await esperar(tx);
    },

    async actualizar(obra, f) {
      const db = await bd(), tx = db.transaction(ALMACEN, 'readwrite'), tienda = tx.objectStore(ALMACEN);
      let resultado;
      const r = tienda.get(obra);
      r.onsuccess = () => { resultado = f(r.result || null); tienda.put(JSON.parse(JSON.stringify(resultado)), obra); };
      await esperar(tx);
      return resultado;
    },
    cerrar: async () => { if (abierta) (await abierta).close(); abierta = null; }
  };
}

export function almacenEnMemoria(datos = new Map()) {
  return {
    leer: async obra => (datos.has(obra) ? JSON.parse(datos.get(obra)) : null),
    guardar: async (obra, estado) => { datos.set(obra, JSON.stringify(estado)); },
    actualizar: async (obra, f) => {
      const nuevo = f(datos.has(obra) ? JSON.parse(datos.get(obra)) : null);
      datos.set(obra, JSON.stringify(nuevo));
      return JSON.parse(JSON.stringify(nuevo));
    },
    cerrar: async () => {}
  };
}

export const almacenPorDefecto = () => (globalThis.indexedDB ? almacenIndexedDB() : almacenEnMemoria());
