import { DownloadFailedRow } from "./DownloadFailedRow";
import type { DownloadJob } from "./useDownloadQueue";

export function DownloadFailedList({
  jobs,
  showTopBorder = true,
}: {
  jobs: DownloadJob[];
  showTopBorder?: boolean;
}) {
  if (jobs.length === 0) return null;

  return (
    <div
      className={
        showTopBorder ? "flex min-h-0 flex-col border-t border-accent/50" : "flex min-h-0 flex-col"
      }
    >
      <div className="border-b border-accent/50 px-3 py-2">
        <div className="text-[11px] font-semibold tracking-[0.14em] text-danger uppercase">
          Failed
        </div>
      </div>
      <div className="divide-y divide-danger/20">
        {jobs.map((job) => (
          <DownloadFailedRow key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}
