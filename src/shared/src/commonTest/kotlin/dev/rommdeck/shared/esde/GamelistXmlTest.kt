package dev.rommdeck.shared.esde

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class GamelistXmlTest {
    @Test
    fun roundTripPreservesNameAndPath() {
        val xml = serializeGamelistXml(
            listOf(GamelistGame(path = "./game.sfc", name = "Test & Co")),
        )
        val parsed = parseGamelistXml(xml)
        assertEquals(1, parsed.size)
        assertEquals("./game.sfc", parsed[0].path)
        assertEquals("Test & Co", parsed[0].name)
        assertTrue(xml.contains("&amp;"))
    }

    @Test
    fun upsertReplacesSamePath() {
        val first = upsertGamelistGames("", GamelistGame(path = "./a.sfc", name = "A"))
        val second = upsertGamelistGames(first, GamelistGame(path = "./a.sfc", name = "A2"))
        val games = parseGamelistXml(second)
        assertEquals(1, games.size)
        assertEquals("A2", games[0].name)
    }
}

class EsdePathsTest {
    @Test
    fun nestedEsdeHomeUsesGamelistsDirectly() {
        val layout = resolveEsdeLayout("/home/me/.local/share/ES-DE")
        assertTrue(layout.gamelistsRoot.endsWith("ES-DE/gamelists") || layout.gamelistsRoot.endsWith("ES-DE\\gamelists"))
    }

    @Test
    fun retrodeckHomeNestsEsde() {
        val layout = resolveEsdeLayout("/home/me/retrodeck")
        assertTrue(layout.gamelistsRoot.contains("ES-DE"))
        assertTrue(layout.gamelistsRoot.endsWith("gamelists") || layout.gamelistsRoot.endsWith("gamelists"))
    }
}
