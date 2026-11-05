function herramientasDeNovedades(add, services) {
  add('que_hay_de_nuevo', 'Lo que trae de nuevo la app en sus últimas actualizaciones, escrito para el usuario. Úsala cuando pregunte «¿qué hay de nuevo?», «¿qué trae la actualización?», «¿qué habéis cambiado?». nivel: «breve» (por encima: el resumen de cada versión) o «a_fondo» (también qué cambia y por qué). desde: una versión (2026.11.4) si pide lo de después de esa; si no, se cuenta desde la última que ya vio. Cuéntalo con tus palabras, en el orden que viene (lo más nuevo primero), sin inventar nada que no traiga; si `nada` es true, dile que no hay nada nuevo desde la última vez.',
    {
      nivel: { type: 'string', enum: ['breve', 'a_fondo'] },
      desde: { type: 'string', maxLength: 40 }
    }, args => services.novedades(args), []);
}

module.exports = { herramientasDeNovedades };
