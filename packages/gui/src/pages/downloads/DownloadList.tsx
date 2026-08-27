import { DownloadRow } from "./DownloadRow";
import type { DownloadJob } from "./useDownloadQueue";

export function DownloadList({ jobs }: { jobs: DownloadJob[] }) {
  if (jobs.length === 0) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="border-b border-accent/50 px-3 py-2">
        <div className="text-[11px] font-semibold tracking-[0.14em] text-accent uppercase">
          Active
        </div>
      </div>
      <div className="divide-y divide-accent/30">
        {jobs.map((job) => (
          <DownloadRow key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}
