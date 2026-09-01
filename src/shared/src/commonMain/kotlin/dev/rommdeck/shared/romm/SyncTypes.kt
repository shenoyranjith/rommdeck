package dev.rommdeck.shared.romm

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ClientSaveState(
    @SerialName("rom_id") val romId: Int,
    @SerialName("file_name") val fileName: String,
    val slot: String,
    val emulator: String,
    @SerialName("content_hash") val contentHash: String,
    @SerialName("updated_at") val updatedAt: String,
    @SerialName("file_size_bytes") val fileSizeBytes: Long,
)

@Serializable
data class RommDevice(
    val id: String,
    val name: String,
    val platform: String? = null,
    val hostname: String? = null,
    @SerialName("sync_mode") val syncMode: String? = null,
    val paths: Map<String, String> = emptyMap(),
)

enum class SyncOpAction { UPLOAD, DOWNLOAD, CONFLICT, NO_OP }

data class SyncOperation(
    val type: SyncOpAction,
    val romId: Int,
    val file: String,
    val fileName: String? = null,
    val saveId: Int? = null,
    val slot: String? = null,
    val emulator: String? = null,
    val destination: String? = null,
    val source: String? = null,
    val destPath: String? = null,
)

data class NegotiateResponse(
    val sessionId: String,
    val operations: List<SyncOperation>,
)
