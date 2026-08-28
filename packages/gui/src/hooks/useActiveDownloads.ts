import { useEffect, useState } from "react";
import { getApi } from "../api";

export type ActiveDownloadStatus = "queued" | "downloading" | "metadata";

interface QueueJob {
  romId: number;
  status: string;
}

function syncActiveDownloads(jobs: QueueJob[]): Map<number, ActiveDownloadStatus> {
  const next = new Map<number, ActiveDownloadStatus>();
  for (const job of jobs) {
    if (
      job.status === "queued" ||
      job.status === "downloading" ||
      job.status === "metadata"
    ) {
      next.set(job.romId, job.status);
    }
  }
  return next;
}

/** rom_id → active download status for library UI. */
export function useActiveDownloads(): Map<number, ActiveDownloadStatus> {
  const [byRomId, setByRomId] = useState<Map<number, ActiveDownloadStatus>>(
    () => new Map(),
  );

  useEffect(() => {
    const apply = (jobs: QueueJob[]) => setByRomId(syncActiveDownloads(jobs));

    void getApi()
      .listDownloads()
      .then((state) => apply(state.active as QueueJob[]));

    const offJob = getApi().onDownloadJob((job) => {
      const j = job as QueueJob;
      setByRomId((prev) => {
        const next = new Map(prev);
        if (
          j.status === "queued" ||
          j.status === "downloading" ||
          j.status === "metadata"
        ) {
          next.set(j.romId, j.status);
        } else {
          next.delete(j.romId);
        }
        return next;
      });
    });

    let raf = 0;
    const offQueue = getApi().onDownloadQueue((jobs) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => apply(jobs as QueueJob[]));
    });

    return () => {
      cancelAnimationFrame(raf);
      offJob();
      offQueue();
    };
  }, []);

  return byRomId;
}

export function activeDownloadLabel(status: ActiveDownloadStatus): string {
  if (status === "queued") return "Queued";
  if (status === "metadata") return "Writing metadata…";
  return "Downloading";
}
