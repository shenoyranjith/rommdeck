package dev.rommdeck.shared.esde

data class GamelistGame(
    val path: String,
    val name: String? = null,
    val desc: String? = null,
    val releasedate: String? = null,
    val developer: String? = null,
    val publisher: String? = null,
    val genre: String? = null,
    val players: String? = null,
)

fun gamelistPathForRom(filename: String): String {
    val trimmed = filename.removePrefix("./")
    return "./$trimmed"
}

internal fun normalizeGamelistPath(path: String): String =
    gamelistPathForRom(path.removePrefix("./"))

fun parseGamelistXml(content: String): List<GamelistGame> {
    val games = mutableListOf<GamelistGame>()
    val gameRe = Regex("<game>([\\s\\S]*?)</game>")
    for (match in gameRe.findAll(content)) {
        val block = match.groupValues[1]
        val path = readTag(block, "path") ?: continue
        games += GamelistGame(
            path = path,
            name = readTag(block, "name"),
            desc = readTag(block, "desc"),
            releasedate = readTag(block, "releasedate"),
            developer = readTag(block, "developer"),
            publisher = readTag(block, "publisher"),
            genre = readTag(block, "genre"),
            players = readTag(block, "players"),
        )
    }
    return games
}

fun serializeGamelistXml(games: List<GamelistGame>): String {
    val sorted = games.sortedBy { it.path }
    val body = sorted.joinToString("") { serializeGame(it) }
    return "<?xml version=\"1.0\"?>\n<gameList>\n$body</gameList>\n"
}

fun upsertGamelistGames(existingXml: String, game: GamelistGame): String {
    val target = normalizeGamelistPath(game.path)
    val games = parseGamelistXml(existingXml)
        .filter { normalizeGamelistPath(it.path) != target }
        .toMutableList()
    games += game.copy(path = target)
    return serializeGamelistXml(games)
}

fun removeGamelistGame(existingXml: String, romPath: String): String? {
    val target = normalizeGamelistPath(gamelistPathForRom(romPath.removePrefix("./")))
    val games = parseGamelistXml(existingXml)
    val next = games.filter { normalizeGamelistPath(it.path) != target }
    if (next.size == games.size) return null
    return if (next.isEmpty()) {
        "<?xml version=\"1.0\"?>\n<gameList>\n</gameList>\n"
    } else {
        serializeGamelistXml(next)
    }
}

fun hasGamelistEntry(content: String, romFilename: String): Boolean {
    val target = normalizeGamelistPath(gamelistPathForRom(romFilename))
    return parseGamelistXml(content).any { normalizeGamelistPath(it.path) == target }
}

private fun serializeGame(game: GamelistGame): String {
    val tags = buildString {
        append(writeTag("path", game.path))
        append(writeTag("name", game.name))
        append(writeTag("desc", game.desc))
        append(writeTag("releasedate", game.releasedate))
        append(writeTag("developer", game.developer))
        append(writeTag("publisher", game.publisher))
        append(writeTag("genre", game.genre))
        append(writeTag("players", game.players))
    }
    return "  <game>\n$tags  </game>\n"
}

private fun readTag(block: String, tag: String): String? {
    val re = Regex("<$tag>([\\s\\S]*?)</$tag>")
    val match = re.find(block) ?: return null
    return unescapeXml(match.groupValues[1].trim())
}

private fun writeTag(tag: String, value: String?): String {
    if (value.isNullOrEmpty()) return ""
    return "    <$tag>${escapeXml(value)}</$tag>\n"
}

private fun escapeXml(value: String): String =
    value
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&apos;")

private fun unescapeXml(value: String): String =
    value
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&amp;", "&")
