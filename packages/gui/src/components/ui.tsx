import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-wide text-text">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

export function Panel({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("overflow-hidden border border-line bg-bg0/50", className)}
    >
      {title && (
        <div className="border-b border-line px-3 py-2 text-[11px] font-semibold tracking-[0.12em] text-accent uppercase">
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="mb-3 flex flex-col gap-1.5 text-sm last:mb-0">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full border border-line bg-bg0 px-3 py-2 text-sm text-text outline-none placeholder:text-muted focus:border-accent";

export const selectClass = inputClass;

export const textareaClass = `${inputClass} font-mono text-xs leading-relaxed`;

export const btnClass =
  "border border-line bg-bg2 px-3 py-2 text-sm text-text transition-colors hover:border-accent/60 disabled:cursor-not-allowed disabled:opacity-40";

export const btnPrimaryClass =
  "border border-accent bg-accent px-3 py-2 text-sm font-semibold text-accent-fg disabled:cursor-not-allowed disabled:opacity-40";

export function Alert({
  tone,
  children,
}: {
  tone: "ok" | "err";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mb-4 border px-3 py-2 text-sm",
        tone === "ok"
          ? "border-ok/40 bg-bg2 text-ok"
          : "border-danger/40 bg-bg2 text-danger",
      )}
    >
      {children}
    </div>
  );
}
