package dev.rommdeck.shared.config

import dev.rommdeck.shared.romm.SyncOpAction

/** RomM device registration accepts `api`, `file_transfer`, or `push_pull`. Direction is enforced locally. */
fun SyncMode.toRommApiSyncMode(): String = when (this) {
    SyncMode.PUSH_PULL -> "push_pull"
    SyncMode.PULL_ONLY, SyncMode.PUSH_ONLY -> "api"
}

fun SyncMode.allowsSyncOp(type: SyncOpAction): Boolean = when (type) {
    SyncOpAction.UPLOAD -> this != SyncMode.PULL_ONLY
    SyncOpAction.DOWNLOAD -> this != SyncMode.PUSH_ONLY
    SyncOpAction.CONFLICT, SyncOpAction.NO_OP -> true
}

fun SyncMode.allowsUpload(): Boolean = this != SyncMode.PULL_ONLY

fun SyncMode.allowsDownload(): Boolean = this != SyncMode.PUSH_ONLY

/** Map config/API strings to values RomM accepts on device registration. */
fun normalizeRommApiSyncMode(syncMode: String): String = when (syncMode) {
    "pull_only", "push_only" -> "api"
    "push_pull", "api", "file_transfer" -> syncMode
    else -> "api"
}
