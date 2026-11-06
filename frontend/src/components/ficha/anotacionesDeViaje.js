import { crearSincronizador } from '../lector/sincronizadorSubrayados.js';
import { almacenPorDefecto } from '../lector/almacenSubrayados.js';

export async function llevarAnotacionesDeViaje(api, obra, almacen = almacenPorDefecto()) {
  if (!api?.operarSubrayado || !api?.listarSubrayados) return null;
  const r = await crearSincronizador({ api, almacen, obra: String(obra) }).sincronizar();
  return { anotaciones: r.anotaciones.filter(a => !a.eliminado).length, pendientes: r.pendientes, conectado: !!r.conectado };
}
