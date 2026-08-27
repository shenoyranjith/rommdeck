import { Link } from "react-router-dom";
import { IconDownloads } from "../../components/icons";

export function DownloadEmpty() {
  return (
    <div className="flex min-h-[min(20rem,55vh)] flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <IconDownloads
        className="size-16 shrink-0 text-accent @[48rem]:size-20"
        strokeWidth={1.75}
        style={{ filter: "drop-shadow(0 0 12px var(--accent))" }}
        aria-hidden
      />
      <p className="text-lg font-semibold tracking-wide text-text">
        No downloads in queue
      </p>
      <p className="max-w-sm text-sm text-muted">
        Queue downloads from{" "}
        <Link
          to="/"
          className="font-medium text-accent underline-offset-2 transition-colors hover:text-text hover:underline"
        >
          Library
        </Link>
      </p>
    </div>
  );
}
