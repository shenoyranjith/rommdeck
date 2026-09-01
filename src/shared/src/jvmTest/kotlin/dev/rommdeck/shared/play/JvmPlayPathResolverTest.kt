package dev.rommdeck.shared.play

import dev.rommdeck.shared.config.PlayTargetConfig
import kotlin.io.path.createTempDirectory
import kotlin.io.path.writeText
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import java.nio.file.Path

class JvmPlayPathResolverTest {
    private val tempDirs = mutableListOf<Path>()

    @AfterTest
    fun cleanup() {
        tempDirs.forEach { it.toFile().deleteRecursively() }
        tempDirs.clear()
    }

    @Test
    fun expandHomeSubstitutesHomeVariable() {
        val home = System.getProperty("user.home")
        assertEquals("$home/roms", expandHome("\${HOME}/roms"))
        assertEquals("$home/roms", expandHome("~/roms"))
    }

    @Test
    fun manualPathsTakePrecedenceOverRetrodeckJson() {
        val dir = tempDir()
        val rdJson = dir.resolve("retrodeck.json")
        rdJson.writeText(
            """
            {
              "paths": {
                "roms_path": "${dir}/from-rd/roms",
                "saves_path": "${dir}/from-rd/saves",
                "states_path": "${dir}/from-rd/states"
              }
            }
            """.trimIndent(),
        )

        val resolved = resolvePlayPaths(
            PlayTargetConfig(
                configPath = rdJson.toString(),
                romsPath = "${dir}/manual/roms",
                savesPath = "",
                statesPath = "",
            ),
        )

        assertEquals("${dir}/manual/roms", resolved.romsPath)
        assertEquals("${dir}/from-rd/saves", resolved.savesPath)
        assertEquals(PathSource.MANUAL, resolved.source)
    }

    @Test
    fun readRetrodeckReturnsNullWhenFileMissing() {
        assertEquals(null, readRetroDeckJson("/nonexistent/retrodeck.json"))
    }

    @Test
    fun unconfiguredWhenNothingDetected() {
        val resolved = resolvePlayPaths(
            PlayTargetConfig(configPath = "/nonexistent/retrodeck.json"),
        )
        if (findRetroDeckJson("/nonexistent/retrodeck.json") == null && detectEsdeCandidate() == null) {
            assertEquals(PathSource.UNCONFIGURED, resolved.source)
        }
    }

    @Test
    fun retrodeckJsonUsedWhenPresentOnLinux() {
        if (!isLinux()) return

        val dir = tempDir()
        val rdJson = dir.resolve("retrodeck.json")
        rdJson.writeText(
            """
            {
              "paths": {
                "rd_home_path": "${dir}/retrodeck",
                "roms_path": "${dir}/retrodeck/roms",
                "saves_path": "${dir}/retrodeck/saves",
                "states_path": "${dir}/retrodeck/states"
              }
            }
            """.trimIndent(),
        )

        val resolved = resolvePlayPaths(
            PlayTargetConfig(configPath = rdJson.toString()),
        )

        assertEquals("${dir}/retrodeck/roms", resolved.romsPath)
        assertEquals(PathSource.RETRODECK_AUTO, resolved.source)
        assertEquals(rdJson.toString(), resolved.retrodeckJsonPath)
    }

    private fun tempDir(): Path {
        val dir = createTempDirectory("rommdeck-test-")
        tempDirs.add(dir)
        return dir
    }
}
