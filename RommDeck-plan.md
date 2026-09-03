---
name: RommDeck
overview: 'RomM ↔ RetroDECK platform (ES-DE frontend). v0.1.0 ships Linux AppImage + RetroDECK auto-detect + manual Target paths. v0.2.0: skip macOS/Windows packaging for now; platform/frontend clarity, sync breadth, Android, play sessions.'
todos:
  - id: packaging-linux
    content: 'Linux AppImage via GitHub Actions + ROMMDECK_APP_ROOT/syncd bundle'
    status: completed
  - id: packaging-desktop-later
    content: 'macOS/Windows installers — deferred'
    status: cancelled
  - id: desktop-platforms
    content: 'Desktop on macOS and Windows — Compose Desktop builds, per-OS sync daemon/service'
    status: pending
  - id: target-clarity
    content: 'Target UX — RetroDECK as platform, ES-DE as frontend; Settings copy; manual paths for EmuDeck/custom'
    status: completed
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
# RommDeck: RomM ↔ RetroDECK (ES-DE frontend)

Cross-platform bridge between **[RomM](https://github.com/rommapp/romm)** and a local emulation library.

| Layer | Role |
| --- | --- |
| **[RetroDECK](https://retrodeck.net/)** | Supported **platform** — known ROM/save/state/media layout; auto-detected on Linux via `retrodeck.json` |
| **[ES-DE](https://www.es-de.org/)** | Supported **frontend** — `gamelist.xml` + `downloaded_media` (launcher only; does not install emulators) |
| **Other setups** (EmuDeck, plain ES-DE, custom) | Supported via **Settings → Target** — point at the same kind of folders |

RommDeck does not install emulators or configure cores. EmuDeck-style scripts own that; we only need the folder tree.

## v0.1.0 (current)

**Linux** AppImage + **RomM 5.x** + RetroDECK auto-detect + manual Target paths.

### Shipped

- Library browse/download, ES-DE `gamelist.xml` + media, download queue
- RetroArch battery saves + save states (Device Sync Protocol)
- Auto-sync daemon on Linux (systemd user service)
- **Path resolution** ([`JvmPlayPathResolver.kt`](src/shared/src/jvmMain/kotlin/dev/rommdeck/shared/play/JvmPlayPathResolver.kt)):
  - RetroDECK via `retrodeck.json` (Linux, when Target paths empty)
  - Manual Target paths for any layout (EmuDeck, plain ES-DE, custom)
  - Heuristic plain-ES-DE auto-detect exists as a fallback (not the product focus)
- **ES-DE frontend layout** for gamelist + media ([`EsdePaths.kt`](src/shared/src/commonMain/kotlin/dev/rommdeck/shared/esde/EsdePaths.kt))
- **Linux AppImage** packaging + syncd version stamp / startup refresh
- **Kotlin Multiplatform** + **Compose Desktop**, MIT license

Save sync reference: [romm-tender](https://github.com/danielcopper/romm-tender).

### Known gaps

- Plain-ES-DE auto-detect is lightly tested (acceptable as a fallback, not a supported platform)
- macOS/Windows desktop app not shipped (deferred)

---

## v0.2.0 (planned)

Suggested order (macOS/Windows **packaging skipped for now**):

### 1. Target clarity (was “ES-DE polish”) — done on `v0.2.0` branch

Align product language and Settings with the platform/frontend model.

- Settings → Target: RetroDECK = auto platform; manual paths = any ES-DE-style tree (EmuDeck, etc.)
- Platform map / Sync / sidebar copy updated to match
- Plain-ES-DE heuristics remain best-effort only (`PathSource.ESDE_AUTO`)

### 2. Desktop on macOS and Windows

Same RomM ↔ library feature set on additional OSes (installers can wait).

- Compose Desktop builds
- Background sync via launchd / scheduled task ([`InstallSyncDaemon.kt`](src/shared/src/jvmMain/kotlin/dev/rommdeck/shared/sync/InstallSyncDaemon.kt))
- Platform-specific config and data dirs

### 3. Android app

Mobile client on the same RomM + sync model.

- RomM library browse and download
- Save/state sync on Android
- Shared `commonMain` protocol/core; Jetpack Compose UI and platform background sync

### 4. Standalone sync

Extend save/state sync beyond RetroArch-default platforms.

- Per-emulator path rules in `platform-emulator-map.json` (`dolphin`, `pcsx2`, `ppsspp`, …)
- Discovery + negotiate for standalone save layouts on supported platforms

### 5. Multi-save

- Multi-save directories
- `.m3u` set ROMs
- Zip-aware `content_hash` in negotiate payload

### 6. Play sessions

- Ingest play sessions on `POST /api/sync/sessions/{id}/complete` (currently empty `play_sessions`)

### Later

- macOS `.dmg` / Windows `.msi` packaging (explicitly deferred)

---

## Stack

| Piece | Role |
| --- | --- |
| `src/shared` | KMP library — RomM client, downloads, SQLite index, ES-DE writer, sync engine, path resolution |
| `src/apps/desktop` | Compose Desktop app (**Linux** in v0.1.0) |
| `src/apps/syncd` | Background sync JVM sidecar |
| `src/apps/android` | Jetpack Compose stub → full client in v0.2.0 |

`shared/commonMain` is the cross-platform core; each app adds UI and OS-specific services (paths, background sync, packaging).

User docs: [`README.md`](README.md). Developer docs: [`src/README.md`](src/README.md).
