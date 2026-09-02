package dev.rommdeck.shared.sync

import dev.rommdeck.shared.romm.ClientSaveState
import dev.rommdeck.shared.romm.SyncOpAction
import dev.rommdeck.shared.romm.SyncOperation

data class SyncDiscoveryStats(
    val indexedRomFiles: Int,
    val retroArchRomFiles: Int,
    val skippedStandalonePlatforms: List<String>,
    val existingSaveFiles: Int,
)

data class NegotiatePayloadResult(
    val saves: List<ClientSaveState>,
    val discovery: SyncDiscoveryStats,
)

data class SyncOperationSummary(
    val upload: Int,
    val download: Int,
    val conflict: Int,
    val noOp: Int,
    val total: Int,
)

fun summarizeSyncOperations(operations: List<SyncOperation>): SyncOperationSummary {
    var upload = 0
    var download = 0
    var conflict = 0
    var noOp = 0
    for (op in operations) {
        when (op.type) {
            SyncOpAction.UPLOAD -> upload++
            SyncOpAction.DOWNLOAD -> download++
            SyncOpAction.CONFLICT -> conflict++
            SyncOpAction.NO_OP -> noOp++
        }
    }
    return SyncOperationSummary(
        upload = upload,
        download = download,
        conflict = conflict,
        noOp = noOp,
        total = operations.size,
    )
}
