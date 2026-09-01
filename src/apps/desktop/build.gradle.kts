plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.compose.multiplatform)
}

import org.gradle.api.tasks.JavaExec

val appVersion = providers.gradleProperty("rommdeck.version").orElse("0.1.0")

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
            val iconsDir = layout.projectDirectory.dir("src/jvmMain/resources/icons")
            linux {
                iconFile.set(iconsDir.file("app-icon-512.png"))
            }
            windows {
                iconFile.set(iconsDir.file("app-icon.ico"))
            }
        }
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
