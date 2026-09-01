package dev.rommdeck.shared.romm

class RommApiError(
    message: String,
    val status: Int,
    body: String? = null,
) : Exception(formatMessage(message, status, body)) {
    val body: String? = body

    companion object {
        private fun formatMessage(prefix: String, status: Int, body: String?): String {
            val detail = formatDetail(body)
            return "$prefix failed ($status)$detail"
        }

        private fun formatDetail(body: String?): String {
            if (body.isNullOrBlank()) return ""
            val trimmed = body.trim()
            return if (trimmed.length > 500) ": ${trimmed.take(500)}…" else ": $trimmed"
        }
    }
}
