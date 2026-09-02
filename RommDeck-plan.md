---
name: RommDeck
overview: 'Cross-platform RomM ↔ ES-DE bridge. v0.1.0 ships Linux desktop + RetroDECK integration. v0.2.0 adds plain ES-DE targets, macOS/Windows/Android, packaging, broader sync, and play sessions.'
todos:
  - id: plain-esde
    content: 'Plain ES-DE installs — first-class manual ROM/save/state roots, ES-DE path conventions without RetroDECK'
    status: pending
  - id: desktop-platforms
    content: 'Desktop on macOS and Windows — Compose Desktop builds, per-OS sync daemon/service'
    status: pending
  - id: packaging
    content: 'Production packaging — installable desktop app + fixed syncd prefix (ROMMDECK_APP_ROOT, ROMMDECK_SYNCD_DIST)'
    status: pending
  - id: android-app
    content: 'Android client — RomM library, downloads, save sync on mobile'
    status: pending
  - id: standalone-sync
    content: 'Standalone emulator save paths — Dolphin, PCSX2, PPSSPP, … via platform-emulator-map'
    status: pending
  - id: multi-save
    content: 'Multi-save / .m3u directory ROMs, zip-aware content_hash for negotiate'
    status: pending
  - id: play-sessions
    content: 'Play-session ingest on sync completeSession'
    status: pending
isProject: false
---
# RommDeck: RomM ↔ ES-DE

Cross-platform bridge between **[RomM](https://github.com/rommapp/romm)** and **[ES-DE](https://www.es-de.org/)** — download ROMs, sync gamelist metadata and media, and keep saves/states in sync. **[RetroDECK](https://retrodeck.net/)** is a supported ES-DE distribution (auto-detected on Linux); the product target is ES-DE generally, not RetroDECK alone.

## v0.1.0 (current)

**Linux desktop** + **RomM 5.x** + **ES-DE** (RetroDECK auto-detection on Linux).

- Library browse/download, ES-DE `gamelist.xml` + media, download queue
- RetroArch battery saves + save states (Device Sync Protocol)
- Auto-sync daemon on Linux (systemd user service)
- Manual Target paths for ROM / save / state folders
- **Kotlin Multiplatform** + **Compose Desktop**, shared JVM library, MIT license

Save sync reference: [romm-tender](https://github.com/danielcopper/romm-tender).

---

## v0.2.0 (planned)

All items ship in **v0.2.0**, in this order:

### 1. Plain ES-DE (non-RetroDECK)

First-class support for ES-DE installs that are not RetroDECK.

- Discover or configure ROM / save / state roots without `retrodeck.json`
- ES-DE gamelist + media paths from user config or ES-DE conventions
- Settings UX polished for arbitrary ES-DE directory layouts
- Path abstraction in `shared` (foundation for multi-platform and standalone sync)

### 2. Desktop on macOS and Windows

Same RomM ↔ ES-DE feature set on additional desktop OSes.

- Compose Desktop builds for macOS and Windows
- Background sync via launchd / scheduled task (building on existing `InstallSyncDaemon` hooks)
- Platform-specific config and data dirs

### 3. Packaging

End-user installs without cloning the dev repo.

- Installable desktop app per OS (AppImage / deb / macOS / Windows — TBD)
- Production `rommdeck-syncd` with fixed prefix (`ROMMDECK_APP_ROOT`, `ROMMDECK_SYNCD_DIST`)
- Build on Gradle `:apps:syncd:installDist` and in-app daemon installer

### 4. Android app

Mobile client on the same RomM + sync model.

- RomM library browse and download
- Save/state sync on Android
- Shared `commonMain` protocol/core; Jetpack Compose UI and platform background sync

### 5. Standalone sync

Extend save/state sync beyond RetroArch-default platforms.

- Per-emulator path rules in `platform-emulator-map.json` (`dolphin`, `pcsx2`, `ppsspp`, …)
- Discovery + negotiate for standalone save layouts on supported platforms

### 6. Multi-save

Edge cases for complex ROM layouts.

- Multi-save directories
- `.m3u` set ROMs
- Zip-aware `content_hash` in negotiate payload

### 7. Play sessions

- Ingest play sessions on `POST /api/sync/sessions/{id}/complete` (currently empty `play_sessions`)

---

## Stack

| Piece | Role |
| --- | --- |
| `src/shared` | KMP library — RomM client, downloads, SQLite index, ES-DE writer, sync engine |
| `src/apps/desktop` | Compose Desktop app (**Linux** in v0.1.0) |
| `src/apps/syncd` | Background sync JVM sidecar |
| `src/apps/android` | Jetpack Compose stub → full client in v0.2.0 |

`shared/commonMain` is the cross-platform core; each app adds UI and OS-specific services (paths, background sync, packaging).

User docs: [`README.md`](README.md). Developer docs: [`src/README.md`](src/README.md).
