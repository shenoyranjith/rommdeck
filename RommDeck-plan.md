---
name: RommDeck
overview: 'RomM ↔ RetroDECK platform (ES-DE frontend) on Linux desktop. v0.1.1: Target clarity + drop Android (use Argosy). v0.2.0: standalone sync, multi-save, play sessions. macOS/Windows deferred.'
todos:
  - id: packaging-linux
    content: 'Linux AppImage via GitHub Actions + ROMMDECK_APP_ROOT/syncd bundle'
    status: completed
  - id: packaging-desktop-later
    content: 'macOS/Windows installers — deferred'
    status: cancelled
  - id: target-clarity
    content: 'Target UX — RetroDECK as platform, ES-DE as frontend; ES-DE home; Settings copy'
    status: completed
  - id: android-app
    content: 'Android client — cancelled; recommend Argosy (rommapp/argosy-launcher) instead'
    status: cancelled
  - id: standalone-sync
    content: 'Standalone emulator save paths — Dolphin, PCSX2, PPSSPP, … via platform-emulator-map'
    status: pending
  - id: multi-save
    content: 'Multi-save / .m3u directory ROMs, zip-aware content_hash for negotiate'
    status: pending
  - id: play-sessions
    content: 'Play-session ingest on sync completeSession'
    status: pending
  - id: desktop-platforms
    content: 'Desktop on macOS and Windows — Compose Desktop builds, per-OS sync daemon/service'
    status: pending
isProject: false
---
# RommDeck: RomM ↔ RetroDECK (ES-DE frontend)

Desktop bridge between **[RomM](https://github.com/rommapp/romm)** and a local emulation library.

| Layer | Role |
| --- | --- |
| **[RetroDECK](https://retrodeck.net/)** | Supported **platform** — known ROM/save/state/media layout; auto-detected on Linux via `retrodeck.json` |
| **[ES-DE](https://www.es-de.org/)** | Supported **frontend** — `gamelist.xml` + `downloaded_media` (launcher only; does not install emulators) |
| **Other setups** (EmuDeck, plain ES-DE, custom) | Supported via **Settings → Target** — point at the same kind of folders |

**Android:** not in scope. Use **[Argosy](https://github.com/rommapp/argosy-launcher)** (official RomM Android client) for phones/handhelds.

RommDeck does not install emulators or configure cores. EmuDeck-style scripts own that; RommDeck needs library folders.

Save sync reference: [romm-tender](https://github.com/danielcopper/romm-tender).

---

## Done (v0.1.0)

- **RomM library** browse/download, ES-DE gamelist + media
- **Save/state sync** (Device Sync Protocol) + Linux `rommdeck-syncd`
- **Path resolution** ([`JvmPlayPathResolver.kt`](src/shared/src/jvmMain/kotlin/dev/rommdeck/shared/play/JvmPlayPathResolver.kt)):
  - RetroDECK via `retrodeck.json` (Linux, when Target paths empty)
  - Manual Target paths for any layout (EmuDeck, plain ES-DE, custom)
  - Heuristic plain-ES-DE auto-detect exists as a fallback (not the product focus)
- **ES-DE frontend layout** for gamelist + media ([`EsdePaths.kt`](src/shared/src/commonMain/kotlin/dev/rommdeck/shared/esde/EsdePaths.kt))
- **Linux AppImage** packaging + syncd version stamp / startup refresh

## Done (v0.1.1)

- **Target clarity** — RetroDECK platform / ES-DE frontend framing, Settings copy, explicit **ES-DE home**
- **Android client dropped** — recommend [Argosy](https://github.com/rommapp/argosy-launcher); JVM-only KMP build

Known gaps / deferred:

- Plain-ES-DE auto-detect is lightly tested (acceptable as a fallback, not a supported platform)
- macOS/Windows desktop app not shipped (deferred)

---

## v0.2.0 (planned)

Suggested order (desktop sync breadth):

### 1. Standalone sync

Extend save/state sync beyond RetroArch-default layouts on desktop.

- Per-emulator path rules in `platform-emulator-map.json` (`dolphin`, `pcsx2`, `ppsspp`, …)
- Keep the README [Platform / emulator save status](README.md#platform--emulator-save-status) table updated as support lands

### 2. Multi-save

- Multi-save directories, `.m3u` set ROMs, zip-aware `content_hash`

### 3. Play sessions

- Ingest play sessions on sync `completeSession`

### Later

- Desktop on macOS / Windows (Compose + launchd / Task Scheduler)
- macOS `.dmg` / Windows `.msi` packaging

---

## Stack

| Piece | Role |
| --- | --- |
| `src/shared` | KMP library — RomM client, downloads, SQLite index, ES-DE writer, sync engine, path resolution |
| `src/apps/desktop` | Compose Desktop app (**Linux** in v0.1.1) |
| `src/apps/syncd` | Background sync JVM sidecar |

`shared/commonMain` is the cross-platform core; desktop and syncd add UI and OS services.

User docs: [`README.md`](README.md). Developer docs: [`src/README.md`](src/README.md).
