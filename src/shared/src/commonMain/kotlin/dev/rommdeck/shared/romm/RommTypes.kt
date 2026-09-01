package dev.rommdeck.shared.romm

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class RommPlatform(
    val id: Int,
    val name: String,
    val slug: String,
    @SerialName("fs_slug") val fsSlug: String? = null,
    @SerialName("rom_count") val romCount: Int? = null,
    @SerialName("custom_name") val customName: String? = null,
    @SerialName("display_name") val displayName: String? = null,
    @SerialName("url_logo") val urlLogo: String? = null,
    @SerialName("logo_path") val logoPath: String? = null,
)

@Serializable
data class RommRomFile(
    @SerialName("file_name") val fileName: String,
    @SerialName("file_size_bytes") val fileSizeBytes: Long? = null,
)

@Serializable
data class RommMetadatum(
    val genres: List<String>? = null,
    val developers: List<String>? = null,
    val publishers: List<String>? = null,
    val companies: List<String>? = null,
    @SerialName("game_modes") val gameModes: List<String>? = null,
    @SerialName("first_release_date") val firstReleaseDate: Long? = null,
)

@Serializable
data class RommRom(
    val id: Int,
    val name: String,
    val slug: String? = null,
    @SerialName("fs_name") val fsName: String? = null,
    @SerialName("fs_extension") val fsExtension: String? = null,
    @SerialName("fs_size_bytes") val fsSizeBytes: Long? = null,
    @SerialName("platform_id") val platformId: Int? = null,
    @SerialName("platform_slug") val platformSlug: String? = null,
    @SerialName("platform_name") val platformName: String? = null,
    val summary: String? = null,
    @SerialName("path_cover_small") val pathCoverSmall: String? = null,
    @SerialName("path_cover_large") val pathCoverLarge: String? = null,
    @SerialName("url_cover") val urlCover: String? = null,
    val files: List<RommRomFile>? = null,
    val metadatum: RommMetadatum? = null,
    @SerialName("igdb_metadata") val igdbMetadata: RommMetadatum? = null,
    @SerialName("ss_metadata") val ssMetadata: RommMetadatum? = null,
    @SerialName("moby_metadata") val mobyMetadata: RommMetadatum? = null,
    @SerialName("launchbox_metadata") val launchboxMetadata: RommMetadatum? = null,
    @SerialName("generated_first_release_date") val generatedFirstReleaseDate: Long? = null,
    @SerialName("generated_player_count") val generatedPlayerCount: String? = null,
)

fun RommRom.contentFilenames(): List<String> {
    val fromFiles = files?.map { it.fileName }.orEmpty()
    if (fromFiles.isNotEmpty()) return fromFiles
    val name = fsName
    return if (!name.isNullOrBlank()) listOf(name) else emptyList()
}

data class RommRomPage(
    val items: List<RommRom>,
    val total: Int,
)

data class ConnectionTestResult(
    val ok: Boolean,
    val platformCount: Int? = null,
    val error: String? = null,
)
