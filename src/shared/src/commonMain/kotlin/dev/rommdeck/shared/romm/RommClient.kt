package dev.rommdeck.shared.romm

import dev.rommdeck.shared.config.RommConfig
import dev.rommdeck.shared.io.readFileBytes
import dev.rommdeck.shared.log.log
import io.ktor.client.HttpClient
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.header
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsChannel
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.contentType
import io.ktor.http.encodeURLParameter
import io.ktor.http.isSuccess
import io.ktor.client.request.forms.MultiPartFormDataContent
import io.ktor.client.request.forms.formData
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

class RommClient private constructor(
    val baseUrl: String,
    private val apiToken: String,
    private val httpClient: HttpClient,
    private val ownsClient: Boolean,
) {
    constructor(baseUrl: String, apiToken: String) : this(
        baseUrl = trimTrailingSlashes(baseUrl),
        apiToken = apiToken,
        httpClient = createRommHttpClient(),
        ownsClient = true,
    )

    internal constructor(
        baseUrl: String,
        apiToken: String,
        httpClient: HttpClient,
    ) : this(baseUrl, apiToken, httpClient, ownsClient = false)

    fun close() {
        if (ownsClient) {
            httpClient.close()
        }
    }

    suspend fun testConnection(): ConnectionTestResult {
        return try {
            val platforms = getPlatforms()
            ConnectionTestResult(ok = true, platformCount = platforms.size)
        } catch (e: Exception) {
            ConnectionTestResult(ok = false, error = e.message ?: e.toString())
        }
    }

    suspend fun getPlatforms(): List<RommPlatform> =
        requestList("/api/platforms")

    suspend fun getRoms(
        platformId: Int? = null,
        searchTerm: String? = null,
        limit: Int = 100,
        offset: Int = 0,
    ): RommRomPage {
        val query = buildMap {
            if (platformId != null) put("platform_ids", platformId.toString())
            if (!searchTerm.isNullOrBlank()) put("search_term", searchTerm)
            put("limit", limit.toString())
            put("offset", offset.toString())
        }
        val element = requestJson("GET", "/api/roms", query = query)
        val items = decodeList<RommRom>(element)
        val total = when (element) {
            is JsonObject -> element["total"]?.toString()?.toIntOrNull() ?: items.size
            else -> items.size
        }
        return RommRomPage(items = items, total = total)
    }

    suspend fun getRom(id: Int): RommRom =
        decodeValue(requestJson("GET", "/api/roms/$id"))

    fun resolveAssetUrl(assetPath: String?): String? = resolveRommAssetUrl(baseUrl, assetPath)

    fun coverUrlFor(rom: RommRom, preferLarge: Boolean = false): String? =
        dev.rommdeck.shared.romm.coverUrlFor(baseUrl, rom, preferLarge)

    fun logoUrlFor(platform: RommPlatform): String? =
        resolveAssetUrl(platform.logoPath) ?: resolveAssetUrl(platform.urlLogo)

    suspend fun downloadRomContent(
        romId: Int,
        fileName: String,
        destPath: String,
        onProgress: (bytesWritten: Long) -> Unit = {},
    ) {
        val encoded = fileName.encodeURLParameter()
        val url = buildUrl(baseUrl, "/api/roms/$romId/content/$encoded")
        log.info("romm", "download content", mapOf("romId" to romId, "file" to fileName))
        val response = httpClient.request(url) {
            this.method = HttpMethod.Get
            applyAuth()
        }
        if (!response.status.isSuccess()) {
            val text = response.bodyAsText()
            throw RommApiError("RomM GET /api/roms/$romId/content", response.status.value, text)
        }
        dev.rommdeck.shared.io.writeFileFromChannel(destPath, response.bodyAsChannel(), onProgress)
    }

    suspend fun getDevice(deviceId: String): RommDevice =
        parseDevice(requestJson("GET", "/api/devices/$deviceId"))

    suspend fun updateDevice(
        deviceId: String,
        name: String,
        syncMode: String,
        paths: Map<String, String>,
    ): RommDevice {
        val body = buildJsonObject {
            put("name", name)
            put("sync_mode", syncMode)
            put("sync_config", buildJsonObject {
                put("paths", rommJson.encodeToJsonElement(paths))
            })
        }
        return parseDevice(requestJson("PUT", "/api/devices/$deviceId", body = body.toString()))
    }

    suspend fun registerDevice(
        name: String,
        platform: String,
        hostname: String,
        syncMode: String,
        paths: Map<String, String>,
        allowDuplicate: Boolean = false,
        resetSyncs: Boolean = false,
    ): RommDevice {
        val body = buildJsonObject {
            put("name", name)
            put("platform", platform)
            put("hostname", hostname)
            put("sync_mode", syncMode)
            put("sync_config", buildJsonObject {
                put("paths", rommJson.encodeToJsonElement(paths))
            })
            put("paths", rommJson.encodeToJsonElement(paths))
            put("allow_duplicate", allowDuplicate)
            put("reset_syncs", resetSyncs)
        }
        return parseDevice(requestJson("POST", "/api/devices", body = body.toString()))
    }

    suspend fun negotiate(deviceId: String, saves: List<ClientSaveState>): NegotiateResponse {
        val body = buildJsonObject {
            put("device_id", deviceId)
            put("saves", rommJson.encodeToJsonElement(saves))
        }
        val raw = requestJson("POST", "/api/sync/negotiate", body = body.toString()).jsonObject
        val sessionId = jsonToString(raw["session_id"]) ?: ""
        val opsRaw = raw["operations"]?.jsonArray ?: JsonArray(emptyList())
        return NegotiateResponse(
            sessionId = sessionId,
            operations = opsRaw.map { normalizeSyncOperation(it.jsonObject) },
        )
    }

    suspend fun completeSession(sessionId: String, completed: Int, failed: Int) {
        val body = buildJsonObject {
            put("operations_completed", completed)
            put("operations_failed", failed)
            put("play_sessions", JsonArray(emptyList()))
        }
        requestJson(
            "POST",
            "/api/sync/sessions/$sessionId/complete",
            body = body.toString(),
            expectJson = false,
        )
    }

    suspend fun uploadSaveForSync(
        romId: Int,
        filePath: String,
        slot: String,
        emulator: String,
        deviceId: String,
        sessionId: String?,
        overwrite: Boolean = false,
    ) {
        val bytes = readFileBytes(filePath)
        val fileName = filePath.substringAfterLast('/').substringAfterLast('\\')
        val query = buildMap {
            put("rom_id", romId.toString())
            put("slot", slot)
            put("emulator", emulator)
            put("device_id", deviceId)
            if (!sessionId.isNullOrBlank()) put("session_id", sessionId)
            if (overwrite) put("overwrite", "true")
        }
        val url = buildUrl(baseUrl, "/api/saves", query)
        val response = httpClient.request(url) {
            method = HttpMethod.Post
            applyAuth()
            setBody(
                MultiPartFormDataContent(
                    formData {
                        append(
                            "saveFile",
                            bytes,
                            Headers.build {
                                append(HttpHeaders.ContentDisposition, "filename=\"$fileName\"")
                            },
                        )
                    },
                ),
            )
        }
        if (!response.status.isSuccess()) {
            throw RommApiError(
                "RomM POST /api/saves",
                response.status.value,
                response.bodyAsText(),
            )
        }
    }

    suspend fun downloadSaveContent(
        saveId: Int,
        destPath: String,
        deviceId: String? = null,
        sessionId: String? = null,
    ) {
        val query = buildMap {
            if (!deviceId.isNullOrBlank()) put("device_id", deviceId)
            if (!sessionId.isNullOrBlank()) put("session_id", sessionId)
        }
        val url = buildUrl(baseUrl, "/api/saves/$saveId/content", query)
        val response = httpClient.request(url) {
            method = HttpMethod.Get
            applyAuth()
        }
        if (!response.status.isSuccess()) {
            throw RommApiError(
                "RomM GET /api/saves/$saveId/content",
                response.status.value,
                response.bodyAsText(),
            )
        }
        dev.rommdeck.shared.io.writeFileFromChannel(destPath, response.bodyAsChannel())
    }

    suspend fun downloadAsset(source: String, destPath: String) {
        val url = normalizeUrl(baseUrl, source)
        val response = httpClient.request(url) {
            method = HttpMethod.Get
            applyAuth()
        }
        if (!response.status.isSuccess()) {
            throw RommApiError("Asset download", response.status.value, response.bodyAsText())
        }
        dev.rommdeck.shared.io.writeFileFromChannel(destPath, response.bodyAsChannel())
    }

    private suspend inline fun <reified T> requestList(path: String): List<T> =
        decodeList(requestJson("GET", path))

    private suspend fun requestJson(
        method: String,
        path: String,
        query: Map<String, String?> = emptyMap(),
        body: String? = null,
        expectJson: Boolean = true,
    ): JsonElement {
        val url = buildUrl(baseUrl, path, query)
        log.debug("romm", "$method $path", mapOf("url" to url))

        val response = httpClient.request(url) {
            this.method = HttpMethod.parse(method)
            applyAuth()
            if (body != null) {
                contentType(ContentType.Application.Json)
                setBody(body)
            }
        }

        val text = response.bodyAsText()
        if (!response.status.isSuccess()) {
            throw RommApiError("RomM $method $path", response.status.value, text)
        }
        if (!expectJson || text.isBlank()) {
            return JsonObject(emptyMap())
        }
        return rommJson.parseToJsonElement(text)
    }

    private fun HttpRequestBuilder.applyAuth() {
        header("Authorization", "Bearer $apiToken")
        header("Accept", "application/json")
    }

    private inline fun <reified T> decodeValue(element: JsonElement): T =
        rommJson.decodeFromJsonElement(element)

    private inline fun <reified T> decodeList(element: JsonElement): List<T> =
        when (element) {
            is JsonArray -> rommJson.decodeFromJsonElement(element)
            is JsonObject -> {
                val items = element["items"]
                if (items is JsonArray) rommJson.decodeFromJsonElement(items) else emptyList()
            }
            else -> emptyList()
        }

    private fun parseDevice(element: JsonElement): RommDevice {
        val obj = element.jsonObject
        val id = jsonToString(obj["id"] ?: obj["device_id"]) ?: error("device id missing")
        return RommDevice(
            id = id,
            name = jsonToString(obj["name"]) ?: "",
            platform = jsonToString(obj["platform"]),
            hostname = jsonToString(obj["hostname"]),
            syncMode = jsonToString(obj["sync_mode"]),
            paths = parseDevicePaths(obj),
        )
    }

    private fun parseDevicePaths(obj: JsonObject): Map<String, String> {
        val fromConfig = (obj["sync_config"] as? JsonObject)?.get("paths") as? JsonObject
        val fromTop = obj["paths"] as? JsonObject
        val nested = fromConfig ?: fromTop ?: return emptyMap()
        return buildMap {
            for ((key, value) in nested) {
                val text = jsonToString(value) ?: continue
                put(key, text)
            }
        }
    }

    private fun normalizeSyncOperation(raw: JsonObject): SyncOperation {
        val action = jsonToString(raw["action"] ?: raw["type"])
        val type = when (action) {
            "upload" -> SyncOpAction.UPLOAD
            "download" -> SyncOpAction.DOWNLOAD
            "conflict" -> SyncOpAction.CONFLICT
            "noop", "no_op" -> SyncOpAction.NO_OP
            else -> error("Unknown sync operation action: ${action ?: "(missing)"}")
        }
        val fileName = jsonToString(raw["file_name"] ?: raw["file"]) ?: ""
        return SyncOperation(
            type = type,
            romId = jsonToInt(raw["rom_id"]) ?: 0,
            file = fileName,
            fileName = fileName,
            saveId = jsonToInt(raw["save_id"]),
            slot = jsonToString(raw["slot"]),
            emulator = jsonToString(raw["emulator"]),
            destination = jsonToString(raw["destination"]),
            source = jsonToString(raw["source"]),
            destPath = jsonToString(raw["dest_path"]),
        )
    }

    private fun jsonToString(element: JsonElement?): String? {
        if (element == null || element is kotlinx.serialization.json.JsonNull) return null
        val primitive = element as? JsonPrimitive ?: return element.toString().trim('"')
        val content = primitive.content
        return content.ifBlank { null }
    }

    private fun jsonToInt(element: JsonElement?): Int? {
        val text = jsonToString(element) ?: return null
        return text.toIntOrNull()
    }
}

fun createRommClient(baseUrl: String, apiToken: String): RommClient =
    RommClient(baseUrl, apiToken)

fun createRommClient(config: RommConfig): RommClient =
    RommClient(config.baseUrl, config.apiToken)
