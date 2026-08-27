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
    content: Download queue into RetroDECK roms folders + SQLite local index + local delete + ES-DE metadata sync
    status: pending
  - id: library-ui
    content: 'Library UI: platforms, browse, downloaded badges, single/bulk download, selection mode'
    status: completed
  - id: downloads-ui
    content: 'Downloads UI: queue sections, cancel/retry, persist queue, exit guard — see Downloads section'
    status: pending
  - id: library-live-sync
    content: 'Fix Library + StatusBar live update when a download completes (no refresh required)'
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

**ES-DE metadata** (so RetroDECK does not re-scrape) is written under `{rd_home_path}/ES-DE/`:

| Asset | Path |
| --- | --- |
| Gamelists | `{rd_home}/ES-DE/gamelists/{esde_folder}/gamelist.xml` |
| Media | `{rd_home}/ES-DE/downloaded_media/{esde_folder}/{type}/` |

On download success, RommDeck upserts `gamelist.xml` from RomM metadata (`name`, `summary`, genres, release date, developer/publisher, etc.) and downloads cover/marquee/fanart/screenshot assets. Media filenames match the game **display name** (ES-DE v1+ convention — no image tags in XML). On local delete, remove the matching gamelist entry and media files.

Read `downloaded_media_path` from `retrodeck.json` when present; default `{rd_home_path}/ES-DE/downloaded_media`.

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
2. **Library** — **done** — left: platforms; main: ROM grid/list with cover + **Downloaded / Missing** badge; search; multi-select; bulk download/delete; status bar stats.
3. **Downloads** — **next UI pass** — Active / Failed sections; per-row progress, cancel, retry, dismiss; toolbar **Cancel all** + **Clear failed**; persist queue to `download-queue.json`; exit alert when active jobs remain; write ROMs + ES-DE metadata on success.
4. **Local management** — filter to downloaded; **Delete from device** removes local file(s) + ES-DE gamelist/media (never deletes on RomM); confirm dialog.
5. **Sync** — device pair status; **Sync Now** (via core, same as daemon); live/last daemon status; conflict list for manual resolution when policy left them pending.

Visual direction: utility app — clear hierarchy, platform-first navigation, restrained color system (avoid purple-gradient / cream-serif AI clichés), subtle motion on queue progress and status transitions.

## Local inventory logic

- On download success: record `rom_id`, RomM slug, ES-DE folder, filename(s), size, optional SHA1, path; **sync ES-DE metadata** (gamelist + media from RomM).
- On local delete: remove ROM files, SQLite rows, gamelist entry, and associated media under `ES-DE/downloaded_media/`.
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
8. ~~**UI shell + themes**~~ **done** — Vector shell implemented (sidebar, accent frame, status bar, theme picker)
9. **Downloads UI + queue** — see section below

## UI: Arcade / CRT shell + themes

**Status:** Shell + Library **done**. **Downloads** is the next UI pass (mockups committed).

### Decisions

- **Shell / layout source of truth:** implemented App shell (sidebar, accent frame, status bar, Library chrome). Theme mockups remain in `docs/mockups/theme-*.png`.
- **UI stack:** **Tailwind CSS v4** (utilities + CSS-variable themes) + **Radix UI** (unstyled accessible primitives) + **lucide-react** icons. Custom Vector shell — no MUI/Chakra/Ant.
- **Default theme:** `candy` (magenta accents on the vector shell).
- **Selectable themes:** `candy` | `gold` | `vector` | `mint`.
- **Persistence:** `ui.theme` in `~/.config/rommdeck/config.json`; Settings picker; apply via `data-theme` on the document root.
- **Living plan:** This file is the source of truth; update whenever UI direction changes.
- **Mockups:** Live in `docs/mockups/`. Show mockups when discussing UI.

### Shell elements (implemented)

- Left sidebar: RD square brand, wordmark, icon nav with **outline** active state (accent border + accent text), bottom version box
- Outer accent frame around the whole app (square corners)
- Frameless Electron window + mockup-style minimize / maximize / close (accent stroke) top-right
- Main content flush beside sidebar (accent divider); bottom stats/status strip (6-cell grid)
- Library: header + toolbar, platforms rail, ROM grid/list, selection mode, detail pane

### Mockups

| Role | File |
| --- | --- |
| Theme `vector` | `docs/mockups/theme-vector.png` |
| Theme `candy` (default) | `docs/mockups/theme-candy.png` |
| Theme `gold` | `docs/mockups/theme-gold.png` |
| Theme `mint` | `docs/mockups/theme-mint.png` |
| Downloads — active queue | `docs/mockups/downloads-vector-active.png` |
| Downloads — active + failed | `docs/mockups/downloads-vector-failed.png` |
| Downloads — empty | `docs/mockups/downloads-vector-empty.png` |

Remove `docs/mockups/shell-vector.png` on Downloads implementation (library shell is shipped).

## Downloads UI + queue (next pass)

Visual lock: `docs/mockups/downloads-vector-*.png`. Match Library page chrome (`LibraryPage`, `LibraryToolbar`, `RomList` row styling).

### Layout

- Header: **Downloads** (`text-[1.75rem]`), subtitle “Transfers into RetroDECK ROM folders”
- Summary toolbar: `N downloading · M queued · K failed` + **Cancel all** (when active) + **Clear failed** (when failed)
- Main panel (`border-accent`): **Active** section (progress rows) + **Failed** section (error + Retry/Dismiss) + empty state

### Queue behavior

Job lifecycle: **queued** → **downloading** → **metadata** (ES-DE gamelist + artwork) → **done** | **error** | **cancelled**

| State | Behavior |
| --- | --- |
| Metadata | Visible in ACTIVE section while writing ES-DE metadata from RomM; cancellable |
| Success | Auto-clear from page after metadata completes |
| Failed | Retain until retry or dismiss |
| Cancelled | Discard immediately |
| App exit (active jobs) | Electron dialog: Stay / Quit anyway; queue persisted to `~/.local/share/rommdeck/download-queue.json` |
| App restart | Restore active + failed queue; resume pump |

### Backend additions

- `DownloadManager`: `failedJobs`, `cancelAll`, `retry`, `dismissFailed`, `clearFailed`, persist/restore
- IPC: `downloads:retry`, `downloads:dismissFailed`, `downloads:clearFailed`, `downloads:cancelAll`; updated `downloads:list` shape `{ active, failed }`
- ES-DE: `packages/core/src/esde/gamelist.ts` — gamelist upsert + media download from RomM on success; cleanup on local delete

### GUI file split

```
packages/gui/src/pages/DownloadsPage.tsx
packages/gui/src/pages/downloads/DownloadToolbar.tsx
packages/gui/src/pages/downloads/DownloadList.tsx
packages/gui/src/pages/downloads/DownloadRow.tsx
packages/gui/src/pages/downloads/useDownloadQueue.ts
```

### Implementation todos (Downloads)

1. **Library live sync** (bugfix — do first): subscribe to `downloads:job`; on `status === 'done'`, update badges/stats without refresh
2. Remove `shell-vector.png`; core queue + persistence + ES-DE metadata
3. Electron IPC + exit guard
4. Downloads UI components + hook
5. Smoke: download → Library badge flips to Downloaded immediately → ES-DE metadata visible → quit mid-queue → restore

### Library live sync on download (bugfix)

**Problem:** After a ROM downloads, Library still shows **Missing** until the app is refreshed. Delete already updates live (`markCatalogRomDownloaded(..., false)` in [`useLibraryData.ts`](packages/gui/src/pages/library/useLibraryData.ts)); download success has no symmetric handler. [`DownloadsPage`](packages/gui/src/pages/DownloadsPage.tsx) listens to IPC events; Library does not. [`StatusBar`](packages/gui/src/components/StatusBar.tsx) only polls stats every 5s.

**Fix:**

```mermaid
flowchart LR
  IPC["downloads:job done"]
  Hook["useDownloadInventorySync in App"]
  Cache["romCache mark downloaded"]
  Lib["useLibraryData state"]
  Bar["StatusBar stats refresh"]
  IPC --> Hook
  Hook --> Cache
  Hook --> Lib
  Hook --> Bar
```

1. **App-level listener** — register `onDownloadJob` once in [`App.tsx`](packages/gui/src/App.tsx) (always mounted), not only while Library is visible. New hook: `packages/gui/src/hooks/useDownloadInventorySync.ts`.
2. **On `status === 'done'`** — given `romId` + `rommSlug` from job:
   - Extend [`markCatalogRomDownloaded`](packages/gui/src/pages/library/romCache.ts) → `markRomDownloadedInCatalog(romId, true)` that updates **all** catalog cache entries containing that `romId` (not scoped to one platform id)
   - Add `romId` to `downloadedIdsBySlug` for `rommSlug`; invalidate `downloadedRomsBySlug` for that slug (or append if cached list loaded)
   - Emit a lightweight callback/event so `useLibraryData` updates `roms`, `downloadedIds`, `detail`, and `downloadedRoms` React state when mounted
3. **StatusBar** — on same event, call `getLibraryStats()` immediately (keep 5s poll as fallback)
4. **Symmetric delete** — refactor delete path to use the same hook/event bus so cache + UI stay consistent

**Acceptance:** Queue a download from Library → stay on Library or switch to Downloads → when job completes, **Downloaded** badge, detail pane, Downloaded filter, and status bar counts update without reload.

### Later UI passes (not this one)

Sync conflict UX polish — same shell + theme system.

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
