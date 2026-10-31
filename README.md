🇪🇸 [Leer en español](README.es.md)

# MyLAIberry

A fanfic and web novel reader for Windows that keeps your stories **on your computer**: paste the link, the app
downloads the chapters, cleans up the formatting, and you read them offline, with translation included.

> Made with the help of AI. All the code is right here for anyone to inspect, and the `.exe` in the
> [Releases](../../releases) is built by GitHub from this code: how to check it is in [VERIFY.md](VERIFY.md).

## What it does

- **Imports by link** from AO3, FanFiction.net, RoyalRoad, Webnovel, WeTriedTLs, Project Gutenberg,
  SpaceBattles, SufficientVelocity, QuestionableQuesting and almost any site with chapters. It also imports EPUB,
  PDF and AO3 HTML files from your disk (the format many people share fics in on Google Drive).
- **Reader** with themes, font size, bookmarks, per-chapter progress, a table of contents, search within the work, and
  read-aloud with the Windows voices.
- **Translation** of each chapter into your language, free and with no account; each chapter is translated once and then saved.
- **Library** with shelves, "My list", filters, and notifications when a work you follow publishes new chapters.
- **Discoveries**: searches it watches for you and authors you follow.
- **Export to EPUB** any work for your e-reader.
- **A chapter or the whole work as MP3** with neural voices (optional). The voices do not come in the
  installer: the app downloads them the first time you ask for it, with a button (≈ 600 MB; see "Voices" below).
- **Read from your phone** on your home network (off by default; turn it on in Settings).
- **Daily backups** of your library, and moving it to another folder or drive.
- **Optional assistant** that knows your library, searches for works and answers without spoiling what you haven't read yet.
  It works with [DeepSeek](https://platform.deepseek.com) and with **your** key (Settings > Assistant); it is paid for from your
  balance there, cents per conversation. Without a key, the rest of the app works just the same.

## Install

The user manual, with screenshots, is at [docs/MyLAIberry-Manual-en.pdf](docs/MyLAIberry-Manual-en.pdf).

1. Download `MyLAIberry-Setup-<version>.exe` from the latest [Release](../../releases/latest).
2. Open it. Because the installer is not signed with a paid certificate, Windows may warn "Windows protected your
   PC": click **More info** and then **Run anyway**. If you would rather first check that the file
   is the one GitHub built, follow [VERIFY.md](VERIFY.md).
3. It installs for your user (no administrator permissions) as **MyLAIberry Libre**, with a shortcut on the
   desktop and in the Start menu. Uninstall it from Settings > Apps > MyLAIberry Libre.

The installer from the Releases knows which repository it comes from: the app tells you in Settings > Version when there is a new one and
installs it with a button, first checking the installer's size and SHA-512 fingerprint. A copy that you build yourself without
the `repositorio` field (GitHub "owner/name") in `package.json` does not look for new versions.

## What leaves your computer

Your library, your settings and your keys stay on your machine. **There is no telemetry and there are no MyLAIberry accounts.** The app
only connects to:

| Where to | What for |
|---|---|
| The sites you import from | Downloading the chapters you ask for, and checking whether there are new chapters of what you follow |
| AO3, FanFiction.net, RoyalRoad, Webnovel, WeTriedTLs, Wattpad, Project Gutenberg | The searches you run or have it watch |
| Google Translate | Translating chapters (no account) |
| FicHub | Downloading works from forums and the AO3 copy when AO3 is down |
| AniList, Fandom and Bing Images | The background images for each fandom |
| Open Library, archive.org, Standard Ebooks | Telling you where a book you are looking for can be found legally |
| DeepSeek | Only if you enter your assistant key |
| DuckDuckGo, Bing and Reddit | Only when the assistant searches the internet for you |
| Google Gemini, Anthropic or the compatible service you choose | Only if you turn on improved summaries with your key |
| ntfy.sh | Only if you set up a channel for notifications to your phone |
| api.github.com, and github.com with its download servers (`*.githubusercontent.com`) | Checking whether there is a new version and, if you install it, downloading it |
| github.com and huggingface.co, with their download servers | Only if you install the MP3 voices: Piper, ffmpeg and the voices, from their authors |

API keys are stored encrypted with the Windows credential store and are never sent anywhere other than their
service.

## What it doesn't do

It does not unlock paid chapters (Webnovel's are skipped and it tells you how many there are; a paywall page is not saved
as a chapter), it does not remove DRM, and it does not publish or share anything you save: what you download is for you to read.

## Voices (optional)

The "Install voices" button in the reader downloads, with pinned versions checked by SHA-256
(`electron/voces-instalar.js`):

| What | From where | License |
|---|---|---|
| Piper 2023.11.14-2 | github.com/rhasspy/piper | MIT (bundles espeak-ng, GPL-3.0) |
| ffmpeg 9.0.2 "essentials" | github.com/GyanD/codexffmpeg | GPL-3.0 |
| es_MX-claude-high | huggingface.co/rhasspy/piper-voices | Data Apache-2.0 |
| es_ES-sharvard-medium | same | Data CC BY 3.0; fine-tuned from lessac |
| es_ES-davefx-medium, en_US-joe-medium | same | Data CC0; fine-tuned from lessac |
| en_US-lessac-medium | same | Lessac corpus (Blizzard 2013): research-only license, no commercial use |
| en_US-hfc_female-medium, en_US-hfc_male-medium | same | Hi-Fi Captain, CC BY-NC-SA 4.0; fine-tuned from lessac |

MyLAIberry does not redistribute them: they go from their authors to your machine. **Use them for yourself and non-commercially**; if you do
something commercial based on this code, change the voices. Each voice's card is next to its model on
Hugging Face.

## Build it yourself

You need [Node.js](https://nodejs.org) 22 (the version the Releases are built with) and Windows.

```
npm ci
npm ci --prefix frontend
npm run dist
```

`npm run dist` downloads the classifier model (a pinned revision, checked by SHA-256: `scripts/preparar-modelo.js`),
generates `THIRD_PARTY_NOTICES.txt`, builds the interface and leaves the installer in `dist/`. To try it without installing: `npm run app`.

## License

[GNU AGPL-3.0 or later](LICENSE). You can use, study, change and distribute MyLAIberry, but whatever you make from
this code —even if you only offer it as an internet service— must be published under the same license and with its
source code. The licenses of the third-party components it includes are in `THIRD_PARTY_NOTICES.txt`, next to the installed
program.

The stories you save belong to their authors.
