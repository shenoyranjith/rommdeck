import { getApi } from "../api";
import { cn } from "../lib/cn";
import { btnClass } from "../components/ui";
import { DownloadEmpty } from "./downloads/DownloadEmpty";
import { DownloadHeader } from "./downloads/DownloadHeader";
import { useDownloadQueue } from "./downloads/useDownloadQueue";
import { formatBytes } from "./library/format";

export function DownloadsPage() {
  const { jobs, isEmpty } = useDownloadQueue();

  return (
    <div className="@container flex h-full min-h-0 flex-col gap-3">
      <DownloadHeader />

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden border border-accent bg-bg0/60">
        {isEmpty ? (
          <DownloadEmpty />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-accent/50 text-left text-[11px] tracking-wide text-muted uppercase">
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
                      ? Math.min(
                          100,
                          Math.round((job.progressBytes / job.totalBytes) * 100),
                        )
                      : job.status === "done"
                        ? 100
                        : 0;
                  return (
                    <tr key={job.id} className="border-b border-accent/30">
                      <td className="px-3 py-3 text-text">{job.romName}</td>
                      <td className="px-3 py-3 font-mono text-xs text-accent">
                        {job.rommSlug}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "inline-block border border-accent/50 bg-bg2 px-2 py-0.5 font-mono text-[11px] uppercase",
                            job.status === "done" && "border-ok/40 text-ok",
                            job.status === "error" &&
                              "border-danger/40 text-danger",
                            (job.status === "queued" ||
                              job.status === "downloading") &&
                              "border-accent/40 text-accent",
                          )}
                        >
                          {job.status}
                        </span>
                        {job.error && (
                          <div className="mt-1 text-xs text-muted">
                            {job.error}
                          </div>
                        )}
                      </td>
                      <td className="min-w-[160px] px-3 py-3">
                        <div className="h-1.5 overflow-hidden bg-bg0">
                          <div
                            className="h-full bg-accent transition-[width] duration-200"
                            style={{
                              width: `${pct}%`,
                              boxShadow: "var(--glow)",
                            }}
                          />
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-muted">
                          {formatBytes(job.progressBytes)}
                          {job.totalBytes != null
                            ? ` / ${formatBytes(job.totalBytes)}`
                            : ""}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {(job.status === "queued" ||
                          job.status === "downloading") && (
                          <button
                            type="button"
                            className={btnClass}
                            onClick={() =>
                              void getApi().cancelDownload(job.id)
                            }
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
          </div>
        )}
      </section>
    </div>
  );
}
