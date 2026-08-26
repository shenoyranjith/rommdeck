import { useEffect, useState } from "react";
import { getApi } from "../api";

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
    <div>
      <div className="page-header">
        <div>
          <h1>Downloads</h1>
          <p>Queue progress for ROM transfers into RetroDECK folders.</p>
        </div>
      </div>

      <div className="panel">
        {jobs.length === 0 ? (
          <div className="empty">No downloads yet. Queue items from Library.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ROM</th>
                <th>Platform</th>
                <th>Status</th>
                <th>Progress</th>
                <th />
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
                  <tr key={job.id}>
                    <td>{job.romName}</td>
                    <td className="mono">{job.rommSlug}</td>
                    <td>
                      <span className="status-pill">{job.status}</span>
                      {job.error && <div className="muted">{job.error}</div>}
                    </td>
                    <td style={{ minWidth: 160 }}>
                      <div className="progress">
                        <span style={{ width: `${pct}%` }} />
                      </div>
                      <div className="muted mono" style={{ marginTop: 4 }}>
                        {formatBytes(job.progressBytes)}
                        {job.totalBytes ? ` / ${formatBytes(job.totalBytes)}` : ""}
                      </div>
                    </td>
                    <td>
                      {(job.status === "queued" || job.status === "downloading") && (
                        <button className="btn btn-ghost" onClick={() => void getApi().cancelDownload(job.id)}>
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
      </div>
    </div>
  );
}
