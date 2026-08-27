import { memo } from "react";
import { getApi } from "../../api";
import { cn } from "../../lib/cn";
import {
  IconClock,
  IconClose,
  IconDatabase,
  IconDownloads,
  IconWarn,
} from "../../components/icons";
import { formatBytes } from "../library/format";
import type { DownloadJob } from "./useDownloadQueue";

function jobProgressPct(job: DownloadJob): number {
  if (job.status === "metadata") return 100;
  if (job.totalBytes && job.totalBytes > 0) {
    return Math.min(100, Math.round((job.progressBytes / job.totalBytes) * 100));
  }
  return 0;
}

export const DownloadRow = memo(function DownloadRow({ job }: { job: DownloadJob }) {
  const isDownloading = job.status === "downloading";
  const isQueued = job.status === "queued";
  const isMetadata = job.status === "metadata";
  const pct = jobProgressPct(job);
  const canCancel = isDownloading || isQueued || isMetadata;
  const cover = job.coverUrl;

  return (
    <div className="flex min-h-[4.5rem] flex-col gap-2 border-b border-accent/40 px-3 py-3 last:border-b-0 @[48rem]:flex-row @[48rem]:items-center @[48rem]:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="size-11 shrink-0 overflow-hidden border border-accent/70 bg-bg0 @[48rem]:size-12">
          {cover ? (
            <img
              src={cover}
              alt=""
              decoding="async"
              draggable={false}
              className="h-full w-full object-fill"
            />
          ) : (
            <div className="grid h-full place-items-center text-accent/70" aria-hidden>
              <IconWarn className="size-4" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-sm font-medium text-text">{job.romName}</div>
          <div className="mt-0.5 truncate font-mono text-xs text-accent">{job.rommSlug}</div>
        </div>
        <span
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1.5 border px-2.5 text-[10px] font-semibold tracking-wide uppercase",
            isDownloading && "border-accent/70 text-accent",
            isMetadata && "border-accent/50 text-accent",
            isQueued && "border-warn/60 text-warn",
          )}
        >
          {isMetadata ? (
            <IconDatabase className="size-3.5" />
          ) : isDownloading ? (
            <IconDownloads className="size-3.5" />
          ) : (
            <IconClock className="size-3.5" />
          )}
          {isMetadata ? "Metadata" : isDownloading ? "Downloading" : "Queued"}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3 @[48rem]:max-w-md">
        <div className="min-w-0 flex-1">
          <div className="h-2 overflow-hidden border border-accent/40 bg-bg0">
            <div
              className={cn(
                "h-full bg-accent transition-[width] duration-200",
                isMetadata && "animate-pulse",
              )}
              style={{
                width: `${pct}%`,
                boxShadow:
                  (isDownloading && pct > 0) || isMetadata ? "var(--glow)" : undefined,
              }}
            />
          </div>
          <div className="mt-1 font-mono text-[11px] text-muted">
            {isMetadata
              ? "Writing ES-DE metadata…"
              : `${formatBytes(job.progressBytes)}${
                  job.totalBytes != null ? ` / ${formatBytes(job.totalBytes)}` : ""
                }`}
          </div>
        </div>
        {canCancel && (
          <button
            type="button"
            className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 border border-accent/70 bg-bg2 px-2.5 text-xs font-medium text-accent transition-colors hover:border-accent hover:bg-accent/10"
            onClick={() => void getApi().cancelDownload(job.id)}
          >
            <IconClose className="size-3.5" />
            Cancel
          </button>
        )}
      </div>
    </div>
  );
});
