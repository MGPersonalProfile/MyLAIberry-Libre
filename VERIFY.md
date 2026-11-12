🇪🇸 [Leer en español](VERIFICAR.md)

# Verifying the MyLAIberry installer

Use the `.exe` and `SHA256SUMS.txt` from **the same Release** of the `OWNER/REPO` repository.

## Check the downloaded file

Install [GitHub CLI](https://cli.github.com/) and sign in with `gh auth login` if it asks you to. In PowerShell, inside the folder where you downloaded the two files:

```powershell
gh attestation verify .\MyLAIberry-Setup-VERSION.exe --repo OWNER/REPO
(Get-FileHash .\MyLAIberry-Setup-VERSION.exe -Algorithm SHA256).Hash.ToLower()
Get-Content .\SHA256SUMS.txt
```

Replace `VERSION` with the tag number without the `v`. The first command verifies the signature of GitHub's attestation and checks that its fingerprint matches **that file** and **that repository**. The second calculates the SHA-256 fingerprint of what you have on your disk, in lowercase as in `SHA256SUMS.txt` (plain `Get-FileHash` writes it in uppercase): it must be the same string that appears next to the file name. With Git Bash, `sha256sum --check SHA256SUMS.txt` is enough. If either command fails or the strings differ, do not run that installer.

`SHA256SUMS.txt` and the attestation cover only the installer. `latest.yml` (the updater's metadata file) and the `.blockmap` travel in the same Release without attestation.

The attestation lets you check that GitHub Actions declared that `.exe` as a product of the build workflow of `OWNER/REPO`, tied to a commit. The workflow refuses to build if the commit it is launched from is not the tag's commit, so the attestation's commit is the commit of the Release's tag. Look at the commit shown by `gh attestation verify` to check which code was built. The SHA-256 lets you detect whether the downloaded file changed relative to the published listing. Since the fingerprint listing is downloaded from the Release itself, **on its own it is not an independent signature**.

These checks **do not prove that the code is free of bugs or unwanted behavior**. Nor do they prove that someone else will get an identical `.exe` when building: the NSIS installer is not presented here as bit-for-bit reproducible. The attestation states where the published file came from; to judge what the application does, you have to read the code and, if you wish, build it.

## Build the code yourself

On Windows, install Node.js 22 (the workflow uses the latest 22.x of the day of the build and records it in its log), Git and the tools needed to build Electron's native dependencies if npm asks for them. Download the code at the Release's tag and, from the project root:

```powershell
npm ci
npm ci --prefix frontend
npm run avisos
npm run build:frontend
npx electron-builder --win nsis --publish never --config.publish.provider=generic --config.publish.url=https://example.invalid --config.publish.channel=latest --config.nsis.artifactName='MyLAIberry-Setup-${version}.exe'
```

`build:frontend` runs `scripts/preparar-modelo.js`, which downloads the model the app uses. The installer and `latest.yml` end up in `dist/`. The `--publish never` option prevents publishing from your PC; the `example.invalid` address only serves so that electron-builder generates the update metadata file. Building it yourself lets you inspect and run the code you downloaded, although its SHA-256 will probably differ from the Release's because of variations in the NSIS build.

The public edition's update button reads the latest GitHub Release, downloads its installer and runs it only if the size and SHA-512 listed in `latest.yml` match. That metadata file travels alongside the installer from the same Release; it does not replace the provenance check above.
