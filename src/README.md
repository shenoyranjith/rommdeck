# RommDeck — Kotlin application

Cross-platform **RomM ↔ ES-DE** app: desktop client, background sync daemon, and shared Kotlin Multiplatform library.

**v0.1.0** ships the **Linux desktop** app; RetroDECK is auto-detected when installed. Other ES-DE layouts use manual Target paths. Android and additional desktop OSes are planned for v0.2.0.

User-facing overview: [`../README.md`](../README.md).

## Prerequisites

- **Full JDK (not headless)** — Compose Desktop needs `libawt_xawt.so` for the GUI.
  On Fedora you may only have `java-25-openjdk-headless` installed:

  ```bash
  sudo dnf install java-25-openjdk
  ./check-display.sh   # should report OK for libawt_xawt.so
  ```

- **AppImage packaging** — Compose `createDistributable` needs `jlink` and `jpackage` (and `jmods`). On Fedora:

  ```bash
  sudo dnf install java-25-openjdk-devel java-25-openjdk-jmods
  export JAVA_HOME=/usr/lib/jvm/java-25-openjdk   # optional but recommended
  ```

- **JDK 17–25** — Gradle 9.2.1 runs on JDK 25. **Compilation** targets **JVM 21** (auto-downloaded via foojay if missing).
- Compose Hot Reload runs on **JetBrains Runtime 21** (auto-provisioned when using `./run-desktop-hot.sh`).
- For Android builds: Android SDK + `ANDROID_HOME` (optional until v0.2.0).

## Run the desktop app

From this directory (`src/`):

```bash
./run-desktop.sh
```

Or directly:

```bash
./gradlew :apps:desktop:run
```

A window titled **RommDeck** opens with the full library, downloads, sync, and settings UI.

### HeadlessException / "No X11 DISPLAY variable"

Compose Desktop draws a real window via AWT/Skiko and needs your desktop session.

**Cause:** the shell has no `DISPLAY` (often true in an IDE integrated terminal, SSH without `-X`, or CI).

**Fix (Fedora + Wayland):**

```bash
export DISPLAY=:0
./run-desktop.sh
```

Or run from **Konsole / GNOME Terminal** on your desktop — those inherit `DISPLAY` automatically.

Diagnose:

```bash
./check-display.sh
```

**If it still fails in an IDE terminal but works in Konsole:** the embedded terminal may be isolated from your display. Use **IntelliJ IDEA** or **Konsole** for `:apps:desktop:run` during UI work.

Stop a stale Gradle daemon before relaunching:

```bash
./gradlew --stop
./run-desktop.sh
```

## Hot reload during UI development

**Preferred for UI work** — edit composables and save; the window updates without a full restart:

```bash
./run-desktop-hot.sh
```

This runs `./gradlew :apps:desktop:hotRunJvm --autoReload` with `DISPLAY`, Wayland, and UI scale set like `./run-desktop.sh`.

| | Web (Vite-style) | Kotlin Compose Desktop |
|--|------------------|------------------------|
| Change UI code | Hot swap module | Recompile changed classes, reload composables |
| Full app restart | Usually no | No (for UI-only changes) |
| Backend logic change | May need refresh | May need full restart |

- Requires **JetBrains Runtime (JBR)** at run time — `compose.reload.jbr.autoProvisioningEnabled=true` in `gradle.properties`
- Manual reload (without `--autoReload`): save files, then `./gradlew :apps:desktop:reload` in another terminal
- **Without hot reload** (logic changes, cold start): `./run-desktop.sh`

## Build and test

```bash
./gradlew build                  # desktop + syncd + shared
./gradlew :shared:jvmTest        # unit tests
./gradlew :apps:syncd:installDist # sync daemon install tree
./gradlew :apps:desktop:prepareLinuxAppImageContents  # Compose app + bundled syncd
```

## Linux AppImage (packaged)

From the **repo root** (requires Linux + JDK):

```bash
./scripts/package-linux-appimage.sh
# → dist/RommDeck-<version>-linux-x86_64.AppImage
```

GitHub Actions builds the same artifact on tags `v*` and via workflow dispatch (`.github/workflows/package-linux-appimage.yml`).

## Background sync daemon

Enable from **Settings → Auto-sync** in the app (installs the systemd user unit and sidecar under `~/.local/share/rommdeck/syncd/`).

After changing syncd code locally:

```bash
./gradlew :apps:syncd:installDist
rsync -a --delete apps/syncd/build/install/rommdeck-syncd/ ~/.local/share/rommdeck/syncd/
systemctl --user restart rommdeck-syncd.service
```

Optional env vars:

| Variable | Purpose |
| --- | --- |
| `ROMMDECK_APP_ROOT` | Packaged install prefix (`bin/`, `lib/`, `syncd/`) |
| `ROMMDECK_SYNCD_DIST` | Prebuilt syncd install tree |
| `ROMMDECK_SRC_ROOT` | Path to this `src/` directory (dev Gradle builds) |
| `ROMMDECK_VERSION` | Fallback version stamp if syncd dist has no `version.json` |

Installed syncd version is recorded at `~/.local/share/rommdeck/syncd/version.json` (read via `readInstalledSyncdVersion()`).

On desktop startup, if the auto-sync service is installed and that stamp differs from the app version, RommDeck reinstalls syncd from the current package/dev tree and restarts the daemon when it was running.

## Module layout

| Module | Role |
|--------|------|
| `shared/` | KMP library — `commonMain` + `jvmMain` + `androidMain` |
| `apps/desktop/` | Compose Desktop JVM app |
| `apps/syncd/` | Background sync JVM sidecar |
| `apps/android/` | Jetpack Compose stub (v0.2.0) |

## Shared data

Platform maps live in [`../data/`](../data/). Loaded from shared resources and user overrides in `config.json` (`platformMapOverrides`).
