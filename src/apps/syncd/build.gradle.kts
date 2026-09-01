plugins {
    alias(libs.plugins.kotlin.multiplatform)
}

val syncdMainClass = "dev.rommdeck.syncd.MainKt"

kotlin {
    jvm {
        @OptIn(org.jetbrains.kotlin.gradle.ExperimentalKotlinGradlePluginApi::class)
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_21)
        }
    }
    jvmToolchain(21)

    sourceSets {
        jvmMain.dependencies {
            implementation(project(":shared"))
            implementation(libs.kotlinx.coroutines.core)
        }
    }
}

val installDir = layout.buildDirectory.dir("install/rommdeck-syncd")

tasks.register<Copy>("installDist") {
    group = "distribution"
    description = "Install the sync sidecar into build/install/rommdeck-syncd"
    dependsOn("jvmJar")
    into(installDir)
    into("lib") {
        from(tasks.named("jvmJar"))
        from(configurations.named("jvmRuntimeClasspath"))
    }
    into("bin") {
        from(layout.projectDirectory.dir("packaging"))
    }
    doLast {
        val unix = installDir.get().asFile.resolve("bin/rommdeck-syncd")
        if (unix.exists()) unix.setExecutable(true, false)
    }
}

tasks.register<JavaExec>("run") {
    group = "application"
    dependsOn("jvmJar")
    classpath = files(
        tasks.named("jvmJar").map { it.outputs.files },
        configurations.named("jvmRuntimeClasspath"),
    )
    mainClass.set(syncdMainClass)
}
