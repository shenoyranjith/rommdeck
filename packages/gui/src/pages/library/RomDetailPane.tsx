import { cn } from "../../lib/cn";
import { IconClose } from "../../components/icons";
import { formatBytes } from "./format";
import type { Platform, RomItem } from "./types";
import { romDetailBadges } from "./romStatus";
import {
  activeDownloadLabel,
  type ActiveDownloadStatus,
} from "../../hooks/useActiveDownloads";

export function RomDetailPane({
  detail,
  detailError,
  platform,
  onClose,
  onDownload,
  onDeleteLocal,
  queueStatus,
}: {
  detail: RomItem | null;
  detailError: string | null;
  platform: Platform | null;
  onClose: () => void;
  onDownload: (rom: RomItem) => void;
  onDeleteLocal: (rom: RomItem) => void;
  queueStatus?: ActiveDownloadStatus;
}) {
  const detailSize =
    detail?.fs_size_bytes ??
    detail?.filesize ??
    detail?.files?.reduce((sum, f) => sum + (f.file_size_bytes ?? 0), 0);

  const cover =
    detail?.coverUrl ||
    detail?.coverUrlSmall ||
    detail?.path_cover_large ||
    detail?.path_cover_small ||
    detail?.url_cover;

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden border border-accent bg-bg0/60">
      <div className="flex items-center justify-between gap-2 border-b border-accent/50 px-3 py-2.5">
        <div className="text-[11px] font-semibold tracking-[0.14em] text-accent uppercase">
          Details
        </div>
        <button
          type="button"
          className="grid size-7 place-items-center text-muted hover:bg-bg2 hover:text-text"
          onClick={onClose}
          aria-label="Close details"
        >
          <IconClose className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {!detail ? (
          <div className="py-10 text-center text-sm text-muted">
            {detailError ?? "Loading…"}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="mx-auto w-full max-w-[220px] overflow-hidden border border-line bg-bg0">
              <div className="grid aspect-[3/4] place-items-center text-xs text-muted">
                {cover ? (
                  <img
                    src={cover}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-accent/80">NO COVER</span>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold leading-snug text-text">
                {detail.name}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {detail.platform_display_name ||
                  detail.platform_name ||
                  platform?.displayName ||
                  platform?.name ||
                  detail.platform_slug ||
                  "—"}
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {romDetailBadges(detail, queueStatus).map((badge) => (
                <span
                  key={badge.key}
                  className={cn(
                    "inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                    badge.className,
                  )}
                >
                  {badge.label}
                </span>
              ))}
            </div>

            {detailError && (
              <div className=" border border-danger/40 px-2 py-1.5 text-xs text-danger">
                {detailError}
              </div>
            )}

            {detail.summary ? (
              <p className="text-sm leading-relaxed text-text/90 whitespace-pre-wrap">
                {detail.summary}
              </p>
            ) : (
              <p className="text-sm text-muted italic">No summary from RomM.</p>
            )}

            <dl className="grid gap-2 text-sm">
              <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                <dt className="text-muted">File</dt>
                <dd
                  className="min-w-0 truncate font-mono text-xs text-text"
                  title={detail.fs_name}
                >
                  {detail.fs_name || "—"}
                </dd>
              </div>
              <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                <dt className="text-muted">Size</dt>
                <dd className="font-mono text-xs text-text">
                  {formatBytes(detailSize)}
                </dd>
              </div>
              {detail.files && detail.files.length > 1 && (
                <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                  <dt className="text-muted">Parts</dt>
                  <dd className="font-mono text-xs text-text">
                    {detail.files.length} files
                  </dd>
                </div>
              )}
            </dl>

            <div className="mt-1 flex flex-col gap-2">
              {detail.downloaded ? (
                <button
                  type="button"
                  className="cursor-pointer border border-danger/50 px-3 py-2 text-sm text-danger"
                  onClick={() => onDeleteLocal(detail)}
                >
                  Delete local
                </button>
              ) : queueStatus ? (
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed border border-accent/50 bg-bg2 px-3 py-2 text-sm font-semibold text-accent/70"
                >
                  {activeDownloadLabel(queueStatus)}
                </button>
              ) : (
                <button
                  type="button"
                  className="cursor-pointer border border-accent bg-accent px-3 py-2 text-sm font-semibold text-accent-fg"
                  style={{ boxShadow: "var(--glow)" }}
                  onClick={() => onDownload(detail)}
                >
                  Download
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
