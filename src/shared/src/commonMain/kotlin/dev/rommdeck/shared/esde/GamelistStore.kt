package dev.rommdeck.shared.esde

import dev.rommdeck.shared.io.readUtf8File
import dev.rommdeck.shared.io.writeUtf8File

fun upsertGamelistGame(filePath: String, game: GamelistGame) {
    val existing = readUtf8File(filePath).orEmpty()
    writeUtf8File(filePath, upsertGamelistGames(existing, game))
}
