import { Home, Search, Library, Sparkles, LayoutGrid } from 'lucide-react';

export const PESTANAS_MOVIL = [
  { id: 'inicio', clave: 'nav.home', icono: Home, vistas: ['inicio'] },
  { id: 'explorar', clave: 'mobile.search', icono: Search, vistas: ['explorar'] },
  { id: 'biblioteca', clave: 'nav.library', icono: Library, vistas: ['biblioteca'] },
  { id: 'asistente', clave: 'nav.assistant', icono: Sparkles, vistas: ['asistente'] },
  { id: 'mas', clave: 'mobile.more', icono: LayoutGrid, vistas: ['mas', 'milista', 'autores', 'descubrimientos', 'ajustes'] }
];
