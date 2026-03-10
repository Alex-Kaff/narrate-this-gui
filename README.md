# narrate-this-gui

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A desktop GUI for the [narrate-this](https://crates.io/crates/narrate-this) SDK. Configure providers, generate narrated videos from text or URLs with background music, captions, and stock or provided background media.

[gui-vid.webm](https://github.com/user-attachments/assets/3145a784-5d68-4c11-82eb-c4e59c2c6660)



https://github.com/user-attachments/assets/c49167fa-5770-48c4-8b32-0aa7198d0a85




Built with [Tauri 2](https://v2.tauri.app/) + TypeScript.

## Prerequisites
- Install from [releases](https://github.com/Alex-Kaff/narrate-this-gui/releases/) or clone source code and build or run dev
- [FFmpeg](https://ffmpeg.org/) available on your `PATH` (see [Installing FFmpeg](#installing-ffmpeg))
- API keys for the providers you want to use (configured in the app):
  - [ElevenLabs](https://elevenlabs.io/) or OpenAI-compatible TTS
  - [Pexels](https://www.pexels.com/api/) (for stock footage)
  - OpenAI-compatible LLM (for text enhancement / keyword extraction)

## Installing FFmpeg

FFmpeg must be on your system `PATH` for video rendering to work.

**Windows** (via [winget](https://learn.microsoft.com/en-us/windows/package-manager/winget/)):
```bash
winget install Gyan.FFmpeg
```

**macOS** (via [Homebrew](https://brew.sh/)):
```bash
brew install ffmpeg
```

**Linux (Debian/Ubuntu):**
```bash
sudo apt install ffmpeg
```

**Linux (Fedora):**
```bash
sudo dnf install ffmpeg
```

Verify the install with `ffmpeg -version`.

## Getting started

```bash
# Clone the repo
git clone https://github.com/Alex-Kaff/narrate-this-gui.git
cd narrate-this-gui

# Install frontend dependencies
npm install

# Run in development mode (hot-reload)
npm run tauri dev
```

## Building for production

```bash
npm run tauri build
```

The installer/binary will be in `src-tauri/target/release/bundle/`.

## Project structure

```
src/                 # Frontend (TypeScript, vanilla DOM)
  main.ts            # App entry, tab routing
  build.ts           # Build & Run tab
  providers.ts       # Provider management tab
  history.ts         # Generation history tab
  types.ts           # Shared type definitions
  styles.css         # Dark-theme styling

src-tauri/           # Backend (Rust)
  src/
    lib.rs           # Tauri commands
    pipeline.rs      # narrate-this SDK integration
    config.rs        # SQLite settings storage
  Cargo.toml
  tauri.conf.json
```

## How it works

The frontend collects your configuration and sends it to the Rust backend via Tauri IPC. The backend builds a [`narrate-this`](https://crates.io/crates/narrate-this) pipeline, runs it, and streams progress events back to the UI. Generated videos are saved to your Videos directory (configurable).

Settings and history are persisted in a local SQLite database in your app data directory.

## License

[MIT](LICENSE)
