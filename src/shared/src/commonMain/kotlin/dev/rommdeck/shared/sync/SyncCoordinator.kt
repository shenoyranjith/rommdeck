package dev.rommdeck.shared.sync

import dev.rommdeck.shared.config.ConflictPolicy
import dev.rommdeck.shared.db.LibraryIndex
import dev.rommdeck.shared.io.fileExists
import dev.rommdeck.shared.io.fileMtimeIso
import dev.rommdeck.shared.io.fileSizeBytes
import dev.rommdeck.shared.io.md5Hex
import dev.rommdeck.shared.log.log
import dev.rommdeck.shared.romm.ClientSaveState
import dev.rommdeck.shared.romm.RommClient
import dev.rommdeck.shared.romm.SyncOpAction
import dev.rommdeck.shared.romm.SyncOperation

data class SyncResult(
    val sessionId: String?,
    val completed: Int,
    val failed: Int,
    val conflicts: List<SyncOperation>,
    val errors: List<String>,
    val localSaves: Int,
    val operations: List<SyncOperation> = emptyList(),
    val discovery: SyncDiscoveryStats? = null,
    val deviceRegistered: Boolean = false,
    val deviceUpdated: Boolean = false,
)

suspend fun runSyncSession(
    client: RommClient,
    index: LibraryIndex,
    deviceId: String,
    paths: SyncPaths,
    conflictPolicy: ConflictPolicy,
    unattended: Boolean,
): SyncResult {
    val payload = buildNegotiatePayload(index, paths)
    val saves = payload.saves
    log.info("sync", "negotiate start", mapOf("deviceId" to deviceId, "localSaves" to saves.size))
    val negotiated = client.negotiate(deviceId, saves)
    log.info("sync", "negotiate complete", mapOf("sessionId" to negotiated.sessionId, "ops" to negotiated.operations.size))

    var completed = 0
    var failed = 0
    val conflicts = mutableListOf<SyncOperation>()
    val errors = mutableListOf<String>()

    for (op in negotiated.operations) {
        try {
            when (op.type) {
                SyncOpAction.NO_OP -> completed++
                SyncOpAction.CONFLICT -> {
                    if (!unattended) {
                        conflicts += op
                    } else {
                        applyConflictPolicy(client, index, paths, op, conflictPolicy, deviceId, negotiated.sessionId)
                        completed++
                    }
                }
                SyncOpAction.UPLOAD -> {
                    val local = findLocalSaveFile(index, paths, op)
                        ?: error("Local file not found for upload: ${op.file}")
                    uploadOp(client, op, local, deviceId, negotiated.sessionId, overwrite = false)
                    completed++
                }
                SyncOpAction.DOWNLOAD -> {
                    downloadOp(client, index, paths, op, deviceId, negotiated.sessionId)
                    completed++
                }
            }
        } catch (e: Exception) {
            failed++
            val msg = e.message ?: e.toString()
            log.error("sync", "${op.type} failed", mapOf("file" to op.file, "error" to msg))
            errors += "${op.type} ${op.file}: $msg"
        }
    }

    if (negotiated.sessionId.isNotBlank()) {
        try {
            client.completeSession(negotiated.sessionId, completed, failed)
        } catch (e: Exception) {
            errors += "complete: ${e.message ?: e.toString()}"
        }
    }

    return SyncResult(
        sessionId = negotiated.sessionId.ifBlank { null },
        completed = completed,
        failed = failed,
        conflicts = conflicts,
        errors = errors,
        localSaves = saves.size,
        operations = negotiated.operations,
        discovery = payload.discovery,
    )
}

fun buildNegotiatePayload(index: LibraryIndex, paths: SyncPaths): NegotiatePayloadResult {
    val indexed = uniqueIndexedRomFiles(index.getAll())
    val skippedStandalonePlatforms = linkedSetOf<String>()
    var retroArchRomFiles = 0
    val saves = mutableListOf<ClientSaveState>()
    for (row in indexed) {
        val expected = resolveExpectedSavePaths(row, paths.savesPath, paths.statesPath)
        if (expected.isEmpty()) {
            skippedStandalonePlatforms.add(row.esdeFolder)
            continue
        }
        retroArchRomFiles++
        for (candidate in expected) {
            if (!fileExists(candidate.absolutePath)) continue
            try {
                saves += ClientSaveState(
                    romId = candidate.romId,
                    fileName = candidate.fileName,
                    slot = candidate.slot,
                    emulator = candidate.emulator,
                    contentHash = md5Hex(candidate.absolutePath),
                    updatedAt = fileMtimeIso(candidate.absolutePath),
                    fileSizeBytes = fileSizeBytes(candidate.absolutePath),
                )
            } catch (_: Exception) {
                // skip unreadable files
            }
        }
    }
    return NegotiatePayloadResult(
        saves = saves,
        discovery = SyncDiscoveryStats(
            indexedRomFiles = indexed.size,
            retroArchRomFiles = retroArchRomFiles,
            skippedStandalonePlatforms = skippedStandalonePlatforms.sorted(),
            existingSaveFiles = saves.size,
        ),
    )
}

private suspend fun uploadOp(
    client: RommClient,
    op: SyncOperation,
    localPath: String,
    deviceId: String,
    sessionId: String,
    overwrite: Boolean,
) {
    client.uploadSaveForSync(
        romId = op.romId,
        filePath = localPath,
        slot = op.slot ?: slotForSaveFileName(op.file),
        emulator = op.emulator ?: "retroarch",
        deviceId = deviceId,
        sessionId = sessionId.ifBlank { null },
        overwrite = overwrite,
    )
}

private suspend fun downloadOp(
    client: RommClient,
    index: LibraryIndex,
    paths: SyncPaths,
    op: SyncOperation,
    deviceId: String,
    sessionId: String,
) {
    val dest = resolveDownloadDest(index, paths, op)
    when {
        op.saveId != null -> client.downloadSaveContent(op.saveId, dest, deviceId, sessionId.ifBlank { null })
        !op.source.isNullOrBlank() -> client.downloadAsset(op.source, dest)
        else -> error("Download op missing save_id and source")
    }
}

private suspend fun applyConflictPolicy(
    client: RommClient,
    index: LibraryIndex,
    paths: SyncPaths,
    op: SyncOperation,
    policy: ConflictPolicy,
    deviceId: String,
    sessionId: String,
) {
    if (policy == ConflictPolicy.DEVICE_WINS || policy == ConflictPolicy.KEEP_BOTH) {
        val local = findLocalSaveFile(index, paths, op)
            ?: error("Local file not found for conflict upload: ${op.file}")
        uploadOp(client, op, local, deviceId, sessionId, overwrite = policy == ConflictPolicy.DEVICE_WINS)
    }
    if (policy == ConflictPolicy.SERVER_WINS) {
        downloadOp(client, index, paths, op, deviceId, sessionId)
    }
}

private fun esdeFolderForRom(index: LibraryIndex, romId: Int): String? =
    index.getByRomId(romId).firstOrNull()?.esdeFolder

private fun localFileNameForOperation(index: LibraryIndex, op: SyncOperation): String {
    val rows = index.getByRomId(op.romId)
    val serverName = op.fileName ?: op.file
    val first = rows.firstOrNull()
    return if (first != null) resolveLocalSaveFileName(first.filename, serverName) else untagSaveFileName(serverName)
}

private fun findLocalSaveFile(index: LibraryIndex, paths: SyncPaths, op: SyncOperation): String? {
    val esdeFolder = esdeFolderForRom(index, op.romId)
    val fileName = localFileNameForOperation(index, op)
    if (esdeFolder != null) {
        val canonical = resolveLocalSavePath(paths.savesPath, paths.statesPath, esdeFolder, fileName)
        if (fileExists(canonical)) return canonical
    }
    return null
}

private fun resolveDownloadDest(index: LibraryIndex, paths: SyncPaths, op: SyncOperation): String {
    val esdeFolder = esdeFolderForRom(index, op.romId)
    val fileName = localFileNameForOperation(index, op)
    if (esdeFolder != null) {
        return resolveLocalSavePath(paths.savesPath, paths.statesPath, esdeFolder, fileName)
    }
    if (!op.destPath.isNullOrBlank()) return op.destPath
    val root = if (isStateFileName(fileName)) paths.statesPath else paths.savesPath
    return dev.rommdeck.shared.io.joinPath(root, fileName)
}
