---
name: RommDeck
overview: 'Cross-platform RomM ↔ ES-DE bridge. v0.1.0 ships Linux desktop with plain ES-DE + RetroDECK path resolution. v0.2.0 adds packaging, macOS/Windows/Android, ES-DE polish, broader sync, and play sessions.'
todos:
  - id: packaging
    content: 'Production packaging — Linux AppImage via GitHub Actions + ROMMDECK_APP_ROOT/syncd bundle; macOS/Windows installers later'
    status: pending
  - id: desktop-platforms
    content: 'Desktop on macOS and Windows — Compose Desktop builds, per-OS sync daemon/service'
    status: pending
  - id: esde-polish
    content: 'ES-DE polish — tests for ESDE_AUTO, non-standard folder layouts, Settings copy'
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

Cross-platform bridge between **[RomM](https://github.com/rommapp/romm)** and **[ES-DE](https://www.es-de.org/)** — download ROMs, sync gamelist metadata and media, and keep saves/states in sync. **[RetroDECK](https://retrodeck.net/)** is one supported ES-DE distribution (auto-detected on Linux via `retrodeck.json`); the product target is **ES-DE generally**.

## v0.1.0 (current)

**Linux desktop** + **RomM 5.x** + **ES-DE** (plain or RetroDECK).

### Shipped

- Library browse/download, ES-DE `gamelist.xml` + media, download queue
- RetroArch battery saves + save states (Device Sync Protocol)
- Auto-sync daemon on Linux (systemd user service)
- **Plain ES-DE path resolution** ([`JvmPlayPathResolver.kt`](src/shared/src/jvmMain/kotlin/dev/rommdeck/shared/play/JvmPlayPathResolver.kt)):
  - Manual Target paths (ROM / save / state) in Settings
  - **ES-DE auto-detect** when fields are empty — common Linux/macOS/Windows install roots (`~/.local/share/ES-DE`, Flatpak paths, etc.)
  - RetroDECK via `retrodeck.json` when present (Linux priority before ES-DE heuristics)
- **ES-DE layout** for gamelist + media ([`EsdePaths.kt`](src/shared/src/commonMain/kotlin/dev/rommdeck/shared/esde/EsdePaths.kt)) — nested ES-DE under RetroDECK home or plain ES-DE root
- Settings → Target shows resolved source: `esde`, `retrodeck`, `override`, or `unconfigured`
- **Kotlin Multiplatform** + **Compose Desktop**, shared JVM library, MIT license

Save sync reference: [romm-tender](https://github.com/danielcopper/romm-tender).

### Known gaps (not blockers for daily Linux + ES-DE use)

- No automated tests for `detectEsdeCandidate()` / `PathSource.ESDE_AUTO`
- Non-standard ES-DE folder layouts (custom subdir names) may need manual paths
- macOS/Windows **desktop app** not shipped yet (detection code exists in JVM resolver)

---

## v0.2.0 (planned)

Suggested order:

### 1. Packaging

End-user installs without cloning the dev repo.

- **Linux AppImage** (preferred) — `scripts/package-linux-appimage.sh` + [`.github/workflows/package-linux-appimage.yml`](.github/workflows/package-linux-appimage.yml)
- Packaged layout: `$ROMMDECK_APP_ROOT/{bin,lib,syncd}`; app resolves syncd via `ROMMDECK_APP_ROOT` / AppImage `APPDIR` / jpackage detection ([`AppInstallLayout.kt`](src/shared/src/jvmMain/kotlin/dev/rommdeck/shared/paths/AppInstallLayout.kt))
- Syncd install copies a bundled JRE from the app image when enabling auto-sync (no system JDK required)
- macOS `.dmg` / Windows `.msi` via Compose `nativeDistributions` (CI matrix later)

### 2. Desktop on macOS and Windows

Same RomM ↔ ES-DE feature set on additional desktop OSes.

- Compose Desktop builds for macOS and Windows
- Background sync via launchd / scheduled task (building on existing [`InstallSyncDaemon.kt`](src/shared/src/jvmMain/kotlin/dev/rommdeck/shared/sync/InstallSyncDaemon.kt) hooks)
- Platform-specific config and data dirs
- ES-DE auto-detect already has macOS/Windows roots in `detectEsdeCandidate()`

### 3. ES-DE polish

Finish first-class ES-DE story beyond what v0.1.0 already runs.

- Tests for plain ES-DE auto-detect and manual override precedence
- Settings copy/UX: de-emphasize RetroDECK-only wording where ES-DE is primary
- Optional: richer discovery for non-standard folder layouts

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
| `src/shared` | KMP library — RomM client, downloads, SQLite index, ES-DE writer, sync engine, path resolution |
| `src/apps/desktop` | Compose Desktop app (**Linux** in v0.1.0) |
| `src/apps/syncd` | Background sync JVM sidecar |
| `src/apps/android` | Jetpack Compose stub → full client in v0.2.0 |

`shared/commonMain` is the cross-platform core; each app adds UI and OS-specific services (paths, background sync, packaging).

User docs: [`README.md`](README.md). Developer docs: [`src/README.md`](src/README.md).
