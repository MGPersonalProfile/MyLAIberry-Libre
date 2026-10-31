export const PESTANAS = [
  { id: 'inicio', clave: 'nav.home' },
  { id: 'biblioteca', clave: 'nav.library' },
  { id: 'explorar', clave: 'nav.explore' },
  { id: 'milista', clave: 'nav.mylist' },
  { id: 'autores', clave: 'nav.authors' },
  { id: 'descubrimientos', clave: 'carousel.discoveries' },
  { id: 'asistente', clave: 'nav.assistant' },
  { id: 'ajustes', clave: 'settings.nav' }
];

export const ES_PESTANA = new Set(PESTANAS.map(p => p.id));
