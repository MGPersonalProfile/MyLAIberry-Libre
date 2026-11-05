function ajustesPorDefecto() {
  return {
    theme: 'dark', font: 'serif', fontSize: 18, lang: 'es',
    autoTranslate: true, readTranslated: false,
    vozNarracion: '', vozDialogo: '', vozMujer: '', vozHombre: '', vocesPorPersonaje: {}, velocidadVoz: 1,

    avisarCapitulos: true, seguirEnSegundoPlano: false,

    plazoPropuestasHoras: 24
  };
}

module.exports = { ajustesPorDefecto };
