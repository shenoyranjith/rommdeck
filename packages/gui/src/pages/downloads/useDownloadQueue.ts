import { useEffect, useState } from "react";
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
  error?: string;
}

export function useDownloadQueue() {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);

  useEffect(() => {
    void getApi()
      .listDownloads()
      .then((j) => setJobs(j as DownloadJob[]));
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

  const isEmpty = jobs.length === 0;

  return { jobs, isEmpty };
}
