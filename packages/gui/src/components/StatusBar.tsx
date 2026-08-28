import { Fragment, useCallback, useEffect, useState, type ReactNode } from "react";
import { getApi } from "../api";
import { formatBytes } from "../pages/library/format";
import { onInventoryChange } from "../pages/library/romCache";
import {
  IconCircleCheck,
  IconClock,
  IconDatabase,
  IconHardDrive,
  IconSync,
  IconWarn,
} from "./icons";

interface DaemonStatus {
  running: boolean;
  lastSyncAt: string | null;
  lastResult: "ok" | "error" | "partial" | null;
  lastError: string | null;
}

interface LibraryStats {
  downloadedRoms: number;
  storageBytes: number;
}

const STATUS_GRID =
  "minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr)";

/** Scales with the status bar’s own width (container queries). */
const ICON_CLASS =
  "size-6 @[56rem]:size-8 @[80rem]:size-10";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatCount(n: number): string {
  return n.toLocaleString();
}

function formatWithPct(count: number, total: number): string {
  if (total <= 0) return formatCount(count);
  const pct = Math.round((count / total) * 100);
  return `${formatCount(count)} (${pct}%)`;
}

function scanStatusLabel(status: DaemonStatus | null): string {
  if (!status) return "—";
  if (status.running) return "Running";
  switch (status.lastResult) {
    case "ok":
      return "Complete";
    case "error":
      return "Error";
    case "partial":
      return "Partial";
    default:
      return "Idle";
  }
}

function StatDivider() {
  return (
    <div className="flex items-center self-stretch px-2 @[56rem]:px-3 @[80rem]:px-4">
      <div className="h-1/2 w-px bg-accent" aria-hidden />
    </div>
  );
}

function StatCell({
  icon,
  label,
  value,
  title,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div
      className="flex min-w-0 items-center justify-start gap-2 px-2 py-2 @[56rem]:gap-3 @[56rem]:px-3 @[56rem]:py-2.5 @[80rem]:px-4"
      title={title}
    >
      <span className="shrink-0 text-accent">{icon}</span>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-xs text-text @[56rem]:text-sm @[80rem]:text-base">
          {label}
        </div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-accent @[56rem]:text-xs @[80rem]:text-sm">
          {value}
        </div>
      </div>
    </div>
  );
}

export function StatusBar() {
  const [status, setStatus] = useState<DaemonStatus | null>(null);
  const [totalRoms, setTotalRoms] = useState(0);
  const [stats, setStats] = useState<LibraryStats>({
    downloadedRoms: 0,
    storageBytes: 0,
  });

  const refreshStats = useCallback(async () => {
    try {
      setStats(await getApi().getLibraryStats());
    } catch {
      /* ignore until index ready */
    }
  }, []);

  useEffect(() => {
    const refresh = async () => {
      try {
        const platforms = (await getApi().getPlatforms()) as {
          rom_count?: number;
        }[];
        setTotalRoms(
          platforms.reduce((sum, p) => sum + (p.rom_count ?? 0), 0),
        );
      } catch {
        /* ignore until API ready */
      }
      await refreshStats();
      try {
        setStatus((await getApi().daemonStatus()) as DaemonStatus);
      } catch {
        /* ignore */
      }
    };
    void refresh();
    const t = setInterval(() => void refresh(), 5000);

    let offJob = () => {};
    let offInventory = () => {};
    try {
      offJob = getApi().onDownloadJob((job) => {
        if ((job as { status: string }).status === "done") void refreshStats();
      });
      offInventory = onInventoryChange(() => void refreshStats());
    } catch {
      /* browser / no bridge */
    }

    return () => {
      clearInterval(t);
      offJob();
      offInventory();
    };
  }, [refreshStats]);

  const downloaded = stats.downloadedRoms;
  const missing = Math.max(0, totalRoms - downloaded);
  const scanLabel = scanStatusLabel(status);

  const cells = [
    {
      icon: <IconDatabase className={ICON_CLASS} strokeWidth={2.15} />,
      label: "Total ROMs",
      value: formatCount(totalRoms),
    },
    {
      icon: <IconCircleCheck className={ICON_CLASS} strokeWidth={2.15} />,
      label: "Downloaded",
      value: formatWithPct(downloaded, totalRoms),
    },
    {
      icon: <IconWarn className={ICON_CLASS} strokeWidth={2.15} />,
      label: "Missing",
      value: formatWithPct(missing, totalRoms),
    },
    {
      icon: <IconHardDrive className={ICON_CLASS} strokeWidth={2.15} />,
      label: "Storage Used",
      value: formatBytes(stats.storageBytes),
    },
    {
      icon: <IconClock className={ICON_CLASS} strokeWidth={2.15} />,
      label: "Last Scan",
      value: formatWhen(status?.lastSyncAt ?? null),
    },
    {
      icon: <IconSync className={ICON_CLASS} strokeWidth={2.15} />,
      label: "Scan Status",
      value: scanLabel,
      title: status?.lastError ?? undefined,
    },
  ];

  return (
    <footer
      className="@container grid shrink-0 overflow-hidden border border-accent bg-bg0/60 text-xs"
      style={{ gridTemplateColumns: STATUS_GRID }}
    >
      {cells.map((cell, index) => (
        <Fragment key={cell.label}>
          {index > 0 && <StatDivider />}
          <StatCell {...cell} />
        </Fragment>
      ))}
    </footer>
  );
}
