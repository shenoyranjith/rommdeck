import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { DownloadRow } from "./DownloadRow";
import type { DownloadJob } from "./useDownloadQueue";

const ROW_HEIGHT = 88;

export function DownloadList({ jobs }: { jobs: DownloadJob[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: jobs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  if (jobs.length === 0) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-accent/50 px-3 py-2">
        <div className="text-[11px] font-semibold tracking-[0.14em] text-accent uppercase">
          Active
        </div>
      </div>
      <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
        <div
          className="relative divide-y divide-accent/30"
          style={{ height: virtualizer.getTotalSize(), contain: "layout paint" }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const job = jobs[virtualRow.index];
            if (!job) return null;
            return (
              <div
                key={virtualRow.key}
                className="absolute top-0 left-0 w-full will-change-transform"
                style={{
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <DownloadRow job={job} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
