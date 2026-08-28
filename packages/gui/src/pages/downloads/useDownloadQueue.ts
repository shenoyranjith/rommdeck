import { useEffect, useMemo, useState } from "react";
import { getApi } from "../../api";

export interface DownloadJob {
  id: string;
  romId: number;
  romName: string;
  rommSlug: string;
  filenames: string[];
  status: string;
  progressBytes: number;
  totalBytes: number | null;
  coverUrl?: string | null;
  error?: string;
}

const ACTIVE_STATUSES = new Set(["queued", "downloading", "metadata"]);

function isActiveJob(job: DownloadJob): boolean {
  return ACTIVE_STATUSES.has(job.status);
}

export function useDownloadQueue() {
  const [activeJobs, setActiveJobs] = useState<DownloadJob[]>([]);
  const [failedJobs, setFailedJobs] = useState<DownloadJob[]>([]);

  useEffect(() => {
    void getApi()
      .listDownloads()
      .then((state) => {
        setActiveJobs(state.active as DownloadJob[]);
        setFailedJobs(state.failed as DownloadJob[]);
      });

    const offJob = getApi().onDownloadJob((job) => {
      const j = job as DownloadJob;
      setActiveJobs((prev) => {
        if (j.status === "done" || j.status === "error" || j.status === "cancelled") {
          return prev.filter((x) => x.id !== j.id);
        }
        const i = prev.findIndex((x) => x.id === j.id);
        if (i === -1) {
          if (j.status === "downloading" || j.status === "metadata") {
            return [j, ...prev];
          }
          return [...prev, j];
        }
        const next = [...prev];
        next[i] = j;
        return next;
      });
    });

    let raf = 0;
    const offQueue = getApi().onDownloadQueue((list) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setActiveJobs(list as DownloadJob[]));
    });

    const offFailed = getApi().onDownloadFailed((list) => {
      setFailedJobs(list as DownloadJob[]);
    });

    return () => {
      cancelAnimationFrame(raf);
      offJob();
      offQueue();
      offFailed();
    };
  }, []);

  const visibleActiveJobs = useMemo(() => activeJobs.filter(isActiveJob), [activeJobs]);

  const downloadingCount = useMemo(
    () => visibleActiveJobs.filter((j) => j.status === "downloading").length,
    [visibleActiveJobs],
  );

  const queuedCount = useMemo(
    () => visibleActiveJobs.filter((j) => j.status === "queued").length,
    [visibleActiveJobs],
  );

  const metadataCount = useMemo(
    () => visibleActiveJobs.filter((j) => j.status === "metadata").length,
    [visibleActiveJobs],
  );

  const isEmpty = visibleActiveJobs.length === 0 && failedJobs.length === 0;

  return {
    activeJobs: visibleActiveJobs,
    failedJobs,
    downloadingCount,
    queuedCount,
    metadataCount,
    failedCount: failedJobs.length,
    isEmpty,
  };
}
