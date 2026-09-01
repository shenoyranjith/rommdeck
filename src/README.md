# Kotlin rewrite (Layer 0+)

This directory is the **Kotlin Multiplatform** rewrite of RommDeck.

The existing TypeScript app in [`../packages/`](../packages/) is unchanged and remains the reference implementation until this rewrite reaches feature parity.

## Prerequisites

- **Full JDK (not headless)** — Compose Desktop needs `libawt_xawt.so` for GUI.
  On Fedora you may only have `java-25-openjdk-headless` installed:

  ```bash
  sudo dnf install java-25-openjdk
  ./check-display.sh   # should report OK for libawt_xawt.so
  ```

- **JDK 17–25** — Gradle 9.2.1 runs on JDK 25. **Compilation** targets **JVM 21** (auto-downloaded via foojay if missing).
- Compose Hot Reload runs on **JetBrains Runtime 21** (auto-provisioned when using `./run-desktop-hot.sh`).
- For Android builds: Android SDK + `ANDROID_HOME` (optional until Layer 8).

## Run desktop app (Layer 0)

From this directory (`src/`):

```bash
./gradlew :apps:desktop:run
```

Or use the helper (sets `DISPLAY` if missing — common in Cursor's terminal):

```bash
./run-desktop.sh
```

A window titled **RommDeck** should open with a placeholder message.

### HeadlessException / "No X11 DISPLAY variable"

This is **not a Kotlin bug**. Compose Desktop draws a real window via AWT/Skiko and needs your desktop session.

**Cause:** the shell has no `DISPLAY` (often true in Cursor's integrated terminal, SSH without `-X`, or CI).

**Fix (Fedora + Wayland, your machine):**

```bash
export DISPLAY=:0
./gradlew :apps:desktop:run
```

Or run from **Konsole / GNOME Terminal** on your desktop — those inherit `DISPLAY` automatically.

Check: `echo $DISPLAY` should print something like `:0`, not empty.

Diagnose from the failing terminal:

```bash
./check-display.sh
```

**If it still fails in Cursor but works in Konsole:** Cursor's embedded terminal is isolated from your display (common on Flatpak/sandboxed installs). Use **IntelliJ IDEA** or **Konsole** for `:apps:desktop:run` during UI work.

Always stop a stale Gradle daemon first:

```bash
./gradlew --stop
./run-desktop.sh
```

## Hot reload (like HMR) during UI development

**Preferred for UI work** — edit composables and save; the window updates without a full restart:

```bash
./run-desktop-hot.sh
```

This runs `./gradlew :apps:desktop:hotRunJvm --autoReload` with `DISPLAY`, Wayland, and UI scale set like `./run-desktop.sh`.

Kotlin is compiled, so there is no Vite-style instant module swap. **Compose Hot Reload** (stable, bundled in Compose Multiplatform **1.10+**) is the closest equivalent:

| | Web (Vite) | Kotlin Compose Desktop |
|--|------------|------------------------|
| Change UI code | Hot swap JS module | Recompile changed classes, reload composables |
| Full app restart | Usually no | No (for UI-only changes) |
| Backend logic change | May need refresh | May need full restart |

- Requires **JetBrains Runtime (JBR)** at run time — enabled via `compose.reload.jbr.autoProvisioningEnabled=true` in `gradle.properties`
- **IntelliJ IDEA** with the Kotlin Multiplatform plugin: gutter **Run with Compose Hot Reload**
- Manual reload (without `--autoReload`): save files, then `./gradlew :apps:desktop:reload` in another terminal

**Without hot reload** (logic changes, cold start): `./run-desktop.sh` or `./gradlew :apps:desktop:run`

**Android:** Android Studio **Live Edit** (limited, debug builds only) — separate from Compose Hot Reload.

## Build everything (desktop + shared)

```bash
./gradlew build
```

## Android (optional, Layer 0 stub)

Requires Android SDK:

```bash
./gradlew :apps:android:assembleDebug
```

## Module layout

| Module | Role |
|--------|------|
| `shared/` | KMP library — `commonMain` + `jvmMain` + `androidMain` |
| `apps/desktop/` | Compose Desktop JVM app |
| `apps/android/` | Jetpack Compose Android app |

## Shared data

Platform maps live in [`../data/`](../data/). Layer 1+ will load them from shared resources or paths.
