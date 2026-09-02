package dev.rommdeck.desktop

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

enum class ConfirmTone { DEFAULT, WARNING, DANGER }

data class ConfirmRequest(
    val title: String,
    val message: String,
    val hint: String? = null,
    val detail: String? = null,
    val confirmLabel: String = "Confirm",
    val cancelLabel: String = "Cancel",
    val tone: ConfirmTone = ConfirmTone.DEFAULT,
)

@Stable
class ConfirmController {
    var request by mutableStateOf<ConfirmRequest?>(null)
        private set

    private var resolver: ((Boolean) -> Unit)? = null

    suspend fun ask(options: ConfirmRequest): Boolean = suspendCancellableCoroutine { cont ->
        resolver = { result ->
            if (cont.isActive) cont.resume(result)
        }
        request = options
        cont.invokeOnCancellation { cancel() }
    }

    fun respond(result: Boolean) {
        resolver?.invoke(result)
        resolver = null
        request = null
    }

    private fun cancel() {
        resolver = null
        request = null
    }
}

@Composable
fun ConfirmHost(controller: ConfirmController) {
    val request = controller.request ?: return
    RdConfirmDialog(
        request = request,
        onConfirm = { controller.respond(true) },
        onCancel = { controller.respond(false) },
    )
}

@Composable
fun RdConfirmDialog(
    request: ConfirmRequest,
    onConfirm: () -> Unit,
    onCancel: () -> Unit,
) {
    val c = Rd
    Box(
        Modifier
            .fillMaxSize()
            .zIndex(100f)
            .background(c.bg0.copy(alpha = 0.8f))
            .rdInteractive(onClick = onCancel),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier
                .widthIn(max = 420.dp)
                .padding(16.dp)
                .border(1.dp, c.accent, RectangleShape)
                .background(c.bg1, RectangleShape)
                .rdInteractive(onClick = {})
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (request.tone != ConfirmTone.DEFAULT) {
                    RdIcon(
                        RdIconKind.WARN,
                        when (request.tone) {
                            ConfirmTone.DANGER -> c.danger
                            ConfirmTone.WARNING -> c.warn
                            ConfirmTone.DEFAULT -> c.accent
                        },
                        20.dp,
                    )
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        request.title.uppercase(),
                        color = c.accent,
                        style = RdType.micro.copy(fontWeight = FontWeight.SemiBold),
                    )
                    Text(request.message, color = c.text, style = RdType.body)
                    request.hint?.let { hint ->
                        Text(
                            hint,
                            color = c.muted,
                            style = RdType.small,
                            modifier = Modifier
                                .fillMaxWidth()
                                .border(1.dp, c.accent.copy(alpha = 0.25f), RectangleShape)
                                .background(c.bg0.copy(alpha = 0.7f), RectangleShape)
                                .padding(horizontal = 10.dp, vertical = 8.dp),
                        )
                    }
                    request.detail?.let { detail ->
                        Text(detail, color = c.muted, style = RdType.small)
                    }
                }
            }
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                RdButton(onClick = onCancel) {
                    Text(" ${request.cancelLabel} ", style = RdType.small)
                }
                RdButton(
                    onClick = onConfirm,
                    primary = request.tone == ConfirmTone.DEFAULT,
                    danger = request.tone == ConfirmTone.DANGER,
                    modifier = Modifier.padding(start = 8.dp),
                ) {
                    Text(
                        request.confirmLabel,
                        fontWeight = FontWeight.SemiBold,
                        color = when (request.tone) {
                            ConfirmTone.DANGER -> LocalContentColor.current
                            ConfirmTone.WARNING -> c.warn
                            ConfirmTone.DEFAULT -> LocalContentColor.current
                        },
                    )
                }
            }
        }
    }
}

suspend fun ConfirmController.confirmDeleteLocal(message: String): Boolean = ask(
    ConfirmRequest(
        title = "Delete local files",
        message = message,
        hint = "RomM is not touched.",
        confirmLabel = "Delete",
        cancelLabel = "Cancel",
        tone = ConfirmTone.DANGER,
    ),
)

