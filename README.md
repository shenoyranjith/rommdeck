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
data/platform-map.json
docs/mockups/       UI mockups (themes + Downloads page)
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

Native module note: `better-sqlite3` must match the runtime. After `npm install`, `postinstall` rebuilds it for Electron. If the GUI shows a `NODE_MODULE_VERSION` error, run `npm run rebuild:electron`. For the Node-based sync daemon, run `npm run rebuild:node` first.

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

On this host:

1. Build and install the daemon (local install via deploy script, or point the unit at your build):

```bash
npm run build:syncd
# optional: REMOTE=user@host npm run deploy:syncd
```

2. Enable at login:

```bash
systemctl --user enable --now rommdeck-syncd.service
```

Logs: `journalctl --user -u rommdeck-syncd.service -f`  
Status file: `~/.local/share/rommdeck/daemon-status.json`  
Config (shared with GUI): `~/.config/rommdeck/config.json`

The GUI Sync page can toggle `systemctl --user enable/disable --now`.

### Gaming Mode note

`systemd --user` services run while your user session is active. Sync is reliable in Desktop Mode and while logged in (same as other user services).

## Config

Single file: `~/.config/rommdeck/config.json` (shared by GUI and daemon).

Optional path overrides: `ROMMDECK_CONFIG_DIR`, `ROMMDECK_DATA_DIR`.

## Platform mapping

Downloads land in `{roms_path}/{esde_folder}/{filename}`.

Bundled map (`data/platform-map.json`) inverts RomM’s [ES-DE example](https://github.com/rommapp/romm/blob/master/examples/config.es-de.example.yml) (RomM slug → ES-DE folder), e.g. `ngc` → `gc`, `genesis` → `megadrive`. Override per slug in Settings.

## ES-DE metadata

When a ROM download completes, RommDeck syncs metadata from RomM into RetroDECK’s ES-DE tree so games appear populated without scraping:

| Asset | Location |
| --- | --- |
| Gamelists | `{rd_home}/ES-DE/gamelists/{esde_folder}/gamelist.xml` |
| Media | `{rd_home}/ES-DE/downloaded_media/{esde_folder}/` — covers, screenshots, videos |

Text fields (`name`, `desc`, `genre`, `releasedate`, developer/publisher, etc.) come from RomM metadata. Local delete removes the matching gamelist entry and media files.

Logs roll at 5 MB (`~/.local/share/rommdeck/logs/rommdeck.log`, up to 9 archives).

## Downloads queue

The Downloads page shows **Active** and **Failed** sections with progress, cancel, retry, and dismiss. The queue persists to `~/.local/share/rommdeck/download-queue.json` across restarts. Quitting with active downloads shows an in-app confirmation; the queue resumes on next launch (after platforms load).

Library badges and the status bar update live when downloads finish (`useDownloadInventorySync` + inventory events).

UI mockups: `docs/mockups/downloads-vector-*.png`

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run seed:dev` | Optional fixture dirs + starter `config.json` (if not using real RetroDECK paths) |
| `npm run deploy:syncd` | Build core/syncd, rsync to `REMOTE`, restart user unit |
| `npm run build` | Build core, syncd, and GUI |
| `npm run typecheck` | Typecheck all packages |

## v1 non-goals

- Uploading or deleting ROMs on RomM
- Unattended bulk ROM downloading
- Launching games / controlling RetroDECK
- BIOS management, Flatpak packaging, playtime reporting
- System-wide (root) systemd unit

## License

Private / personal use unless otherwise stated.
