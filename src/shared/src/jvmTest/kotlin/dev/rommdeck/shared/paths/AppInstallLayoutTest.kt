package dev.rommdeck.shared.paths

import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class AppInstallLayoutTest {
    @Test
    fun isSyncdDistRequiresLauncherScript() {
        val dir = Files.createTempDirectory("rommdeck-syncd-dist")
        try {
            assertFalse(AppInstallLayout.isSyncdDist(dir))
            Files.createDirectories(dir.resolve("bin"))
            Files.writeString(dir.resolve("bin/rommdeck-syncd"), "#!/bin/sh\n")
            assertTrue(AppInstallLayout.isSyncdDist(dir))
        } finally {
            dir.toFile().deleteRecursively()
        }
    }

    @Test
    fun looksLikeAppRootNeedsLibAndBinOrSyncd() {
        val root = Files.createTempDirectory("rommdeck-app-root")
        try {
            assertFalse(AppInstallLayout.looksLikeAppRoot(root))
            Files.createDirectories(root.resolve("lib"))
            assertFalse(AppInstallLayout.looksLikeAppRoot(root))
            Files.createDirectories(root.resolve("bin"))
            assertTrue(AppInstallLayout.looksLikeAppRoot(root))
        } finally {
            root.toFile().deleteRecursively()
        }
    }

    @Test
    fun detectJpackageAppRootFromRuntimeHome() {
        val root = Files.createTempDirectory("rommdeck-jpackage")
        try {
            Files.createDirectories(root.resolve("bin"))
            Files.createDirectories(root.resolve("lib/runtime"))
            val javaHome = root.resolve("lib/runtime")
            assertEquals(root.toAbsolutePath().normalize(), AppInstallLayout.detectJpackageAppRoot(javaHome))
        } finally {
            root.toFile().deleteRecursively()
        }
    }

    @Test
    fun detectJpackageAppRootRejectsNormalJdk() {
        val jdk = Files.createTempDirectory("fake-jdk")
        try {
            assertNull(AppInstallLayout.detectJpackageAppRoot(jdk))
            val nested = jdk.resolve("jre")
            Files.createDirectories(nested)
            assertNull(AppInstallLayout.detectJpackageAppRoot(nested))
        } finally {
            jdk.toFile().deleteRecursively()
        }
    }

    @Test
    fun looksLikeAppRootWithSyncdOnly() {
        val root = Files.createTempDirectory("rommdeck-syncd-only")
        try {
            Files.createDirectories(root.resolve("lib"))
            val syncd = root.resolve("syncd")
            Files.createDirectories(syncd.resolve("bin"))
            Files.writeString(syncd.resolve("bin/rommdeck-syncd"), "#!/bin/sh\n")
            assertTrue(AppInstallLayout.looksLikeAppRoot(root))
            assertTrue(AppInstallLayout.isSyncdDist(syncd))
        } finally {
            root.toFile().deleteRecursively()
        }
    }
}
