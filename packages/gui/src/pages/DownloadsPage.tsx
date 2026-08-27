import { DownloadEmpty } from "./downloads/DownloadEmpty";
import { DownloadFailedList } from "./downloads/DownloadFailedList";
import { DownloadHeader } from "./downloads/DownloadHeader";
import { DownloadList } from "./downloads/DownloadList";
import { DownloadToolbar } from "./downloads/DownloadToolbar";
import { useDownloadQueue } from "./downloads/useDownloadQueue";

export function DownloadsPage() {
  const {
    activeJobs,
    failedJobs,
    downloadingCount,
    queuedCount,
    metadataCount,
    failedCount,
    isEmpty,
  } = useDownloadQueue();

  const hasActive = activeJobs.length > 0;

  return (
    <div className="@container flex h-full min-h-0 flex-col gap-3">
      <DownloadHeader hasActive={!isEmpty} />
      <DownloadToolbar
        downloadingCount={downloadingCount}
        queuedCount={queuedCount}
        metadataCount={metadataCount}
        failedCount={failedCount}
      />

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden border border-accent bg-bg0/60">
        {isEmpty ? (
          <DownloadEmpty />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-auto">
            {hasActive && <DownloadList jobs={activeJobs} />}
            <DownloadFailedList jobs={failedJobs} showTopBorder={hasActive} />
          </div>
        )}
      </section>
    </div>
  );
}
