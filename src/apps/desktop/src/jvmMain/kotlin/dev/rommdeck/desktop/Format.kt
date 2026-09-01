package dev.rommdeck.desktop

fun formatBytes(n: Long?): String {
    if (n == null || n < 0) return "—"
    if (n < 1024) return "$n B"
    val units = arrayOf("KB", "MB", "GB", "TB")
    var v = n.toDouble()
    var i = -1
    do {
        v /= 1024.0
        i++
    } while (v >= 1024 && i < units.lastIndex)
    val shown = if (v < 10 && i > 0) "%.1f".format(v) else "${v.toLong()}"
    return "$shown ${units[i]}"
}

fun formatWhen(iso: String?): String {
    if (iso.isNullOrBlank()) return "—"
    return iso.replace('T', ' ').removeSuffix("Z")
}

fun formatCount(n: Int): String = n.toString()

fun formatWithPct(count: Int, total: Int): String {
    if (total <= 0) return formatCount(count)
    val pct = kotlin.math.round(count * 100f / total).toInt()
    return "${formatCount(count)} ($pct%)"
}
