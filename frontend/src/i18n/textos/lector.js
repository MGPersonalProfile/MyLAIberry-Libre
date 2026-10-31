export const LECTOR = {

  'reader.chapter_n':        { es: 'Capítulo {n}', en: 'Chapter {n}' },
  'reader.chapter_of':       { es: 'Cap. {n} de {total}', en: 'Ch. {n} of {total}' },
  'reader.reading_settings': { es: 'Lectura', en: 'Reading' },
  'reader.auto_scroll': { es: 'Desplazamiento automático', en: 'Auto scroll' },
  'reader.auto_speed': { es: 'Velocidad de desplazamiento', en: 'Scroll speed' },
  'reader.auto_slow': { es: 'Lenta', en: 'Slow' },
  'reader.auto_normal': { es: 'Normal', en: 'Normal' },
  'reader.auto_fast': { es: 'Rápida', en: 'Fast' },

  'reader.voice_play': { es: 'Leer en voz alta', en: 'Read aloud' },
  'reader.voice_stop': { es: 'Parar la lectura', en: 'Stop reading' },
  'reader.voice':      { es: 'Voz', en: 'Voice' },
  'reader.voice_narration': { es: 'Narración', en: 'Narration' },
  'reader.voice_dialogue': { es: 'Diálogo', en: 'Dialogue' },
  'reader.voice_automatic': { es: 'Automática', en: 'Automatic' },
  'reader.voice_dialogue_auto': { es: 'Otra voz automáticamente', en: 'Another voice automatically' },
  'reader.voice_women': { es: 'Mujeres', en: 'Women' },
  'reader.voice_men': { es: 'Hombres', en: 'Men' },
  'reader.voice_gender_auto': { es: 'Una voz de mujer u hombre, sola', en: 'A female or male voice, automatically' },
  'reader.voice_gender_hint': { es: 'Quien habla se reconoce por el inciso («—dijo ella») y por cómo se turnan; sin pista, va con la voz de diálogo.', en: 'The speaker is recognised from the tag (“she said”) and from turn-taking; without a clue, the dialogue voice is used.' },
  'reader.character_woman': { es: 'mujer', en: 'woman' },
  'reader.character_man': { es: 'hombre', en: 'man' },
  'reader.audio_title': { es: 'Este capítulo en MP3', en: 'This chapter as MP3' },
  'reader.audio_make': { es: 'Prepararlo con voces neuronales', en: 'Make it with neural voices' },
  'reader.audio_install': { es: 'Instalar las voces (≈ {mb} MB)', en: 'Install voices (≈ {mb} MB)' },
  'reader.audio_install_licenses': {
    es: 'Se bajan de sus autores, no van con MyLAIberry: Piper (MIT), ffmpeg (GPL-3.0) y siete voces de Piper en Hugging Face. Las voces son para uso personal y no comercial: seis parten del corpus Lessac (licencia sólo de investigación) y dos de ellas, además, de Hi-Fi Captain (CC BY-NC-SA 4.0).',
    en: 'Downloaded from their authors, not shipped with MyLAIberry: Piper (MIT), ffmpeg (GPL-3.0) and seven Piper voices on Hugging Face. The voices are for personal, non-commercial use: six build on the Lessac corpus (research-only licence) and two of them also on Hi-Fi Captain (CC BY-NC-SA 4.0).'
  },
  'reader.audio_install_progress': { es: 'Descargando voces: {n} %', en: 'Downloading voices: {n}%' },
  'reader.audio_hint_translated': { es: 'Se lee la traducción, con una voz para la narración y otra para mujeres y hombres. Tarda un par de minutos.', en: 'The translation is read, with one voice for narration and others for women and men. It takes a couple of minutes.' },
  'reader.audio_hint_original': { es: 'Este capítulo no está traducido: se lee el original.', en: 'This chapter is not translated: the original is read.' },
  'reader.audio_preparing': { es: 'Preparándolo…', en: 'Preparing…' },
  'reader.audio_work': { es: 'Toda la obra', en: 'The whole work' },
  'reader.audio_work_progress': { es: '{listos} de {total} capítulos en MP3', en: '{listos} of {total} chapters as MP3' },
  'reader.audio_work_preparing': { es: '{n} en la cola', en: '{n} queued' },
  'reader.audio_work_make': { es: 'Preparar los {n} que faltan', en: 'Make the {n} missing' },
  'reader.audio_save': { es: 'Bajar el MP3', en: 'Download the MP3' },
  'reader.voice_speed': { es: 'Velocidad', en: 'Speed' },
  'reader.character_voices': { es: 'Voces de personajes', en: 'Character voices' },
  'reader.character_voice_for': { es: 'Voz de', en: 'Voice for' },
  'reader.character_voice_remove': { es: 'Quitar la voz de', en: 'Remove voice for' },
  'reader.character_name': { es: 'Nombre del personaje', en: 'Character name' },
  'reader.character_add': { es: 'Añadir personaje', en: 'Add character' },

  'reader.time_left': { es: 'quedan {tiempo}', en: '{tiempo} left' },

  'recap.previously': { es: 'En el capítulo anterior', en: 'Previously' },
  'recap.dismiss':    { es: 'Ya me acuerdo', en: 'I remember' },
  'recap.improve':    { es: 'Mejorar este resumen', en: 'Improve this recap' },

  'recap.again':      { es: 'Pedir otro resumen', en: 'Ask for another one' },
  'recap.improving':  { es: 'Pidiéndolo…', en: 'Asking…' },

  'recap.needs_key':  {
    es: 'Para esto hace falta una clave de API, y no hay ninguna puesta.',
    en: 'This needs an API key, and there is none set.'
  },
  'recap.open_settings': { es: 'Ponerla en Ajustes', en: 'Set one in Settings' },
  'recap.failed':     {
    es: 'No se ha podido mejorar. Se queda el resumen de siempre.',
    en: 'Could not improve it. Keeping the usual recap.'
  },

  'reader.the_end':          { es: 'Fin', en: 'The end' },
  'reader.what_now':         { es: '¿Y ahora qué?', en: 'What now?' },

  'reader.caught_up':        { es: 'Estás al día', en: 'You’re caught up' },
  'reader.caught_up_ongoing': {
    es: 'La obra sigue en marcha. Cuando salga un capítulo nuevo aparecerá en «Nuevos capítulos», en el inicio.',
    en: 'This work is still ongoing. When a new chapter comes out it will show up under “New chapters” on the home screen.'
  },
  'reader.caught_up_unknown': {
    es: 'Es el último capítulo que hay. Si la obra sigue, el siguiente aparecerá en «Nuevos capítulos», en el inicio.',
    en: 'This is the latest chapter there is. If the work continues, the next one will show up under “New chapters” on the home screen.'
  },
  'reader.meanwhile':        { es: 'Mientras tanto', en: 'In the meantime' },
  'reader.ready_to_read':    { es: 'Listo para empezar', en: 'Ready to start' },

  'suggest.because':         { es: 'Comparte {tags}', en: 'Shares {tags}' },
  'reader.loading':          { es: 'Cargando Tinta...', en: 'Loading Ink...' },
  'reader.retry_translation': { es: 'Reintentar traducción', en: 'Retry translation' },
  'reader.load_error': { es: 'No se ha podido abrir este capítulo.', en: 'This chapter could not be opened.' },
  'reader.retry_load': { es: 'Volver a cargar el capítulo', en: 'Reload chapter' },

  'reader.read_in':          { es: 'Leer en español', en: 'Read in English' },
  'reader.read_original':    { es: 'Ver original', en: 'View original' },
  'reader.translating':      { es: 'Traduciendo…', en: 'Translating…' },
  'reader.translating_pct':  { es: 'Traduciendo… {pct} %', en: 'Translating… {pct}%' },
  'reader.translated_badge': { es: 'Traducción automática', en: 'Machine translation' },
  'reader.translate_error':  { es: 'No se pudo traducir. Inténtalo en unos minutos.', en: "Couldn't translate. Try again in a few minutes." },
  'reader.same_language':    { es: 'Este capítulo ya está en español.', en: 'This chapter is already in English.' },
  'reader.not_downloaded':   { es: 'Este capítulo todavía no está descargado.', en: "This chapter hasn't been downloaded yet." },
  'reader.downloading_bg':   { es: 'Se está bajando en segundo plano.', en: "It's coming down in the background." },
  'reader.no_db':            {
    es: 'No se pudo conectar con el motor de base de datos local de Electron.',
    en: "Couldn't connect to Electron's local database engine."
  },
  'reader.theme':            { es: 'Tema', en: 'Theme' },
  'reader.theme_dark':       { es: 'Oscuro', en: 'Dark' },
  'reader.theme_sepia':      { es: 'Sepia', en: 'Sepia' },
  'reader.theme_light':      { es: 'Claro', en: 'Light' },
  'reader.typography':       { es: 'Tipografía', en: 'Typeface' },
  'reader.font_serif':       { es: 'Serif', en: 'Serif' },
  'reader.font_sans':        { es: 'Sans', en: 'Sans' },
  'reader.size':             { es: 'Tamaño', en: 'Size' },
  'reader.font':             { es: 'Tipografía', en: 'Typeface' },

  'settings.title':          { es: 'Ajustes', en: 'Settings' },
  'settings.subtitle':       { es: 'Tu biblioteca y cómo la lees', en: 'Your library and how you read it' },
  'settings.close':          { es: 'Cerrar ajustes', en: 'Close settings' },
  'settings.loading':        { es: 'Calculando…', en: 'Working it out…' },
  'settings.nav':            { es: 'Ajustes', en: 'Settings' },

  'settings.library':        { es: 'Tu biblioteca', en: 'Your library' },
  'settings.library_desc':   { es: 'Lo que tienes guardado, contado sobre el disco.', en: 'What you have saved, counted straight off the disk.' },
  'settings.stat_works':     { es: 'Obras', en: 'Works' },
  'settings.stat_chapters':  { es: 'Capítulos', en: 'Chapters' },
  'settings.stat_read':      { es: 'Leídos', en: 'Read' },
  'settings.stat_translated':{ es: 'Traducidos', en: 'Translated' },
  'settings.stat_of_total':  { es: 'de {n} listados', en: 'of {n} listed' },
  'settings.stat_in_progress': { es: '{n} empezadas', en: '{n} in progress' },
  'settings.downloaded':     { es: 'Descargado', en: 'Downloaded' },
  'settings.in_queue':       { es: '{n} descarga(s) en curso', en: '{n} download(s) running' },

  'settings.language':       { es: 'Idioma', en: 'Language' },
  'settings.language_desc':  { es: 'El idioma de la aplicación es también al que se traducen los capítulos.', en: "The app's language is also the one chapters get translated into." },

  'settings.translation':    { es: 'Traducción', en: 'Translation' },
  'settings.translation_desc': { es: 'Los capítulos se traducen una vez y quedan guardados, así que después se leen al instante y sin conexión.', en: 'Chapters are translated once and kept, so afterwards they open instantly and work offline.' },
  'settings.auto_translate': { es: 'Traducir por adelantado', en: 'Translate ahead of time' },
  'settings.auto_translate_desc': { es: 'Prepara los tres primeros capítulos al añadir una obra, y va siempre uno por delante de tu lectura. Desactívalo si lees en el idioma original.', en: 'Prepares the first three chapters when you add a work, and always stays one ahead of your reading. Turn it off if you read in the original language.' },
  'settings.read_translated': { es: 'Abrir siempre traducido', en: 'Always open translated' },
  'settings.read_translated_desc': { es: 'Al entrar en un capítulo, mostrar la traducción en vez del original. Puedes cambiarlo en cualquier momento desde el lector.', en: 'When you open a chapter, show the translation instead of the original. You can switch any time from the reader.' },

  'settings.reading':        { es: 'Lectura', en: 'Reading' },
  'settings.reading_desc':   { es: 'Cómo se ve el texto. Lo mismo que hay dentro del lector, por si prefieres dejarlo listo antes de empezar.', en: 'How the text looks. The same controls as inside the reader, in case you would rather set it up beforehand.' },
  'settings.size_preview':   { es: 'Así se verá el texto de los capítulos.', en: 'This is how chapter text will look.' },

  'settings.import_bookmarks': { es: 'Traerte tu biblioteca de AO3', en: 'Bring your AO3 library over' },
  'settings.import_bookmarks_desc': {
    es: 'Pega la dirección de tu perfil y se traerán tus marcadores públicos, poco a poco y sin agobiar al sitio. De cada obra se guarda el primer capítulo; el resto llega cuando la abras.',
    en: 'Paste your profile address and your public bookmarks will come over, slowly and without hammering the site. Only the first chapter of each is saved; the rest arrives when you open it.'
  },
  'settings.import_start':   { es: 'Traer', en: 'Bring over' },
  'settings.import_running': { es: 'Empezando…', en: 'Starting…' },
  'settings.import_queued':  {
    es: 'En marcha. Las obras irán apareciendo en Descubrimientos; puedes cerrar la app y sigue donde lo dejó.',
    en: "Under way. Works will show up in Discoveries; you can close the app and it picks up where it left off."
  },
  'settings.import_failed':  { es: 'No se pudo empezar la importación.', en: "Couldn't start the import." },

  'settings.alerts':      { es: 'Avisos', en: 'Alerts' },
  'settings.alerts_desc': {
    es: 'La app busca capítulos nuevos de las obras que sigues y los descarga sola. Esto es para que te enteres.',
    en: 'The app looks for new chapters of the works you follow and downloads them on its own. This is so you find out.'
  },
  'settings.alerts_chapters':      { es: 'Avisarme de capítulos nuevos', en: 'Tell me about new chapters' },
  'settings.alerts_chapters_desc': {
    es: 'Sólo de obras de tu biblioteca, nunca de las que la app encuentra por su cuenta. Y agrupados: si aparecen cinco a la vez, es un aviso, no cinco.',
    en: 'Only for works in your library, never for ones the app finds on its own. And grouped: five at once is one alert, not five.'
  },
  'settings.alerts_unsupported': {
    es: 'Este sistema no permite enseñar avisos, así que este interruptor no hará nada.',
    en: 'This system doesn’t allow notifications, so this switch won’t do anything.'
  },
  'settings.alerts_background':      { es: 'Seguir vigilando con la ventana cerrada', en: 'Keep watching with the window closed' },
  'settings.alerts_background_desc': {
    es: 'Al cerrar la ventana, la app se queda en la bandeja buscando capítulos en vez de cerrarse del todo. Desde ahí puedes volver a abrirla o salir.',
    en: 'Closing the window leaves the app in the tray looking for chapters instead of quitting. From there you can reopen it or quit.'
  },

  'settings.alerts_via_ntfy': {
    es: 'Te llegan al móvil por ntfy, por el canal que configures. Al tocarlo se abre MyLAIberry.',
    en: 'They reach your phone through ntfy, on the channel you set up. Tapping one opens MyLAIberry.'
  },
  'settings.alerts_on_pc': {
    es: 'Salen como notificación en el ordenador que sirve la biblioteca.',
    en: 'They show up as a notification on the computer serving the library.'
  },
  'settings.alerts_mobile_always': {
    es: 'La revisión de capítulos corre en el equipo que sirve la biblioteca mientras esté encendido, aunque no abras la app en el móvil.',
    en: 'Chapter checks run on the computer serving the library while it is on, even if you don’t open the app on your phone.'
  },
  'settings.alerts_no_autostart': {
    es: 'La app nunca se abre sola al encender el ordenador. Esto sólo la mantiene despierta si ya estaba abierta.',
    en: 'The app never starts itself when you turn on your computer. This only keeps it awake if it was already open.'
  },

  'settings.bookmarklet':      { es: 'Importar desde el navegador', en: 'Import from your browser' },
  'settings.bookmarklet_desc': {
    es: 'Arrastra este botón a la barra de marcadores de tu navegador. Cuando estés leyendo algo que te apetezca guardar, púlsalo y la obra se importa aquí.',
    en: 'Drag this button to your browser’s bookmarks bar. When you’re reading something you want to keep, click it and the work gets imported here.'
  },
  'settings.bookmarklet_name': { es: 'Guardar en MyLAIberry', en: 'Save to MyLAIberry' },
  'settings.bookmarklet_drag': {
    es: 'Arrástralo a la barra de marcadores',
    en: 'Drag it to your bookmarks bar'
  },
  'settings.bookmarklet_how': {
    es: 'Si no ves la barra de marcadores, en Chrome y Edge se enseña con Ctrl+Mayús+B. También puedes arrastrar cualquier enlace directamente al icono de MyLAIberry.',
    en: 'If you can’t see the bookmarks bar, Ctrl+Shift+B shows it in Chrome and Edge. You can also drag any link straight onto the MyLAIberry icon.'
  },

  'settings.bookmarklet_desc_mobile': {
    es: 'Desde el navegador del móvil, abre la obra, pulsa «Compartir» y elige MyLAIberry: se abre aquí lista para importar. Hace falta tener MyLAIberry instalada en la pantalla de inicio desde Chrome.',
    en: 'In your phone’s browser, open the work, tap “Share” and pick MyLAIberry: it opens here ready to import. MyLAIberry has to be installed on your home screen from Chrome.'
  },
  'settings.bookmarklet_how_mobile': {
    es: 'En otros navegadores (Firefox incluido): «Copiar marcador», crea un marcador cualquiera y cambia su dirección por lo copiado. Para usarlo, en la página de la obra escribe el nombre del marcador en la barra de direcciones y elígelo.',
    en: 'In other browsers (Firefox too): “Copy bookmarklet”, create any bookmark and replace its address with what you copied. To use it, on the work’s page type the bookmark’s name in the address bar and pick it.'
  },
  'settings.bookmarklet_copy':   { es: 'Copiar marcador', en: 'Copy bookmarklet' },
  'settings.bookmarklet_copied': { es: 'Copiado', en: 'Copied' },
  'settings.bookmarklet_firefox': {
    es: 'En Firefox, arrastrarlo no funciona. Pulsa «Copiar marcador», haz clic derecho en la barra de marcadores (Ctrl+Mayús+B), «Añadir marcador…», ponle de nombre «Guardar en MyLAIberry» y pega lo copiado en «URL». La primera vez que lo uses, Firefox te preguntará si abrir MyLAIberry: acepta y marca que lo recuerde.',
    en: 'In Firefox, dragging doesn’t work. Click “Copy bookmarklet”, right-click the bookmarks toolbar (Ctrl+Shift+B), “Add Bookmark…”, name it “Save to MyLAIberry” and paste into “URL”. The first time you use it, Firefox asks whether to open MyLAIberry: allow it and tick “remember”.'
  },

  'settings.lan':      { es: 'Leer desde el móvil', en: 'Read on your phone' },
  'settings.lan_desc': {
    es: 'Tu biblioteca en el móvil, en casa y fuera, como una app. Va sólo por Tailscale: ningún puerto queda abierto a ninguna red.',
    en: 'Your library on your phone, at home and away, like an app. It only goes through Tailscale: no port is left open to any network.'
  },
  'settings.lan_switch':      { es: 'Servir la biblioteca', en: 'Serve the library' },
  'settings.lan_switch_desc': {
    es: 'Apágalo aquí si un rato no quieres que el móvil entre.',
    en: 'Turn it off here if for a while you do not want your phone to get in.'
  },
  'settings.lan_working':  { es: 'Un momento…', en: 'One moment…' },

  'settings.lan_always': { es: 'Siempre disponible', en: 'Always available' },
  'settings.lan_always_desc': {
    es: 'Se enciende al abrir MyLAIberry, y cerrar la ventana la deja en la bandeja en vez de apagarlo.',
    en: 'It turns on when MyLAIberry opens, and closing the window keeps it in the tray instead of turning it off.'
  },
  'settings.lan_login': { es: 'Abrir con Windows', en: 'Open with Windows' },
  'settings.lan_login_desc': {
    es: 'MyLAIberry arranca sola al encender el PC, escondida en la bandeja. Sólo en la aplicación instalada.',
    en: 'MyLAIberry starts by itself when the PC boots, hidden in the tray. Installed app only.'
  },
  'settings.lan_open':     { es: 'Abre esto en el móvil', en: 'Open this on your phone' },

  'settings.lan_code': {
    es: 'La parte final de la dirección es tu código de acceso: sin ella no se entra. Guárdala en los marcadores del móvil; no cambia de un arranque a otro.',
    en: 'The last part of the address is your access code: without it, nobody gets in. Bookmark it on your phone; it stays the same between launches.'
  },
  'settings.lan_new_code': {
    es: 'Cambiar el código (quien tenga la dirección vieja deja de entrar)',
    en: 'Change the code (anyone with the old address loses access)'
  },
  'settings.lan_safety': {
    es: 'El servidor sólo escucha dentro de este PC; la única puerta es Tailscale, que exige tu cuenta y cifra la conexión. Sólo se sirve tu biblioteca —ni ajustes, ni claves, ni descubrimientos— y lo único que el móvil escribe es por dónde vas.',
    en: 'The server only listens inside this PC; the only door is Tailscale, which requires your account and encrypts the connection. Only your library is served —no settings, keys or discoveries— and the only thing your phone writes is where you are.'
  },

  'settings.lan_tailscale_on': {
    es: 'Ábrela en el móvil con Tailscale encendido y elige «Añadir a pantalla de inicio»: se instala como una app, y lo que estás leyendo se guarda para leerlo sin conexión.',
    en: 'Open it on your phone with Tailscale on and pick “Add to Home screen”: it installs as an app, and what you are reading is kept for offline reading.'
  },

  'settings.lan_mobile_on': {
    es: 'Estás leyendo por aquí ahora mismo: la biblioteca se está sirviendo.',
    en: 'You are reading through here right now: the library is being served.'
  },
  'settings.lan_mobile_note': {
    es: 'Desde el móvil no se apaga ni se cambia el código —te quedarías sin puerta—. Eso, y si arranca sola con el equipo, se cambia en MyLAIberry del equipo que sirve la biblioteca.',
    en: 'It can’t be turned off or have its code changed from the phone —you would lock yourself out—. That, and whether it starts with the computer, is changed in MyLAIberry on the computer serving the library.'
  },
  'settings.lan_tailscale_off': {
    es: 'Hace falta Tailscale con la sesión iniciada en este PC y en el móvil. Instálalo, inicia sesión en los dos con la misma cuenta y vuelve a encender esto.',
    en: 'Tailscale must be signed in on this PC and on your phone. Install it, sign in on both with the same account, and turn this on again.'
  },

  'settings.sessions':      { es: 'Tus cuentas', en: 'Your accounts' },
  'settings.sessions_desc': {
    es: 'Entra una vez y la app entrará contigo. Se abre la página de acceso del propio sitio: tu contraseña va a su servidor y no pasa por aquí — igual que en tu navegador.',
    en: 'Sign in once and the app comes along. It opens the site’s own sign-in page: your password goes to their server and never through this app — same as in your browser.'
  },
  'settings.sessions_in':        { es: 'dentro', en: 'signed in' },
  'settings.sessions_in_action': { es: 'Iniciar sesión', en: 'Sign in' },
  'settings.sessions_out':       { es: 'Cerrar sesión', en: 'Sign out' },
  'settings.sessions_waiting':   { es: 'Esperando…', en: 'Waiting…' },
  'settings.sessions_benefit_on': {
    es: 'La app entra identificada al buscar y descargar.',
    en: 'The app browses signed in when searching and downloading.'
  },
  'settings.sessions_mobile': {
    es: 'Para entrar en un sitio se abre su página de acceso en el equipo que sirve la biblioteca: se hace desde allí. Cerrar sesión sí se puede desde aquí.',
    en: 'Signing in opens the site’s sign-in page on the computer serving the library, so it’s done there. Signing out works from here.'
  },
  'settings.sessions_mobile_out': { es: 'sin sesión', en: 'signed out' },
  'settings.sessions_other': { es: 'Otro sitio', en: 'Another site' },
  'settings.sessions_other_desc': {
    es: 'Cualquier web, también con «Iniciar sesión con Google». Entras en su página, cierras la ventana y el asistente ya entra contigo.',
    en: 'Any website, including “Sign in with Google”. Sign in on its page, close the window and the assistant browses signed in.'
  },
  'settings.sessions_other_placeholder': { es: 'wattpad.com, spacebattles.com…', en: 'wattpad.com, spacebattles.com…' },
  'settings.sessions_other_done': { es: 'Hecho: {dominio}', en: 'Done: {dominio}' },
  'settings.sessions_privacy': {
    es: 'Sólo se guarda la cookie que el sitio ponga, en el mismo lugar donde la pondría tu navegador. Al cerrar sesión se borra la de ese sitio y no se toca la de los demás.',
    en: 'Only the cookie the site sets is kept, in the same place your browser would keep it. Signing out clears that site’s cookie and leaves the others alone.'
  },

  'settings.recap_ai':      { es: 'Resúmenes mejorados', en: 'Better recaps' },
  'settings.recap_ai_desc': {
    es: 'Los resúmenes de "en el capítulo anterior" se hacen en tu ordenador, gratis y sin conexión. Si quieres una versión mejor escrita, puedes pedirla a mano con la clave del servicio que prefieras. Google Gemini tiene capa gratuita.',
    en: 'The "previously on" recaps are made on your computer, free and offline. For a better-written version you can ask on demand using a key from whichever service you prefer. Google Gemini has a free tier.'
  },
  'settings.recap_ai_placeholder': { es: 'Clave de API (opcional)', en: 'API key (optional)' },

  'settings.ai_provider':   { es: 'Servicio', en: 'Service' },
  'settings.ai_free_tier':  { es: 'tiene capa gratuita', en: 'has a free tier' },
  'settings.ai_get_key':    { es: 'Conseguir una clave', en: 'Get a key' },
  'settings.ai_model':      { es: 'Modelo', en: 'Model' },
  'settings.ai_model_help': {
    es: 'Se puede cambiar: los servicios retiran nombres cada pocos meses.',
    en: 'Editable: services retire model names every few months.'
  },
  'settings.ai_address':    { es: 'Dirección del servidor', en: 'Server address' },
  'settings.ai_address_help': {
    es: 'La base de la API, por ejemplo https://openrouter.ai/api/v1 o http://localhost:11434/v1 si lo tienes en tu equipo.',
    en: 'The API base, e.g. https://openrouter.ai/api/v1, or http://localhost:11434/v1 if you run it yourself.'
  },
  'settings.ai_key_saved':  { es: 'Hay una clave guardada.', en: 'A key is saved.' },
  'settings.ai_key_replace':{ es: 'Escribe otra para reemplazarla', en: 'Type another one to replace it' },
  'settings.ai_key_clear':  { es: 'Borrar la clave', en: 'Remove key' },
  'settings.ai_test':       { es: 'Probar', en: 'Test' },
  'settings.ai_testing':    { es: 'Probando…', en: 'Testing…' },
  'settings.ai_test_ok':    { es: 'Funciona. Ha contestado: ', en: 'It works. It replied: ' },
  'settings.ai_test_fail':  { es: 'No funciona: ', en: "Doesn't work: " },

  'settings.recap_ai_warning': {
    es: 'Al pedir un resumen mejorado, el texto de ese capítulo se envía al servicio que hayas elegido.',
    en: 'Asking for a better recap sends that chapter’s text to the service you picked.'
  },
  'settings.ai_key_encrypted': {
    es: 'La clave se guarda cifrada con el almacén de credenciales de este equipo. Eso impide leerla si tu biblioteca se copia a otro ordenador o se sincroniza a la nube; no te protege de un programa que ya corra con tu usuario en este.',
    en: 'The key is encrypted using this computer’s credential store. That stops it being read if your library is copied elsewhere or synced to the cloud; it does not protect you from a program already running as you on this machine.'
  },
  'settings.ai_key_plain': {
    es: 'Este sistema no ofrece almacén de credenciales, así que la clave se guarda sin cifrar junto a tu biblioteca: quien tenga acceso a esa carpeta puede leerla, y viaja con ella si la sincronizas.',
    en: 'This system offers no credential store, so the key is saved unencrypted next to your library: anyone with access to that folder can read it, and it travels with it if you sync.'
  },

  'settings.watching':       { es: 'Búsquedas vigiladas', en: 'Watched searches' },
  'settings.watching_desc':  {
    es: 'Escribe lo que te gusta y la app te avisará cuando aparezca algo así. No trae lo más nuevo, que suele quedarse a medias: espera a que una obra tenga lectores y recorrido.',
    en: "Describe what you like and the app will bring it when it shows up. It doesn't fetch the newest — those tend to get abandoned — it waits until a work has readers and substance."
  },
  'settings.watching_placeholder': { es: 'Naruto time travel, self-insert…', en: 'Naruto time travel, self-insert…' },
  'settings.watching_add':   { es: 'Vigilar', en: 'Watch' },
  'settings.watching_remove': { es: 'Dejar de vigilar', en: 'Stop watching' },
  'settings.watching_threshold': {
    es: 'Desde {kudos} kudos y {palabras} palabras',
    en: 'From {kudos} kudos and {palabras} words'
  },
  'settings.watching_chapters':  { es: 'desde {n} capítulos', en: 'from {n} chapters' },
  'settings.watching_only_done': { es: 'sólo terminadas', en: 'complete only' },

  'settings.watching_bar':   { es: 'Listón', en: 'Bar' },
  'settings.watching_bar_summary': {
    es: 'Entrará lo que tenga {kudos} kudos y {palabras} palabras o más.',
    en: 'Anything with {kudos} kudos and {palabras} words or more will come in.'
  },
  'settings.watching_bar_why': {
    es: 'No se vigila lo que se publica, sino lo que se gradúa. Una obra recién publicada tiene cero kudos, un capítulo y muchas papeletas de quedarse abandonada en el tercero: el listón es lo que convierte una manguera en una selección.',
    en: "This doesn't watch what gets published, but what earns its place. A brand-new work has zero kudos, one chapter and every chance of being abandoned by the third: the bar is what turns a firehose into a selection."
  },
  'settings.watching_any':   { es: 'cualquiera', en: 'any' },
  'settings.watching_kudos': { es: 'Kudos', en: 'Kudos' },
  'settings.watching_kudos_help': {
    es: 'Lo que más dice si alguien más la ha leído hasta el final.',
    en: 'The clearest sign that someone else read it to the end.'
  },
  'settings.watching_words': { es: 'Palabras', en: 'Words' },
  'settings.watching_words_help': {
    es: 'Deja fuera lo que se abandonó en el primer capítulo.',
    en: 'Leaves out what was abandoned after chapter one.'
  },
  'settings.watching_chapters_label': { es: 'Capítulos', en: 'Chapters' },
  'settings.watching_only_done_help': {
    es: 'Las obras cuyo sitio no publica ese dato entran igual: descartarlas sería descartar por no haber mirado.',
    en: "Works whose site doesn't publish that field still come in: dropping them would mean dropping them for not having looked."
  },

  'settings.storage':        { es: 'Almacenamiento', en: 'Storage' },
  'settings.storage_mobile': {
    es: 'La carpeta se cambia y se abre desde el equipo que sirve la biblioteca.',
    en: 'The folder is changed and opened from the computer serving the library.'
  },
  'settings.storage_desc':   { es: 'Si eliges una carpeta dentro de Google Drive u otro servicio que ya sincronices, tendrás la misma biblioteca en todos tus equipos.', en: 'Pick a folder inside Google Drive or any service you already sync, and the same library follows you across machines.' },
  'settings.custom_location': { es: 'Ubicación personalizada', en: 'Custom location' },
  'settings.default_location': { es: 'Ubicación por defecto', en: 'Default location' },
  'settings.change_folder':  { es: 'Cambiar de carpeta', en: 'Change folder' },
  'settings.open_folder':    { es: 'Abrir', en: 'Open' },
  'settings.moving':         { es: 'Moviendo…', en: 'Moving…' },
  'reader.chapters':         { es: 'Capítulos', en: 'Chapters' },
  'reader.search_placeholder': { es: 'Buscar un nombre o una frase en lo leído…', en: 'Find a name or a phrase in what you have read…' },
  'reader.search_all':       { es: 'Buscar en toda la obra (puede destripar)', en: 'Search the whole work (may spoil)' },
  'reader.searching':        { es: 'Buscando…', en: 'Searching…' },
  'reader.search_failed':    { es: 'No se pudo buscar.', en: 'Could not search.' },
  'reader.search_found':     { es: 'Sale en {n} {n:capítulo|capítulos} de {revisados} {revisados:mirado|mirados}', en: 'Found in {n} {n:chapter|chapters} of {revisados} checked' },
  'reader.search_none':      { es: 'No sale en {revisados} {revisados:capítulo mirado|capítulos mirados}', en: 'Not found in {revisados} {revisados:chapter|chapters} checked' },
  'reader.search_chapter':   { es: 'Capítulo {n} · {veces} {veces:vez|veces}', en: 'Chapter {n} · {veces} {veces:time|times}' },
  'reader.search_more':      { es: 'Y en {n} {n:capítulo|capítulos} más', en: 'And in {n} more {n:chapter|chapters}' },
  'reader.close_toc':        { es: 'Cerrar el índice', en: 'Close the table of contents' },
  'reader.toc_count':        { es: '{i} / {n} capítulos', en: '{i} / {n} chapters' },
  'reader.downloaded_count': { es: '{n} descargados', en: '{n} downloaded' },
  'reader.prev':             { es: 'Anterior', en: 'Previous' },
  'reader.next':             { es: 'Siguiente', en: 'Next' },
};
