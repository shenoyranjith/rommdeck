# RommDeck GUI assets

App logo matching the sidebar **RD** mark (`BrandMark` component).

| File | Use |
| --- | --- |
| `brand-mark.svg` | Vector source (candy accent `#ff2d95`); favicon |
| `icon.png` / `icon-512.png` | Electron window / taskbar icon |
| `icon-256.png`, `icon-128.png`, `icon-32.png` | Smaller raster sizes |

The in-app sidebar uses the React `BrandMark` SVG so the logo follows the active UI theme accent. Static PNG/SVG files use the default **candy** accent.

**Linux taskbar:** On first launch, the app installs `~/.local/share/applications/rommdeck.desktop` and icons under `~/.local/share/icons/hicolor/*/apps/rommdeck.png` so GNOME/KDE/Wayland can match the running window to the RD icon (not the generic Electron icon). After updating icons, fully quit RommDeck and restart; if the taskbar entry was pinned from an old Electron launch, unpin and launch **RommDeck** from the app menu once.
