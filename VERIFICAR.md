🇬🇧 [Read in English](VERIFY.md)

# Comprobar el instalador de MyLAIberry

Usa el `.exe` y `SHA256SUMS.txt` de **la misma Release** del repositorio `OWNER/REPO`.

## Comprobar el archivo descargado

Instala [GitHub CLI](https://cli.github.com/) e inicia sesión con `gh auth login` si te lo pide. En PowerShell, dentro de la carpeta donde descargaste los dos archivos:

```powershell
gh attestation verify .\MyLAIberry-Setup-VERSION.exe --repo OWNER/REPO
(Get-FileHash .\MyLAIberry-Setup-VERSION.exe -Algorithm SHA256).Hash.ToLower()
Get-Content .\SHA256SUMS.txt
```

Cambia `VERSION` por el número del tag sin la `v`. La primera orden verifica la firma de la atestación de GitHub y comprueba que su huella corresponde a **ese archivo** y a **ese repositorio**. La segunda calcula la huella SHA-256 de lo que tienes en tu disco, en minúsculas como en `SHA256SUMS.txt` (`Get-FileHash` a secas la escribe en mayúsculas): debe ser la misma cadena que figura junto al nombre del archivo. Con Git Bash basta `sha256sum --check SHA256SUMS.txt`. Si alguna orden falla o las cadenas difieren, no ejecutes ese instalador.

`SHA256SUMS.txt` y la atestación cubren sólo el instalador. `latest.yml` (la ficha del actualizador) y el `.blockmap` viajan en la misma Release sin atestar.

La atestación permite comprobar que GitHub Actions declaró ese `.exe` como producto del workflow de compilación de `OWNER/REPO`, asociado a un commit. El workflow se niega a compilar si el commit desde el que se lanza no es el del tag, así que el commit de la atestación es el del tag de la Release. Consulta el commit mostrado por `gh attestation verify` para comprobar qué código se compiló. El SHA-256 permite detectar si el archivo descargado cambió respecto al listado publicado. Como el listado de huellas se descarga de la propia Release, **por sí solo no es una firma independiente**.

Estas comprobaciones **no demuestran que el código carezca de fallos o de comportamiento indeseado**. Tampoco prueban que otra persona obtenga un `.exe` idéntico al compilar: el instalador NSIS no se presenta aquí como reproducible bit a bit. La atestación afirma de dónde salió el archivo publicado; para juzgar qué hace la aplicación hay que leer el código y, si se desea, compilarlo.

## Compilar el código por tu cuenta

En Windows, instala Node.js 22 (el workflow usa la última 22.x del día de la compilación y la escribe en su registro), Git y las herramientas necesarias para compilar dependencias nativas de Electron si npm las pide. Descarga el código del tag de la Release y, desde la raíz del proyecto:

```powershell
npm ci
npm ci --prefix frontend
npm run avisos
npm run build:frontend
npx electron-builder --win nsis --publish never --config.publish.provider=generic --config.publish.url=https://example.invalid --config.nsis.artifactName='MyLAIberry-Setup-${version}.exe'
```

`build:frontend` ejecuta `scripts/preparar-modelo.js`, que descarga el modelo que usa la app. El instalador y `latest.yml` salen en `dist/`. La opción `--publish never` evita publicar desde tu PC; la dirección `example.invalid` sólo sirve para que electron-builder genere la ficha de actualización. Una compilación propia permite inspeccionar y ejecutar el código que has descargado, aunque su SHA-256 probablemente difiera del de la Release por las variaciones de la compilación NSIS.

El botón de actualización de la edición pública lee la última Release de GitHub, descarga su instalador y lo ejecuta sólo si coinciden el tamaño y el SHA-512 que figuran en `latest.yml`. Esa ficha viaja junto al instalador desde la misma Release; no sustituye a la comprobación de procedencia anterior.
