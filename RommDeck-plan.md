---
name: RommDeck Desktop Bridge
overview: 'RomM ↔ local play target bridge. v0.1.0 ships Linux + RetroDECK + RetroArch sync. v0.2.0 adds ES-DE without RetroDECK, packaging, Android, broader sync, and play sessions.'
todos:
  - id: esde-without-retrodeck
    content: 'ES-DE support without RetroDECK — configurable ROM/save/state roots, no retrodeck.json requirement'
    status: pending
  - id: packaging
    content: 'Production packaging — electron-builder GUI, fixed syncd install prefix (ROMMDECK_APP_ROOT)'
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
# RommDeck: RomM ↔ local play

## v0.1.0 (current)

Linux desktop app targeting **RetroDECK** + **RomM 5.x**.

- Library browse/download, ES-DE metadata, download queue
- RetroArch battery saves + save states (Device Sync Protocol)
- Auto-sync daemon (systemd user service)
- Electron GUI, shared TypeScript core, MIT license

Save sync reference: [romm-tender](https://github.com/danielcopper/romm-tender).

---

## v0.2.0 (planned)

All items ship in **v0.2.0**, in this order:

### 1. ES-DE without RetroDECK

Run against a plain **ES-DE** tree — not only RetroDECK Flatpak.

- Configurable ROM / save / state roots without `retrodeck.json`
- ES-DE gamelist + media paths from user config or ES-DE conventions
- Settings UX for non-RetroDECK layouts
- Abstract path layer in core (foundation for packaging, Android, standalone sync)

### 2. Packaging

End-user installs without cloning the dev repo.

- `electron-builder` — packaged GUI (AppImage / deb)
- Production `rommdeck-syncd` install with fixed prefix (`ROMMDECK_APP_ROOT`)
- Build on existing `install-daemon.ts`, `deploy-syncd.sh`, `install-syncd-local.sh`

### 3. Android app

Mobile client on the same RomM + sync model.

- RomM library browse and download
- Save/state sync on Android
- Shared protocol/core where feasible; platform-specific UI and background sync

### 4. Standalone sync

Extend save/state sync beyond RetroArch-default platforms.

- Per-emulator path rules in `platform-emulator-map.json` (`dolphin`, `pcsx2`, `ppsspp`, …)
- Discovery + negotiate for standalone save layouts on supported platforms

### 5. Multi-save

Edge cases for complex ROM layouts.

- Multi-save directories
- `.m3u` set ROMs
- Zip-aware `content_hash` in negotiate payload

### 6. Play sessions

- Ingest play sessions on `POST /api/sync/sessions/{id}/complete` (currently empty `play_sessions`)

---

## Stack (v0.1.0)

| Piece | Role |
| --- | --- |
| `packages/core` | RomM client, downloads, SQLite index, ES-DE writer, sync engine |
| `packages/gui` | Electron + React (Linux) |
| `packages/syncd` | Background sync CLI + systemd unit |

v0.2.0 adds packaging targets and a new Android package; core remains the shared layer.

User docs: [`README.md`](README.md).
