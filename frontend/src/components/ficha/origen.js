const ORIGEN_GENERO = {
  sitio: 'genres.from_site',
  usuario: 'genres.from_user',
  modelo: 'genres.from_model',
  propagado: 'genres.from_propagated'
};

export default function origenDeGenero(origen) {
  return ORIGEN_GENERO[origen] || ORIGEN_GENERO.sitio;
}
