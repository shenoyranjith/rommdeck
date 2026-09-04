plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.compose.multiplatform)
}

import org.gradle.api.tasks.JavaExec
import java.nio.file.Files
import java.nio.file.Path

val appVersion = providers.gradleProperty("rommdeck.version").orElse("0.1.0")
val desktopPackageName = "RommDeck"

val generateAppVersion by tasks.registering {
    val outputDir = layout.buildDirectory.dir("generated/app-version-src")
    val version = appVersion.get()
    outputs.dir(outputDir)
    doLast {
        val dir = outputDir.get().asFile.resolve("dev/rommdeck/desktop")
        dir.mkdirs()
        dir.resolve("GeneratedAppVersion.kt").writeText(
            """
            package dev.rommdeck.desktop

            @Suppress("unused")
            internal object GeneratedAppVersion {
                const val VERSION = "$version"
            }
            """.trimIndent() + "\n",
        )
    }
}

kotlin {
    jvm {
        @OptIn(org.jetbrains.kotlin.gradle.ExperimentalKotlinGradlePluginApi::class)
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_21)
        }
    }
    jvmToolchain(21)

    sourceSets {
        jvmMain {
            kotlin.srcDir(layout.buildDirectory.dir("generated/app-version-src"))
        }
        jvmMain.dependencies {
            implementation(compose.desktop.currentOs)
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.material3)
            implementation(compose.materialIconsExtended)
            implementation(compose.ui)
            implementation(libs.kotlinx.coroutines.swing)
            implementation(project(":shared"))
        }
    }
}

tasks.named("compileKotlinJvm") {
    dependsOn(generateAppVersion)
}

compose.desktop {
    application {
        mainClass = "dev.rommdeck.desktop.MainKt"
        nativeDistributions {
            // Linux .AppImage is produced by scripts/package-linux-appimage.sh from createDistributable.
            // Compose TargetFormat.AppImage means jpackage's unpacked app dir, not a .AppImage file.
            // Add TargetFormat.Dmg / Msi when those CI jobs land (macOS requires package major > 0).
            packageName = desktopPackageName
            packageVersion = appVersion.get().let { v ->
                // Strip CI suffixes like 0.1.0+abc1234 for jpackage metadata.
                v.substringBefore('+').substringBefore('-').ifBlank { "0.1.0" }
            }
            description = "RomM ↔ RetroDECK (ES-DE frontend) — download ROMs, metadata, and sync saves"
            vendor = "RommDeck"
            copyright = "© RommDeck contributors"
            includeAllModules = true

            val iconsDir = layout.projectDirectory.dir("src/jvmMain/resources/icons")
            linux {
                iconFile.set(iconsDir.file("app-icon-512.png"))
                packageName = "rommdeck"
                debMaintainer = "rommdeck@users.noreply.github.com"
                menuGroup = "Game"
                appCategory = "Game"
            }
            windows {
                iconFile.set(iconsDir.file("app-icon.ico"))
                menuGroup = "RommDeck"
                upgradeUuid = "a7c3e8f1-4b2d-4e9a-9c1f-8d6b5a4e3f20"
            }
            macOS {
                bundleID = "dev.rommdeck.desktop"
                // Add .icns when packaging macOS builds.
            }
        }
    }
}

val syncdInstallDir = project(":apps:syncd").layout.buildDirectory.dir("install/rommdeck-syncd")

val distributableAppDir = layout.buildDirectory.dir("compose/binaries/main/app/$desktopPackageName")

/**
 * Copy syncd next to the Compose app image so packaged installs resolve
 * `$ROMMDECK_APP_ROOT/syncd` without a git checkout.
 */
val bundleSyncdIntoDistributable by tasks.registering(Copy::class) {
    group = "distribution"
    description = "Bundle rommdeck-syncd into the Compose createDistributable output"
    dependsOn("createDistributable", ":apps:syncd:installDist")
    from(syncdInstallDir)
    into(distributableAppDir.map { it.dir("syncd") })
}

/**
 * Compose/jpackage `lib/runtime` is a jlink image **without** `bin/java` (the native
 * RommDeck launcher embeds the JVM). Syncd needs a normal `java` launcher for systemd,
 * so we jlink a real runtime into `syncd/runtime` at package time.
 */
val bundleRuntimeIntoSyncd by tasks.registering {
    group = "distribution"
    description = "jlink a JRE with bin/java into syncd/runtime for systemd"
    dependsOn(bundleSyncdIntoDistributable)

    val syncdRuntime = distributableAppDir.map { it.dir("syncd/runtime") }
    val composeRuntimeRelease = distributableAppDir.map { it.file("lib/runtime/release") }
    outputs.dir(syncdRuntime)
    inputs.file(composeRuntimeRelease)

    doLast {
        val outDir = syncdRuntime.get().asFile.toPath()
        if (Files.exists(outDir)) {
            outDir.toFile().deleteRecursively()
        }
        Files.createDirectories(outDir.parent)

        val javaHome = Path.of(System.getProperty("java.home"))
        val jmods = javaHome.resolve("jmods")
        check(Files.isDirectory(jmods)) {
            "Packaging needs a full JDK with jmods (java.home=$javaHome). Set JAVA_HOME to a JDK, not a JRE."
        }
        val jlink = javaHome.resolve("bin").resolve("jlink").takeIf { Files.isRegularFile(it) }
            ?: Path.of("jlink")

        // Prefer the same module set Compose used; fall back to a practical syncd set.
        val releaseFile = composeRuntimeRelease.get().asFile
        val modules = if (releaseFile.isFile) {
            releaseFile.readLines()
                .firstOrNull { it.startsWith("MODULES=") }
                ?.removePrefix("MODULES=")
                ?.trim('"')
                ?.split(Regex("\\s+"))
                ?.filter { it.isNotBlank() }
                ?.joinToString(",")
        } else {
            null
        } ?: listOf(
            "java.base",
            "java.logging",
            "java.management",
            "java.naming",
            "java.net.http",
            "java.sql",
            "java.xml",
            "java.desktop",
            "java.security.jgss",
            "jdk.crypto.ec",
            "jdk.crypto.cryptoki",
            "jdk.unsupported",
        ).joinToString(",")

        val cmd = listOf(
            jlink.toString(),
            "--module-path", jmods.toString(),
            "--add-modules", modules,
            "--output", outDir.toString(),
            "--strip-debug",
            "--no-header-files",
            "--no-man-pages",
        )
        logger.lifecycle("jlink syncd runtime: $cmd")
        val proc = ProcessBuilder(cmd).inheritIO().start()
        val code = proc.waitFor()
        check(code == 0) { "jlink failed with exit code $code" }

        val javaBin = outDir.resolve("bin").resolve("java")
        check(Files.isRegularFile(javaBin)) { "jlink output missing $javaBin" }
        javaBin.toFile().setExecutable(true, false)
        logger.lifecycle("Bundled syncd JRE at $javaBin")
    }
}

tasks.register("prepareLinuxAppImageContents") {
    group = "distribution"
    description = "Build Compose app image and bundle syncd + JRE (input for AppImage packaging)"
    dependsOn(bundleRuntimeIntoSyncd)
    doLast {
        val appDir = distributableAppDir.get().asFile
        check(appDir.isDirectory) { "Missing Compose app image at $appDir" }
        val syncdBin = appDir.resolve("syncd/bin/rommdeck-syncd")
        check(syncdBin.isFile) { "Missing bundled syncd launcher at $syncdBin" }
        val syncdJava = appDir.resolve("syncd/runtime/bin/java")
        check(syncdJava.isFile) { "Missing bundled syncd JRE at $syncdJava" }
        if (!Files.isExecutable(syncdBin.toPath())) {
            syncdBin.setExecutable(true, false)
        }
        if (!Files.isExecutable(syncdJava.toPath())) {
            syncdJava.setExecutable(true, false)
        }
        logger.lifecycle("Packaged app tree ready at $appDir")
    }
}

// Display env + UI scale for :run and Compose Hot Reload tasks.
afterEvaluate {
    tasks.withType<JavaExec>().configureEach {
        if (name == "run" || name == "hotRunJvm" || name.startsWith("hotRun")) {
            doFirst {
                environment("DISPLAY", System.getenv("DISPLAY")?.takeIf { it.isNotBlank() } ?: ":0")
                System.getenv("WAYLAND_DISPLAY")?.takeIf { it.isNotBlank() }?.let {
                    environment("WAYLAND_DISPLAY", it)
                }
                System.getenv("XAUTHORITY")?.takeIf { it.isNotBlank() }?.let {
                    environment("XAUTHORITY", it)
                }
                System.getenv("ROMMDECK_UI_SCALE")?.takeIf { it.isNotBlank() }?.let {
                    environment("ROMMDECK_UI_SCALE", it)
                }
            }
            jvmArgs("-Djava.awt.headless=false")
        }
    }
}
