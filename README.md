# MyLAIberry

Un lector de fanfics y novelas web para Windows que guarda las historias **en tu ordenador**: pegas el enlace, la app
baja los capítulos, los deja con formato limpio y los lees sin conexión, con traducción incluida.

> Hecho con ayuda de IA. El código está aquí entero para que cualquiera pueda mirarlo, y el `.exe` de las
> [Releases](../../releases) lo compila GitHub a partir de este código: cómo comprobarlo, en [VERIFICAR.md](VERIFICAR.md).

## Qué hace

- **Importa por enlace** desde AO3, FanFiction.net, RoyalRoad, Webnovel, WeTriedTLs, Project Gutenberg,
  SpaceBattles, SufficientVelocity, QuestionableQuesting y casi cualquier web con capítulos. También EPUB y PDF de tu
  disco.
- **Lector** con temas, tamaño de letra, marcapáginas, progreso por capítulo, índice, búsqueda dentro de la obra y
  lectura en voz alta con las voces de Windows.
- **Traducción** de cada capítulo a tu idioma, gratis y sin cuenta; cada capítulo se traduce una vez y queda guardado.
- **Biblioteca** con estanterías, «Mi lista», filtros, y avisos cuando una obra que sigues publica capítulos nuevos.
- **Descubrimientos**: búsquedas que vigila por ti y autores que sigues.
- **Exportar a EPUB** cualquier obra para tu e-reader.
- **Un capítulo o la obra entera en MP3** con voces neuronales (opcional). Las voces no vienen en el
  instalador: la app las baja la primera vez que lo pides, con un botón (≈ 600 MB; ver «Voces» abajo).
- **Leer desde el móvil** en tu red de casa (apagado de fábrica; se activa en Ajustes).
- **Copias de seguridad** diarias de tu biblioteca, y moverla a otra carpeta o disco.
- **Asistente opcional** que conoce tu biblioteca, busca obras y responde sin destripar lo que aún no has leído.
  Funciona con [DeepSeek](https://platform.deepseek.com) y con **tu** clave (Ajustes > Asistente); se paga con tu
  saldo de allí, céntimos por conversación. Sin clave, el resto de la app funciona igual.

## Instalar

El manual de uso, con capturas, está en [docs/MyLAIberry-Manual.pdf](docs/MyLAIberry-Manual.pdf).

1. Baja `MyLAIberry-Setup-<versión>.exe` de la última [Release](../../releases/latest).
2. Ábrelo. Como el instalador no está firmado con un certificado de pago, Windows puede avisar con «Windows protegió
   su PC»: pulsa **Más información** y luego **Ejecutar de todas formas**. Si prefieres comprobar antes que el fichero
   es el que compiló GitHub, sigue [VERIFICAR.md](VERIFICAR.md).
3. Se instala para tu usuario (sin permisos de administrador) como **MyLAIberry Libre**, con acceso directo en el
   escritorio y en el menú Inicio. Se desinstala desde Configuración > Aplicaciones > MyLAIberry Libre.

El instalador de las Releases sabe de qué repositorio sale: la app avisa en Ajustes > Versión cuando hay una nueva y la
instala con un botón, comprobando antes el tamaño y la huella SHA-512 del instalador. Una copia que compiles tú sin
el campo `repositorio` («dueño/nombre» de GitHub) en `package.json` no busca versiones.

## Qué sale de tu ordenador

Tu biblioteca, tus ajustes y tus claves se quedan en tu equipo. **No hay telemetría ni cuentas de MyLAIberry.** La app
sólo se conecta a:

| A dónde | Para qué |
|---|---|
| Las webs de las que importas | Bajar los capítulos que pides, y mirar si hay capítulos nuevos de lo que sigues |
| AO3, FanFiction.net, RoyalRoad, Webnovel, WeTriedTLs, Wattpad, Project Gutenberg | Las búsquedas que haces o que vigilas |
| Google Translate | Traducir capítulos (sin cuenta) |
| FicHub | Bajar obras de foros y la copia de AO3 cuando AO3 está caído |
| AniList, Fandom y Bing Imágenes | Las imágenes de fondo de cada fandom |
| Open Library, archive.org, Standard Ebooks | Decirte dónde está legalmente un libro que buscas |
| DeepSeek | Sólo si pones tu clave del asistente |
| DuckDuckGo, Bing y Reddit | Sólo cuando el asistente busca en internet por ti |
| Google Gemini, Anthropic o el servicio compatible que elijas | Sólo si activas los resúmenes mejorados con tu clave |
| ntfy.sh | Sólo si configuras un canal de avisos al móvil |
| api.github.com, y github.com con sus servidores de descarga (`*.githubusercontent.com`) | Ver si hay versión nueva y, si la instalas, bajarla |
| github.com y huggingface.co, con sus servidores de descarga | Sólo si instalas las voces del MP3: Piper, ffmpeg y las voces, de sus autores |

Las claves de API se guardan cifradas con el almacén de credenciales de Windows y nunca se envían a otro sitio que su
servicio.

## Qué no hace

No desbloquea capítulos de pago (los de Webnovel se saltan y se dice cuántos son; una página de pago no se guarda
como capítulo), no quita DRM y no publica ni comparte nada de lo que guardas: lo que bajas es para que lo leas tú.

## Voces (opcional)

El botón «Instalar las voces» del lector baja, con versiones fijas y comprobadas por SHA-256
(`electron/voces-instalar.js`):

| Qué | De dónde | Licencia |
|---|---|---|
| Piper 2023.11.14-2 | github.com/rhasspy/piper | MIT (trae espeak-ng, GPL-3.0) |
| ffmpeg 9.0.2 «essentials» | github.com/GyanD/codexffmpeg | GPL-3.0 |
| es_MX-claude-high | huggingface.co/rhasspy/piper-voices | Datos Apache-2.0 |
| es_ES-sharvard-medium | ídem | Datos CC BY 3.0; ajustada sobre lessac |
| es_ES-davefx-medium, en_US-joe-medium | ídem | Datos CC0; ajustadas sobre lessac |
| en_US-lessac-medium | ídem | Corpus Lessac (Blizzard 2013): licencia sólo de investigación, sin uso comercial |
| en_US-hfc_female-medium, en_US-hfc_male-medium | ídem | Hi-Fi Captain, CC BY-NC-SA 4.0; ajustadas sobre lessac |

MyLAIberry no las redistribuye: van de sus autores a tu equipo. **Úsalas para ti y sin fines comerciales**; si haces
algo comercial a partir de este código, cambia las voces. La tarjeta de cada voz está junto a su modelo en
Hugging Face.

## Compilarlo tú

Hace falta [Node.js](https://nodejs.org) 22 (con la que se compilan las Releases) y Windows.

```
npm ci
npm ci --prefix frontend
npm run dist
```

`npm run dist` baja el modelo del clasificador (una revisión fija, comprobada por SHA-256: `scripts/preparar-modelo.js`),
genera `THIRD_PARTY_NOTICES.txt`, compila la interfaz y deja el instalador en `dist/`. Para probarla sin instalar: `npm run app`.

## Licencia

[GNU AGPL-3.0 o posterior](LICENSE). Puedes usar, estudiar, cambiar y repartir MyLAIberry, pero lo que hagas a partir
de este código —aunque sólo lo ofrezcas como servicio en internet— tiene que publicarse con la misma licencia y con su
código fuente. Las licencias de lo que incluye de terceros están en `THIRD_PARTY_NOTICES.txt`, junto al programa
instalado.

Las historias que guardes son de sus autores.
