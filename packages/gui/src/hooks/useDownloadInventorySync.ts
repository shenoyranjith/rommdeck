import { useEffect } from "react";
import { getApi } from "../api";
import { applyInventoryChange } from "../pages/library/romCache";
import type { RomItem } from "../pages/library/types";

interface DownloadJobEvent {
  status: string;
  romId: number;
  rommSlug: string;
}

/** Refresh library caches when a download finishes (works even off the Library page). */
export function useDownloadInventorySync(): void {
  useEffect(() => {
    const off = getApi().onDownloadJob((job) => {
      const j = job as DownloadJobEvent;
      if (j.status !== "done") return;

      void getApi()
        .getRom(j.romId)
        .then((rom) => {
          const item = rom as RomItem;
          applyInventoryChange({
            romId: j.romId,
            rommSlug: j.rommSlug,
            downloaded: item.downloaded ?? true,
            verified: item.verified,
          });
        })
        .catch(() => {
          applyInventoryChange({
            romId: j.romId,
            rommSlug: j.rommSlug,
            downloaded: true,
          });
        });
    });
    return off;
  }, []);
}
