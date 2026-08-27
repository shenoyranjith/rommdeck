import { useEffect, useState } from "react";
import { getApi } from "../api";
import { cn } from "../lib/cn";
import { PageHeader, Panel, btnClass } from "../components/ui";

interface DownloadJob {
  id: string;
  romId: number;
  romName: string;
  rommSlug: string;
  filenames: string[];
  status: string;
  progressBytes: number;
  totalBytes: number | null;
  error?: string;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function DownloadsPage() {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);

  useEffect(() => {
    void getApi().listDownloads().then((j) => setJobs(j as DownloadJob[]));
    const offJob = getApi().onDownloadJob((job) => {
      const j = job as DownloadJob;
      setJobs((prev) => {
        const i = prev.findIndex((x) => x.id === j.id);
        if (i === -1) return [...prev, j];
        const next = [...prev];
        next[i] = j;
        return next;
      });
    });
    const offQueue = getApi().onDownloadQueue((list) => {
      setJobs(list as DownloadJob[]);
    });
    return () => {
      offJob();
      offQueue();
    };
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader
        title="Downloads"
        description="Queue progress for ROM transfers into RetroDECK folders."
      />

      <Panel className="min-h-0 flex-1 overflow-auto">
        {jobs.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted">
            No downloads yet. Queue items from Library.
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] tracking-wide text-muted uppercase">
                <th className="px-3 py-2.5 font-medium">ROM</th>
                <th className="px-3 py-2.5 font-medium">Platform</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Progress</th>
                <th className="px-3 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const pct =
                  job.totalBytes && job.totalBytes > 0
                    ? Math.min(100, Math.round((job.progressBytes / job.totalBytes) * 100))
                    : job.status === "done"
                      ? 100
                      : 0;
                return (
                  <tr key={job.id} className="border-b border-line/70">
                    <td className="px-3 py-3 text-text">{job.romName}</td>
                    <td className="px-3 py-3 font-mono text-xs text-accent">{job.rommSlug}</td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "inline-block rounded border border-line bg-bg2 px-2 py-0.5 font-mono text-[11px] uppercase",
                          job.status === "done" && "border-ok/40 text-ok",
                          job.status === "error" && "border-danger/40 text-danger",
                          (job.status === "queued" || job.status === "downloading") &&
                            "border-accent/40 text-accent",
                        )}
                      >
                        {job.status}
                      </span>
                      {job.error && <div className="mt-1 text-xs text-muted">{job.error}</div>}
                    </td>
                    <td className="min-w-[160px] px-3 py-3">
                      <div className="h-1.5 overflow-hidden rounded-full bg-bg0">
                        <div
                          className="h-full bg-accent transition-[width] duration-200"
                          style={{ width: `${pct}%`, boxShadow: "var(--glow)" }}
                        />
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-muted">
                        {formatBytes(job.progressBytes)}
                        {job.totalBytes ? ` / ${formatBytes(job.totalBytes)}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {(job.status === "queued" || job.status === "downloading") && (
                        <button
                          type="button"
                          className={btnClass}
                          onClick={() => void getApi().cancelDownload(job.id)}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
