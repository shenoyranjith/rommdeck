plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.compose.multiplatform)
}

import org.gradle.api.tasks.JavaExec
import java.nio.file.Files

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
            description = "RomM ↔ ES-DE bridge — download ROMs, metadata, and sync saves"
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

tasks.register("prepareLinuxAppImageContents") {
    group = "distribution"
    description = "Build Compose app image and bundle syncd (input for AppImage packaging)"
    dependsOn(bundleSyncdIntoDistributable)
    doLast {
        val appDir = distributableAppDir.get().asFile
        check(appDir.isDirectory) { "Missing Compose app image at $appDir" }
        val syncdBin = appDir.resolve("syncd/bin/rommdeck-syncd")
        check(syncdBin.isFile) { "Missing bundled syncd launcher at $syncdBin" }
        if (!Files.isExecutable(syncdBin.toPath())) {
            syncdBin.setExecutable(true, false)
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
