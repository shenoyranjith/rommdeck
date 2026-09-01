package dev.rommdeck.shared.romm

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class RommClientTest {
    @Test
    fun getPlatformsFromArrayResponse() = runTest {
        val client = createTestClient(
            """
            [
              {"id": 1, "name": "SNES", "slug": "snes", "rom_count": 42}
            ]
            """.trimIndent(),
        )
        val platforms = client.getPlatforms()
        assertEquals(1, platforms.size)
        assertEquals("snes", platforms[0].slug)
        assertEquals(42, platforms[0].romCount)
        client.close()
    }

    @Test
    fun getPlatformsFromItemsWrapper() = runTest {
        val client = createTestClient(
            """
            {"items":[{"id":2,"name":"GBA","slug":"gba"}]}
            """.trimIndent(),
        )
        val platforms = client.getPlatforms()
        assertEquals(1, platforms.size)
        assertEquals("GBA", platforms[0].name)
        client.close()
    }

    @Test
    fun testConnectionSuccess() = runTest {
        val client = createTestClient("""[{"id":1,"name":"NES","slug":"nes"}]""")
        val result = client.testConnection()
        assertTrue(result.ok)
        assertEquals(1, result.platformCount)
        client.close()
    }

    @Test
    fun testConnectionFailureOn401() = runTest {
        val client = createTestClient("", HttpStatusCode.Unauthorized)
        val result = client.testConnection()
        assertTrue(!result.ok)
        assertTrue(result.error?.contains("401") == true)
        client.close()
    }

    @Test
    fun sendsBearerToken() = runTest {
        var authHeader: String? = null
        val engine = MockEngine { request ->
            authHeader = request.headers[HttpHeaders.Authorization]
            respond(
                content = "[]",
                status = HttpStatusCode.OK,
                headers = headersOf(HttpHeaders.ContentType, "application/json"),
            )
        }
        val client = RommClient("http://romm.test", "secret-token", HttpClient(engine) {
            install(ContentNegotiation) { json(rommJson) }
        })
        client.getPlatforms()
        assertEquals("Bearer secret-token", authHeader)
        client.close()
    }

    @Test
    fun getDeviceAcceptsNumericIdAndNestedPaths() = runTest {
        val client = createTestClient(
            """
            {
              "id": 42,
              "name": "Deck",
              "sync_mode": "push_pull",
              "sync_config": { "paths": { "roms": "/roms", "saves": "/saves", "states": "/states" } }
            }
            """.trimIndent(),
        )
        val device = client.getDevice("42")
        assertEquals("42", device.id)
        assertEquals("Deck", device.name)
        assertEquals("push_pull", device.syncMode)
        assertEquals("/saves", device.paths["saves"])
        client.close()
    }

    @Test
    fun platformIconUrlPrefersFsSlug() {
        val platform = RommPlatform(
            id = 1,
            name = "Super Nintendo",
            slug = "snes",
            fsSlug = "super_nintendo",
        )
        assertEquals(
            "http://romm.test/assets/platforms/super_nintendo.ico",
            platformIconUrl("http://romm.test", platform),
        )
        assertEquals(
            "http://romm.test/assets/platforms/snes.ico",
            platformIconUrl("http://romm.test", platform.copy(fsSlug = null)),
        )
    }

    private fun createTestClient(body: String, status: HttpStatusCode = HttpStatusCode.OK): RommClient {
        val engine = MockEngine {
            respond(
                content = body,
                status = status,
                headers = headersOf(HttpHeaders.ContentType, "application/json"),
            )
        }
        val http = HttpClient(engine) {
            install(ContentNegotiation) { json(rommJson) }
        }
        return RommClient("http://romm.test", "token", http)
    }
}
