---
name: RommDeck Desktop Bridge
overview: 'Build a Linux desktop stack (Electron GUI + systemd user daemon, shared Node/TypeScript core) that browses RomM, manages RetroDECK ROM downloads, and keeps saves/states auto-synced in the background. Develop and run on the Linux host with RetroDECK installed.'
todos:
  - id: scaffold
    content: 'Scaffold monorepo: shared core, Electron GUI, sync daemon CLI, config + retrodeck.json detection'
    status: pending
  - id: romm-client
    content: 'Implement shared RomM API client: auth, platforms, roms list/search, content download'
    status: pending
  - id: platform-map
    content: Bundle ES-DE↔RomM slug map + Settings overrides
    status: pending
  - id: download-index
    content: Download queue into RetroDECK roms folders + SQLite local index + local delete
    status: pending
  - id: library-ui
    content: 'Library UI: platforms, browse, downloaded badges, single/bulk download'
    status: pending
  - id: save-sync-core
    content: Device registration + Device Sync Protocol in shared core (manual + daemon entrypoints)
    status: pending
  - id: sync-daemon
    content: 'rommdeck-syncd + systemd --user unit: fs watch, interval poll, logs, status file'
    status: pending
  - id: sync-ui
    content: 'GUI Sync/Settings: enable auto-sync, interval, conflict policy, daemon status, Sync Now'
    status: pending
  - id: dev-env
    content: 'Config + systemd install; document Linux/RetroDECK local workflow'
    status: pending
  - id: readme
    content: 'README with setup, token scopes, systemd install, Linux/RetroDECK workflow'
    status: pending
isProject: false
---
# RommDeck: RomM ↔ RetroDECK Desktop Bridge

## Goal

A Linux desktop stack that treats **RomM as the library source of truth** and **RetroDECK as the local play target**:

- **GUI**: browse by platform, download ROMs (one or whole platform), see/delete local copies, configure sync
- **Background service**: keep saves/states auto-synced with RomM even when the GUI is closed

Greenfield project (no existing repo). Working name: **RommDeck**.

## Stack (chosen default)

- **Shared Node/TypeScript core** — RomM client, RetroDECK paths, downloads, SQLite index, Device Sync Protocol
- **Electron + React + TypeScript GUI** — browse/download/settings; talks to core + reads daemon status
- **`rommdeck-syncd` Node daemon** — long-running process installed as a **systemd user service**
- **better-sqlite3** local index at `~/.local/share/rommdeck/library.db`
- Config at `~/.config/rommdeck/config.json` (shared by GUI and daemon)

Everything stays in TypeScript/Node so you can review it. No Rust.

## Dev environment (Linux + RetroDECK)

Develop and run everything on the Linux host that has RetroDECK installed. RomM is a separate instance reachable on the network (or localhost).

| Concern | Where |
| --- | --- |
| Edit / build / run GUI | Same Linux host |
| Real `retrodeck.json` + Flatpak paths | Auto-detected |
| Downloads into ROM folders | Real RetroDECK `roms_path` |
| `systemd --user` daemon | Same host — validate end-to-end locally |

**Default workflow:**

1. Clone repo, `npm install`, build core, run Electron GUI.
2. Point `romm.baseUrl` at your RomM instance and paste a Client API Token.
3. Auto-detect RetroDECK from `~/.var/app/net.retrodeck.retrodeck/config/retrodeck/retrodeck.json` (override in Settings if needed).
4. Install/enable the `systemd --user` unit for auto-sync on the same machine.

Config lives in one place: `~/.config/rommdeck/config.json` (shared by GUI and daemon). Sync interval / debounce are set there or in Settings.

**Network** — RomM must be reachable from this host. Token scopes include roms/platforms read, assets read/write, devices read/write. If RomM is bound to localhost only on another machine, use an SSH tunnel (`ssh -L 8080:localhost:8080 romm-host`) or open LAN access.

Optional helpers still in the repo: `fixtures/retrodeck.json`, `scripts/seed-dev-tree.sh` (offline/fixture paths if you ever need them), `scripts/deploy-syncd.sh` (rsync install of the daemon binary/unit).

## Architecture

```mermaid
flowchart TB
  subgraph userSpace [User session]
    UI[Electron GUI]
    Daemon[rommdeck-syncd]
    Systemd[systemd --user]
  end
  Core[Shared TS core]
  Cfg["~/.config/rommdeck/config.json"]
  Status["~/.local/share/rommdeck/daemon-status.json"]
  Idx[SQLite index]
  RomM[RomM API]
  RD[RetroDECK folders]

  Systemd -->|keeps alive| Daemon
  UI --> Core
  Daemon --> Core
  UI --> Cfg
  Daemon --> Cfg
  Daemon --> Status
  UI -->|read status| Status
  Core --> RomM
  Core --> Idx
  Core --> RD
```

**Split of responsibilities**

| Component | Does | Does not |
| --- | --- | --- |
| Electron GUI | Browse, download ROMs, delete local ROMs, settings, manual Sync Now, show daemon status/history | Stay running for sync |
| `rommdeck-syncd` | Auto save/state sync on an interval + filesystem watch; write status/logs | Download whole ROM libraries unattended (v1) |
| Shared core | All RomM/RetroDECK/sync logic used by both | Own process lifecycle |

## Auto-sync daemon

RomM’s Device Sync Protocol is **poll-based** (no server push). The daemon therefore:

1. Runs under **`systemd --user`** (`rommdeck-syncd.service`) so it starts at login and restarts on failure — no root/`system` unit required for normal Steam Deck / desktop use.
2. On a configurable **interval** (default e.g. 5 minutes; respect RomM’s “don’t poll negotiate tightly” guidance), runs a full negotiate → execute → complete session.
3. Additionally **watches** `saves_path` and `states_path` (Node `fs.watch` / `chokidar`) and **debounces** (e.g. 30–60s after last write) to sync soon after a game saves — without hammering the API.
4. Uses the same device registration + conflict **policy** from config (unattended default: `keep_both` or user-chosen `server_wins` / `device_wins`; GUI can still offer interactive resolution on manual sync).
5. Writes **`daemon-status.json`**: running, last sync time, last result, pending conflicts, last error — GUI reads this (and can `systemctl --user` start/stop/enable via Settings, or shell out to helper scripts).
6. Logs to journald (`StandardOutput=journal`) and optionally `~/.local/share/rommdeck/logs/`.

Ship a unit file such as:

`~/.config/systemd/user/rommdeck-syncd.service`  
(ExecStart = path to packaged `rommdeck-syncd`; `WantedBy=default.target`)

GUI Settings: **Enable auto-sync** toggles `systemctl --user enable --now` / `disable --now`.

## RetroDECK integration

Auto-detect from current RetroDECK config (JSON, not `.cfg`):

`~/.var/app/net.retrodeck.retrodeck/config/retrodeck/retrodeck.json`

Read `paths`:

- `rd_home_path`
- `roms_path`
- `saves_path`
- `states_path`

Allow manual override in Settings if auto-detect fails.

Downloads land in:

`{roms_path}/{esde_folder}/{filename}`

Platform mapping uses RomM’s ES-DE map (folder → RomM slug), inverted for download targets — e.g. RomM `ngc` → RetroDECK `gc`, `genesis` → `megadrive`. Ship a bundled map (from [config.es-de.example.yml](https://github.com/rommapp/romm/blob/master/examples/config.es-de.example.yml)) plus Settings overrides for custom RomM `system.platforms` configs.

## RomM API usage

Auth: **Client API Token** (`Authorization: Bearer rmm_...`).

| Feature | Endpoints |
| --- | --- |
| Platforms | `GET /api/platforms` |
| Browse/search | `GET /api/roms`, `GET /api/search/roms` |
| Download | `GET /api/roms/{id}/content/{file_name}` (multi-file via `/files` as needed) |
| Device register | `POST /api/devices` |
| Save/state sync | `POST /api/sync/negotiate` → upload/download ops → `POST /api/sync/sessions/{id}/complete` |
| Asset I/O | `POST /api/saves`, `GET /api/saves/{id}/content` (and states equivalents) |

Target against RomM **5.x** OpenAPI (`/openapi.json`).

## UI screens

1. **Setup / Settings** — RomM URL, API token (test connection), RetroDECK path (auto-detect from `retrodeck.json` + browse), platform-map overrides, sync mode (`push_pull` default), **auto-sync on/off**, interval, debounce, unattended conflict policy, daemon install/status.
2. **Library** — left: platforms; main: ROM grid/list with cover + **Downloaded / Missing** badge; search; multi-select.
3. **Downloads** — queue with per-item + per-platform bulk; progress, cancel, retry; write into mapped RetroDECK folders; update SQLite index on success.
4. **Local management** — filter to downloaded; **Delete from device** removes local file(s) only (never deletes on RomM); confirm dialog.
5. **Sync** — device pair status; **Sync Now** (via core, same as daemon); live/last daemon status; conflict list for manual resolution when policy left them pending.

Visual direction: utility app — clear hierarchy, platform-first navigation, restrained color system (avoid purple-gradient / cream-serif AI clichés), subtle motion on queue progress and status transitions.

## Local inventory logic

- On download success: record `rom_id`, RomM slug, ES-DE folder, filename(s), size, optional SHA1, path.
- On library load: join RomM list with index; also rescan `{roms_path}/{esde}/*` to catch files added outside the app (match by filename).
- Multi-file ROMs: store all files under the same `rom_id`; “downloaded” = all required files present.

## Save / state sync logic (shared)

1. Register device with paths pointing at RetroDECK `saves_path` / `states_path`.
2. Build negotiate payload from **indexed downloaded ROMs** only: scan save/state files tied by content basename / common emulator layouts; compute mtime + SHA1.
3. Execute returned ops (upload multipart, download to `dest_path`, apply conflict choice/policy).
4. Complete session; update status for GUI + journal.

Play-session ingest is out of scope for v1 (empty `play_sessions` on complete).

## Project layout

```
rommdeck/
  packages/core/           # Shared TS: romm client, paths, download, sync, db
  packages/gui/            # Electron + React
  packages/syncd/          # CLI daemon entrypoint
  packaging/systemd/       # rommdeck-syncd.service
  fixtures/retrodeck.json  # Optional sample paths (non-RetroDECK fallback)
  scripts/seed-dev-tree.sh
  scripts/deploy-syncd.sh  # optional rsync install of daemon
  data/platform-map.json
  docs/mockups/          # UI direction mockups (Arcade/CRT)
  README.md
```

## Implementation order

1. Monorepo scaffold + shared config + `retrodeck.json` detection
2. Shared RomM client + platform map
3. Download manager + SQLite index + local delete + Library UI
4. Sync core (negotiate/execute/complete) + manual Sync in GUI
5. `rommdeck-syncd` + systemd user unit + watch/interval + status file
6. GUI daemon controls + conflict policy settings
7. README (Linux/RetroDECK workflow, token scopes, systemd)
8. **UI shell + themes (in progress)** — vector shell lock; selectable color schemes; see section below

## UI: Arcade / CRT shell + themes

**Status:** In progress — tooling + shell + pages + theme picker done. Next: smoke-check / optional Radix skins.

### Decisions

- **Shell / layout source of truth:** `docs/mockups/shell-vector.png` (the Vector mockup). Every theme must use this structure; only accent colors change.
- **UI stack:** **Tailwind CSS v4** (utilities + CSS-variable themes) + **Radix UI** (unstyled accessible primitives) + **lucide-react** icons. Custom Vector shell — no MUI/Chakra/Ant. Optional shadcn copy-paste later if useful; not a hard dependency.
- **Default theme:** `candy` (magenta accents on the vector shell).
- **Selectable themes:** `candy` | `gold` | `vector` | `mint`.
- **Persistence:** `ui.theme` in `~/.config/rommdeck/config.json`; Settings picker; apply via `data-theme` on the document root.
- **Living plan:** This file is the source of truth; update whenever UI direction changes.
- **Mockups:** Live in `docs/mockups/`. Always show mockups in chat when discussing UI.

### Shell elements (from Vector)

- Left sidebar: RD square brand, wordmark, icon nav with **outline** active state (accent border + accent text), bottom version box
- Outer accent frame around the whole app (square corners — no border-radius / chamfer on chrome)
- Frameless Electron window + mockup-style minimize / maximize / close (accent stroke) top-right; drag strip to move
- Main content flush beside sidebar (accent divider); bottom stats/status strip
- Library header + toolbar chrome (style existing controls; do not add new Scan Library product behavior)
- Platforms rail + ROM grid (existing split, vector styling)
- Sharp corners everywhere (`border-radius: 0`); RD mark keeps its SVG chamfer only

### Mockups

| Role | File |
| --- | --- |
| Shell lock | `docs/mockups/shell-vector.png` |
| Theme `vector` | `docs/mockups/theme-vector.png` |
| Theme `candy` (default) | `docs/mockups/theme-candy.png` |
| Theme `gold` | `docs/mockups/theme-gold.png` |
| Theme `mint` | `docs/mockups/theme-mint.png` |

### Implementation todos

1. ~~Add Tailwind v4 + Radix to `packages/gui`; wire CSS vars to `[data-theme]`~~ **done**
2. ~~Theme token sets for candy / gold / vector / mint~~ **done** (`themes.css`)
3. ~~Rebuild App shell in Tailwind to match `shell-vector.png`~~ **done** (accent frame, square corners, outline nav, status strip, Library chrome vector pass)
4. ~~Restyle remaining pages (Downloads / Sync / Settings)~~ **done** — shared `components/ui.tsx`; legacy `app.css` reduced to fonts only. Radix skins still pending.
5. ~~Add `ui.theme` to config + Settings theme picker; apply on load/save~~ **done**
6. Smoke-check all routes + theme switching (desktop + narrow); iterate mockup deltas from review

### Later UI passes (not this one)

Library cover shelf, Downloads queue motion, Sync conflict UX — same shell + theme system.

## v1 non-goals

- Uploading ROMs to RomM
- Deleting ROMs on the RomM server
- Unattended bulk ROM downloading (downloads stay GUI-driven)
- Launching games / controlling RetroDECK/ES-DE
- BIOS/firmware management
- Flatpak packaging (document manual build; packaging can follow)
- Playtime reporting
- System-wide (root) systemd unit

## Risk notes

- **Slug mismatches**: custom RomM folder maps need Settings overrides.
- **Save path layouts**: RetroArch vs standalone emulators differ under `saves/`/`states/`; v1 matches via indexed ROM basenames and common subfolder patterns, with sync limited to ROMs known to the local index.
- **Large multi-disc / folder ROMs**: use RomM file list endpoints and download all parts.
- **Unattended conflicts**: daemon cannot pop UI mid-game; require an explicit default conflict policy in config.
- **Steam Deck Gaming Mode**: user systemd services generally run when the user session is active; document that sync runs in Desktop Mode and while logged in (same as other `--user` services).
