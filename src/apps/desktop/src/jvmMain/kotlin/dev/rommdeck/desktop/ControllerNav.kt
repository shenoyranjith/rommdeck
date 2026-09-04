package dev.rommdeck.desktop

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusManager
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isShiftPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.type

/**
 * Controller / keyboard navigation for the desktop shell.
 *
 * Works with physical keyboards, Steam Input keyboard layouts, and gamepad
 * buttons when the OS delivers them as key events (Gamepad* keys).
 *
 * Mapping (Xbox / Deck conventions):
 * - LB / RB (or PageUp / PageDown): previous / next main tab
 * - D-pad / arrows: move focus
 * - A / Enter: activate focused control (Compose default) or confirm dialog
 * - B / Escape: cancel dialog / clear focus from text field
 */
enum class ControllerAction {
    PrevTab,
    NextTab,
    Confirm,
    Back,
    FocusUp,
    FocusDown,
    FocusLeft,
    FocusRight,
}

@Stable
class TextInputFocusTracker {
    var depth by mutableIntStateOf(0)
        private set

    val active: Boolean get() = depth > 0

    fun enter() {
        depth++
    }

    fun exit() {
        if (depth > 0) depth--
    }
}

val LocalTextInputFocus = compositionLocalOf { TextInputFocusTracker() }

@Composable
fun TrackTextInputFocus(focused: Boolean) {
    val tracker = LocalTextInputFocus.current
    DisposableEffect(focused) {
        if (focused) tracker.enter()
        onDispose {
            if (focused) tracker.exit()
        }
    }
}

fun KeyEvent.toControllerAction(textInputActive: Boolean): ControllerAction? {
    if (type != KeyEventType.KeyDown) return null
    return when (key) {
        Key.ButtonL1, Key.PageUp, Key.NavigatePrevious -> ControllerAction.PrevTab
        Key.ButtonR1, Key.PageDown, Key.NavigateNext -> ControllerAction.NextTab
        Key.ButtonA, Key.DirectionCenter, Key.Enter, Key.NumPadEnter -> ControllerAction.Confirm
        Key.ButtonB, Key.Escape, Key.Back -> ControllerAction.Back
        Key.DirectionUp ->
            if (textInputActive) null else ControllerAction.FocusUp
        Key.DirectionDown ->
            if (textInputActive) null else ControllerAction.FocusDown
        Key.DirectionLeft ->
            if (textInputActive) null else ControllerAction.FocusLeft
        Key.DirectionRight ->
            if (textInputActive) null else ControllerAction.FocusRight
        Key.Tab ->
            if (textInputActive) {
                null
            } else if (isShiftPressed) {
                ControllerAction.FocusUp
            } else {
                ControllerAction.FocusDown
            }
        else -> null
    }
}

fun cycleNavTab(current: NavTab, delta: Int): NavTab {
    val tabs = NavTab.entries
    val index = tabs.indexOf(current)
    val next = (index + delta).mod(tabs.size)
    return tabs[next]
}

/**
 * @return true if the event was consumed
 */
fun handleControllerKey(
    event: KeyEvent,
    textInputActive: Boolean,
    dialogOpen: Boolean,
    focusManager: FocusManager,
    onPrevTab: () -> Unit,
    onNextTab: () -> Unit,
    onDialogConfirm: () -> Unit,
    onDialogCancel: () -> Unit,
): Boolean {
    val action = event.toControllerAction(textInputActive) ?: return false
    return when (action) {
        ControllerAction.PrevTab -> {
            onPrevTab()
            true
        }
        ControllerAction.NextTab -> {
            onNextTab()
            true
        }
        ControllerAction.Confirm -> {
            if (dialogOpen) {
                onDialogConfirm()
                true
            } else {
                // Let the focused clickable receive Enter / GamepadA.
                false
            }
        }
        ControllerAction.Back -> {
            when {
                dialogOpen -> {
                    onDialogCancel()
                    true
                }
                textInputActive -> {
                    focusManager.clearFocus(force = true)
                    true
                }
                else -> false
            }
        }
        ControllerAction.FocusUp -> focusManager.moveFocus(FocusDirection.Up)
        ControllerAction.FocusDown -> focusManager.moveFocus(FocusDirection.Down)
        ControllerAction.FocusLeft -> focusManager.moveFocus(FocusDirection.Left)
        ControllerAction.FocusRight -> focusManager.moveFocus(FocusDirection.Right)
    }
}
