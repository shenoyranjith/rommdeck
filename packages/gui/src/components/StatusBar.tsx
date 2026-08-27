import { useEffect, useState, type ReactNode } from "react";
import { getApi } from "../api";
import { IconCheck, IconClock, IconDatabase, IconSync, IconWarn } from "./icons";

interface DaemonStatus {
  running: boolean;
  lastSyncAt: string | null;
  lastResult: "ok" | "error" | "partial" | null;
  lastError: string | null;
  completedOps: number;
  failedOps: number;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function Stat({
  icon,
  label,
  value,
  valueClass = "text-accent",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="text-accent">{icon}</span>
      <span className="text-text/90">{label}</span>
      <span className={`font-mono ${valueClass}`}>{value}</span>
    </span>
  );
}

export function StatusBar() {
  const [status, setStatus] = useState<DaemonStatus | null>(null);
  const [queueLen, setQueueLen] = useState(0);

  useEffect(() => {
    const refresh = async () => {
      try {
        const s = (await getApi().daemonStatus()) as DaemonStatus;
        setStatus(s);
      } catch {
        /* ignore until API ready */
      }
      try {
        const jobs = (await getApi().listDownloads()) as { status: string }[];
        setQueueLen(
          jobs.filter(
            (j) =>
              j.status !== "done" &&
              j.status !== "error" &&
              j.status !== "cancelled",
          ).length,
        );
      } catch {
        /* ignore */
      }
    };
    void refresh();
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, []);

  const result = status?.lastResult;

  return (
    <footer className="flex shrink-0 flex-wrap items-center gap-x-7 gap-y-2 border border-accent bg-bg1/70 px-4 py-2.5 text-xs">
      <Stat
        icon={<IconDatabase className="size-3.5" />}
        label="Queue"
        value={String(queueLen)}
      />
      <Stat
        icon={<IconSync className="size-3.5" />}
        label="Daemon"
        value={status?.running ? "on" : "off"}
        valueClass={status?.running ? "text-ok" : "text-muted"}
      />
      <Stat
        icon={
          result === "error" ? (
            <IconWarn className="size-3.5 text-danger" />
          ) : (
            <IconCheck className="size-3.5" />
          )
        }
        label="Last sync"
        value={formatWhen(status?.lastSyncAt ?? null)}
      />
      <Stat
        icon={<IconClock className="size-3.5" />}
        label="Ops"
        value={`${status?.completedOps ?? 0} ok / ${status?.failedOps ?? 0} fail`}
      />
      {result && (
        <span className="font-mono tracking-wide text-accent uppercase">
          {result}
        </span>
      )}
      {status?.lastError && (
        <span
          className="min-w-0 flex-1 truncate text-danger"
          title={status.lastError}
        >
          {status.lastError}
        </span>
      )}
    </footer>
  );
}
