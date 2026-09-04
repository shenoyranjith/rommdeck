---
name: RommDeck
overview: 'RomM ↔ RetroDECK platform (ES-DE frontend) on Linux desktop. v0.2.0 Android: RetroArch+ES-DE, mandatory manual Target paths. Then standalone sync, multi-save, play sessions. macOS/Windows deferred.'
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
    content: 'Android client — RetroArch+ES-DE; mandatory manual Target paths; RomM library, downloads, save sync (v0.2.0 priority)'
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
  - id: desktop-platforms
    content: 'Desktop on macOS and Windows — Compose Desktop builds, per-OS sync daemon/service'
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
  - Explicit **ES-DE home** when ROMs live outside the frontend tree
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

Suggested order (**Android first**):

### 1. Target clarity — done on `v0.2.0` branch

RetroDECK platform / ES-DE frontend framing, Settings copy, **ES-DE home** for official ES-DE layouts.

### 2. Android app (priority)

Mobile client on the same RomM + sync + ES-DE frontend model as desktop, but **no RetroDECK and no path auto-detection**.

**User setup (outside RommDeck):** RetroArch + **ES-DE for Android** — the user installs and wires emulators themselves. RommDeck does not configure RetroArch or ES-DE.

**Target paths are mandatory.** The user must set in Settings → Target:

- **ES-DE home** — where `gamelists/` and media live on the device
- **ROMs folder**
- **Saves folder**
- **States folder**

There is no `retrodeck.json`, no RetroDECK auto-detect, and no `detectEsdeCandidate()` on Android. If any required path is missing, the app should **block** library, downloads, and sync (setup/onboarding until Target is complete).

Today [`apps/android`](src/apps/android) is a stub (`MainActivity` + greeting). Shared stubs: [`AndroidConfigRepository`](src/shared/src/androidMain/kotlin/dev/rommdeck/shared/config/AndroidConfigRepository.kt), [`AndroidPlayPathResolver`](src/shared/src/androidMain/kotlin/dev/rommdeck/shared/play/AndroidPlayPathResolver.kt), [`AndroidAppPaths`](src/shared/src/androidMain/kotlin/dev/rommdeck/shared/paths/AndroidAppPaths.kt).

Suggested slices:

1. **Config + AppPaths** — persist `config.json` on device; implement Android file I/O
2. **Mandatory Target UI** — Settings → Target (required fields, no auto placeholders); gate main nav until configured
3. **Path resolver** — manual paths only → `ResolvedPlayPaths` + ES-DE gamelist/media layout (reuse `resolveEsdeLayout`)
4. **Library + downloads** — RomM browse/download into user’s ROM folder; metadata into ES-DE tree
5. **Save/state sync** — Device Sync Protocol; background via WorkManager (not systemd syncd)
6. **UI shell** — Library, Downloads, Sync, Settings (parity with desktop where applicable)

Use **Storage Access Framework** or documented ES-DE/RetroArch paths where direct paths are awkward on modern Android — still **user-chosen**, never auto-detected.

### 3. Standalone sync

Extend save/state sync beyond RetroArch-default platforms (mainly desktop/RetroDECK).

- Per-emulator path rules in `platform-emulator-map.json` (`dolphin`, `pcsx2`, `ppsspp`, …)

### 4. Multi-save

- Multi-save directories, `.m3u` set ROMs, zip-aware `content_hash`

### 5. Play sessions

- Ingest play sessions on sync `completeSession`

### Later

- Desktop on macOS / Windows (Compose + launchd / Task Scheduler)
- macOS `.dmg` / Windows `.msi` packaging

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
