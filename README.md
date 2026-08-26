# RommDeck

Desktop bridge between **[RomM](https://github.com/rommapp/romm)** (library source of truth) and **[RetroDECK](https://retrodeck.net/)** (local play target).

- **GUI** (Electron): browse platforms, download ROMs into RetroDECK folders, delete local copies, configure sync
- **Daemon** (`rommdeck-syncd`): systemd user service that auto-syncs saves/states via RomM’s Device Sync Protocol

## Requirements

- Node.js 20+
- A RomM **5.x** instance reachable on your LAN
- A Client API Token with scopes for platforms/roms read, assets read/write, and devices read/write
- Linux host with RetroDECK for production paths + systemd (Mac uses fixture dirs)

## Monorepo layout

```
packages/core/      Shared TypeScript (RomM client, downloads, SQLite index, sync)
packages/gui/       Electron + React UI
packages/syncd/     Background sync daemon CLI
packaging/systemd/  rommdeck-syncd.service
fixtures/           Sample retrodeck.json for Mac/dev
data/platform-map.json
scripts/seed-dev-tree.sh
scripts/deploy-syncd.sh
```

## Mac / LAN development

1. Install dependencies:

```bash
npm install
npm run build:core
# postinstall rebuilds better-sqlite3 for Electron's Node ABI
```

Native module note: `better-sqlite3` must match the runtime. After `npm install`, `postinstall` rebuilds it for Electron. If the GUI shows a `NODE_MODULE_VERSION` error, run `npm run rebuild:electron`. For the Node-based sync daemon on this machine, run `npm run rebuild:node` first.

2. Seed a fixture RetroDECK tree and `config.dev.json`:

```bash
npm run seed:dev
```

Edit `~/.config/rommdeck/config.dev.json` — set `romm.baseUrl` to your LAN RomM (e.g. `http://192.168.x.x:8080`) and paste a Client API Token (`rmm_…`).

3. Run the GUI:

```bash
ROMMDECK_PROFILE=dev npm run dev:gui
```

Downloads and sync logic write under `~/rommdeck-dev/retrodeck/`. No RetroDECK install is required on the Mac.

If RomM only listens on localhost on host A:

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

## Linux / RetroDECK host

On the Steam Deck (or other Linux box with RetroDECK):

1. Auto-detect uses:

`~/.var/app/net.retrodeck.retrodeck/config/retrodeck/retrodeck.json`

(`roms_path`, `saves_path`, `states_path`). Override in Settings if needed.

2. Deploy the daemon from your Mac:

```bash
REMOTE=deck@192.168.x.x npm run deploy:syncd
```

3. Enable at login:

```bash
systemctl --user enable --now rommdeck-syncd.service
```

Logs: `journalctl --user -u rommdeck-syncd.service -f`  
Status file: `~/.local/share/rommdeck/daemon-status.json`  
Config (shared with GUI): `~/.config/rommdeck/config.json`

The GUI Sync page can toggle `systemctl --user enable/disable --now` on Linux.

### Gaming Mode note

`systemd --user` services run while your user session is active. Sync is reliable in Desktop Mode and while logged in (same as other user services).

## Config profiles

| Env | Behavior |
| --- | --- |
| `ROMMDECK_PROFILE=dev` | Loads `config.dev.json` sidecar; shorter default sync interval |
| `ROMMDECK_PROFILE=prod` (default) | Production paths / interval |

Optional overrides: `ROMMDECK_CONFIG_DIR`, `ROMMDECK_DATA_DIR`.

## Platform mapping

Downloads land in `{roms_path}/{esde_folder}/{filename}`.

Bundled map (`data/platform-map.json`) inverts RomM’s [ES-DE example](https://github.com/rommapp/romm/blob/master/examples/config.es-de.example.yml) (RomM slug → ES-DE folder), e.g. `ngc` → `gc`, `genesis` → `megadrive`. Override per slug in Settings.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run seed:dev` | Create fixture dirs + `config.dev.json` |
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
