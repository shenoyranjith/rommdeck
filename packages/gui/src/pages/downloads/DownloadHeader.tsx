export function DownloadHeader({ hasActive = false }: { hasActive?: boolean }) {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-[1.75rem] leading-none font-semibold tracking-wide text-text">
        Downloads
      </h1>
      <p className="text-sm text-muted">
        {hasActive
          ? "Transfers into RetroDECK ROM folders"
          : "View and manage your download queue."}
      </p>
    </header>
  );
}
