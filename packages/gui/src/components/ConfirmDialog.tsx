import { useEffect, useRef } from "react";
import { cn } from "../lib/cn";
import { btnClass, btnPrimaryClass } from "./ui";
import { IconWarn } from "./icons";

export interface ConfirmDialogProps {
  title: string;
  message: string;
  /** Short note shown in a subtle inline alert (e.g. "RomM is not touched."). */
  hint?: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "warning" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  hint,
  detail,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const confirmClass =
    tone === "danger"
      ? "border border-danger/60 bg-danger/15 px-3 py-2 text-sm font-semibold text-danger transition-colors hover:border-danger hover:bg-danger/25"
      : tone === "warning"
        ? "border border-warn/60 bg-warn/15 px-3 py-2 text-sm font-semibold text-warn transition-colors hover:border-warn hover:bg-warn/25"
        : btnPrimaryClass;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="absolute inset-0 bg-bg0/80 backdrop-blur-[1px]"
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative w-full max-w-md border border-accent bg-bg1 shadow-[var(--glow)]"
      >
        <div className="flex items-start gap-3 px-4 py-3">
          {(tone === "warning" || tone === "danger") && (
            <IconWarn
              className={cn(
                "mt-0.5 size-5 shrink-0",
                tone === "danger" ? "text-danger" : "text-warn",
              )}
              aria-hidden
            />
          )}
          <div className="min-w-0 flex-1">
            <h2
              id="confirm-dialog-title"
              className="text-[11px] font-semibold tracking-[0.14em] text-accent uppercase"
            >
              {title}
            </h2>
            <p className="mt-2 text-sm leading-snug text-text">{message}</p>
            {hint && (
              <p className="mt-3 border border-accent/25 bg-bg0/70 px-2.5 py-2 text-xs leading-relaxed text-muted">
                {hint}
              </p>
            )}
            {detail && (
              <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-muted">
                {detail}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-accent/30 px-4 py-3">
          <button type="button" className={btnClass} ref={cancelRef} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={confirmClass} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
