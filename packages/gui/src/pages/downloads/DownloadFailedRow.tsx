import { memo } from "react";
import { getApi } from "../../api";
import { cn } from "../../lib/cn";
import { IconClose, IconSync, IconWarn } from "../../components/icons";
import type { DownloadJob } from "./useDownloadQueue";

const rowActionClass =
  "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 border px-2.5 text-xs font-medium transition-colors";

export const DownloadFailedRow = memo(function DownloadFailedRow({
  job,
}: {
  job: DownloadJob;
}) {
  const cover = job.coverUrl;

  return (
    <div className="flex min-h-[4.5rem] flex-col gap-2 border-b border-danger/30 px-3 py-3 last:border-b-0 @[48rem]:flex-row @[48rem]:items-center @[48rem]:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="size-11 shrink-0 overflow-hidden border border-danger/40 bg-bg0 @[48rem]:size-12">
          {cover ? (
            <img
              src={cover}
              alt=""
              decoding="async"
              draggable={false}
              className="h-full w-full object-fill opacity-80"
            />
          ) : (
            <div className="grid h-full place-items-center text-danger/70" aria-hidden>
              <IconWarn className="size-4" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-sm font-medium text-text">{job.romName}</div>
          <div className="mt-0.5 truncate font-mono text-xs text-accent">{job.rommSlug}</div>
          {job.error && (
            <div className="mt-1 line-clamp-2 text-[11px] text-danger">{job.error}</div>
          )}
        </div>
        <span className="inline-flex h-8 shrink-0 items-center gap-1.5 border border-danger/60 px-2.5 text-[10px] font-semibold tracking-wide text-danger uppercase">
          <IconWarn className="size-3.5" />
          Failed
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2 @[48rem]:ml-auto">
        <button
          type="button"
          className={cn(
            rowActionClass,
            "border-accent/70 bg-bg2 text-accent hover:border-accent hover:bg-accent/10",
          )}
          onClick={() => void getApi().retryDownload(job.id)}
        >
          <IconSync className="size-3.5" />
          Retry
        </button>
        <button
          type="button"
          className={cn(
            rowActionClass,
            "border-accent/50 bg-bg2 text-muted hover:border-accent hover:text-text",
          )}
          onClick={() => void getApi().dismissFailedDownload(job.id)}
        >
          <IconClose className="size-3.5" />
          Dismiss
        </button>
      </div>
    </div>
  );
});
