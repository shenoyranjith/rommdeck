# RommDeck

Desktop bridge between **[RomM](https://github.com/rommapp/romm)** (library source of truth) and **[RetroDECK](https://retrodeck.net/)** (local play target).

- **GUI** (Electron): browse platforms, download ROMs into RetroDECK folders, manage the download queue, delete local copies, configure sync
- **Daemon** (`rommdeck-syncd`): systemd user service that auto-syncs saves/states via RomM’s Device Sync Protocol

On download, RommDeck writes ROM files **and** ES-DE metadata (gamelist + artwork from RomM) so RetroDECK does not need to scrape again.

## Requirements

- Node.js 20+
- Linux with RetroDECK installed
- A RomM **5.x** instance reachable from this host
- A Client API Token with scopes for platforms/roms read, assets read/write, and devices read/write

## Monorepo layout

```
packages/core/      Shared TypeScript (RomM client, downloads, SQLite index, ES-DE metadata, sync)
packages/gui/       Electron + React UI
packages/syncd/     Background sync daemon CLI
packaging/systemd/  rommdeck-syncd.service
fixtures/           Optional sample retrodeck.json (non-RetroDECK fallback)
data/platform-map.json           # RomM slug → ES-DE folder
data/platform-emulator-map.json  # ES-DE folder → emulator family (sync)
docs/mockups/       UI mockups (themes, Downloads, Settings, Sync)
scripts/seed-dev-tree.sh
scripts/deploy-syncd.sh
```

## Development (Linux + RetroDECK)

Edit, build, and run on the same machine that has RetroDECK.

1. Install dependencies:

```bash
npm install
npm run build:core
# postinstall rebuilds better-sqlite3 for Electron's Node ABI
```

Native module note: the GUI uses `better-sqlite3` built for **Electron** (repo `node_modules`). The sync daemon installs a **separate** Node build under `~/.local/share/rommdeck/syncd-runtime/` via `npm run install:syncd` — it does not run `rebuild:node` on the repo. If the GUI shows a `NODE_MODULE_VERSION` error, run `npm run rebuild:electron`.

2. Configure RomM:

Create or edit `~/.config/rommdeck/config.json` — set `romm.baseUrl` to your RomM instance and paste a Client API Token (`rmm_…`). See `fixtures/config.example.json` for a template.

3. Run the GUI:

```bash
npm run dev:gui
```

RetroDECK paths auto-detect from:

`~/.var/app/net.retrodeck.retrodeck/config/retrodeck/retrodeck.json`

(`roms_path`, `saves_path`, `states_path`). Override in Settings if needed.

If RomM only listens on localhost on another host:

```bash
ssh -L 8080:localhost:8080 user@romm-host
# then use http://127.0.0.1:8080 as baseUrl
```

## Client API token scopes

Create a token in RomM → Administration → Client API Tokens. For full RommDeck features include at least:

| Area | Scopes |
| --- | --- |
| Browse / download ROMs | platforms + roms read (as exposed by your RomM role) |
| Save/state I/O | `assets.read`, `assets.write` |
| Device registration / sync | `devices.read`, `devices.write` |

## Auto-sync daemon

On this host, **Settings → Auto-sync → Enable** installs the systemd user unit on first use. Or install manually:

```bash
npm run install:syncd
systemctl --user enable --now rommdeck-syncd.service
```

This writes `~/.local/bin/rommdeck-syncd` and `~/.config/systemd/user/rommdeck-syncd.service` pointing at your repo build.

Logs: `journalctl --user -u rommdeck-syncd.service -f`  
Status file: `~/.local/share/rommdeck/daemon-status.json`  
Config (shared with GUI): `~/.config/rommdeck/config.json`

The GUI Sync page can toggle auto-sync in **Settings → Auto-sync** (`systemctl --user enable/disable`). Interval, debounce, sync direction, and conflict policy are in the same section.

**Triggers:** startup sync (~2s after launch), background interval (default 5 min), and filesystem watch on `saves_path` + `states_path` (debounced, e.g. 45s after last write).

### Gaming Mode note

`systemd --user` services run while your user session is active. Sync is reliable in Desktop Mode and while logged in (same as other user services).

## Save & state sync

RommDeck syncs **RetroArch battery saves** and **save states** with RomM via the [Device Sync Protocol](https://docs.romm.app/5.1.0/developers/device-sync-protocol/). RomM decides upload/download/conflict; RommDeck scans local files and executes the plan.

**Two entry points, one engine** (`@rommdeck/core`):

| | Sync Now (GUI) | Auto-sync (`rommdeck-syncd`) |
| --- | --- | --- |
| When | On demand | At login, on interval, after save writes |
| Conflicts | Auto-resolved via Settings policy | Auto-resolved via config policy |

### What syncs (v1)

- **Battery saves** — `.srm`, `.sav`, `.rtc`, etc. under `{saves_path}/{esde_folder}/`
- **Save states** — `.state`, `.state0`–`.state9` under `{states_path}/{esde_folder}/`
- **Indexed ROMs only** — games in `library.db` (downloaded or rescanned from disk)
- **RetroArch-default platforms** — factory RetroDECK mapping; standalone emulators (GameCube, PS2, …) skipped until a future release

**Platform map overrides** in Settings (RomM slug ↔ ES-DE folder) are supported. **RetroArch core** choice stays in RetroDECK — RommDeck does not offer a core picker.

### Paths (RetroDECK defaults)

RommDeck assumes stock RetroDECK RetroArch layout:

```text
{saves_path}/{esde_folder}/{rom_basename}.{ext}
{states_path}/{esde_folder}/{rom_basename}.state[0-9]
```

Sort saves by content directory **on**; `savefiles_in_content_dir` **off**. Custom RetroArch save-path settings are not supported.

### Conflict policy

Default **`keep_both`**: if both copies changed before syncing, RomM keeps the server version and uploads yours as an additional save — nothing overwritten locally. Alternatives: `server_wins`, `device_wins`.

Configure in Settings → Auto-sync. Manual **Sync Now** uses the same conflict policy as the daemon.

### Not in v1

Standalone emulator saves, multi-disc `.m3u` save folders, zip-aware save hashing, ES-DE launcher overrides (`alternativeEmulator`). See [`RommDeck-plan.md`](RommDeck-plan.md) for full scope.

## Config

Single file: `~/.config/rommdeck/config.json` (shared by GUI and daemon).

Optional path overrides: `ROMMDECK_CONFIG_DIR`, `ROMMDECK_DATA_DIR`.

## Platform mapping

Two bundled maps in `data/` (Settings overrides apply to the first only):

| File | Purpose | v1 values |
| --- | --- | --- |
| `platform-map.json` | RomM slug → ES-DE folder (download targets) | e.g. `ngc` → `gc`, `genesis` → `megadrive` |
| `platform-emulator-map.json` | ES-DE folder → default emulator **family** (sync scope) | `retroarch` \| `standalone`; future: `dolphin`, `pcsx2`, … |

Downloads land in `{roms_path}/{esde_folder}/{filename}`.

`platform-map.json` inverts RomM’s [ES-DE example](https://github.com/rommapp/romm/blob/master/examples/config.es-de.example.yml). Override per slug in Settings → RomM.

Save sync (v1) only probes RetroArch paths for platforms mapped to `retroarch` in `platform-emulator-map.json`.

## ES-DE metadata

When a ROM download completes, RommDeck syncs metadata from RomM into RetroDECK’s ES-DE tree so games appear populated without scraping:

| Asset | Location |
| --- | --- |
| Gamelists | `{rd_home}/ES-DE/gamelists/{esde_folder}/gamelist.xml` |
| Media | `{rd_home}/ES-DE/downloaded_media/{esde_folder}/` — covers, screenshots, videos |

Text fields (`name`, `desc`, `genre`, `releasedate`, developer/publisher, etc.) come from RomM metadata. Local delete removes the matching gamelist entry and media files.

Logs roll at 5 MB (`~/.local/share/rommdeck/logs/rommdeck.log`, up to 9 archives). Set verbosity in **Settings → Logging** (Debug / Info / Warn / Error) and open the log file from there.

## Downloads queue

The Downloads page shows **Active** and **Failed** sections with progress, cancel, retry, and dismiss. The queue persists to `~/.local/share/rommdeck/download-queue.json` across restarts. Quitting with active downloads shows an in-app confirmation; the queue resumes on next launch (after platforms load).

Library badges and the status bar update live when downloads finish (`useDownloadInventorySync` + inventory events).

UI mockups: `docs/mockups/downloads-vector-*.png`, `docs/mockups/settings-vector-*.png`, `docs/mockups/sync-vector-slim.png`

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run seed:dev` | Optional fixture dirs + starter `config.json` (if not using real RetroDECK paths) |
| `npm run deploy:syncd` | Build core/syncd, rsync to `REMOTE`, restart user unit |
| `npm run build` | Build core, syncd, and GUI |
| `npm run typecheck` | Typecheck all packages |
| `npm run test:core` | Run core unit tests (rebuilds better-sqlite3 for Node, then restores Electron ABI) |
| `npm run rebuild:electron` | Fix GUI after running core tests directly — rebuilds better-sqlite3 for Electron |

## v1 non-goals

- Uploading or deleting ROMs on RomM
- Unattended bulk ROM downloading
- Launching games / controlling RetroDECK
- RetroArch core selection in RommDeck (use RetroDECK/ES-DE)
- Custom RetroArch save-path layouts
- Standalone emulator saves (Dolphin, PCSX2, …) — future release
- BIOS management, Flatpak packaging, playtime reporting
- System-wide (root) systemd unit

## License

Private / personal use unless otherwise stated.
