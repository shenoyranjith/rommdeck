import { getApi } from "../../api";
import { IconDownloads, IconWarn } from "../../components/icons";
import { btnClass } from "../../components/ui";

export function DownloadToolbar({
  downloadingCount,
  queuedCount,
  metadataCount,
  failedCount,
}: {
  downloadingCount: number;
  queuedCount: number;
  metadataCount: number;
  failedCount: number;
}) {
  const hasActive = downloadingCount + queuedCount + metadataCount > 0;
  const hasFailed = failedCount > 0;
  if (!hasActive && !hasFailed) return null;

  const parts: string[] = [];
  if (downloadingCount > 0) parts.push(`${downloadingCount} downloading`);
  if (metadataCount > 0) parts.push(`${metadataCount} metadata`);
  if (queuedCount > 0) parts.push(`${queuedCount} queued`);
  if (failedCount > 0) parts.push(`${failedCount} failed`);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border border-accent bg-bg0/60 px-3 py-2.5">
      <div className="flex items-center gap-2 text-sm text-text">
        {hasFailed && !hasActive ? (
          <IconWarn className="size-4 shrink-0 text-danger" aria-hidden />
        ) : (
          <IconDownloads className="size-4 shrink-0 text-accent" aria-hidden />
        )}
        <span className={countClass(hasFailed, hasActive)}>{parts.join(" · ")}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {hasFailed && (
          <>
            <button
              type="button"
              className={btnClass}
              onClick={() => void getApi().retryAllFailedDownloads()}
            >
              Retry all
            </button>
            <button
              type="button"
              className={btnClass}
              onClick={() => void getApi().clearFailedDownloads()}
            >
              Clear failed
            </button>
          </>
        )}
        {hasActive && (
          <button
            type="button"
            className={btnClass}
            onClick={() => void getApi().cancelAllDownloads()}
          >
            Cancel all
          </button>
        )}
      </div>
    </div>
  );
}

function countClass(hasFailed: boolean, hasActive: boolean): string {
  if (hasFailed && !hasActive) return "font-mono text-danger";
  return "font-mono text-accent";
}
