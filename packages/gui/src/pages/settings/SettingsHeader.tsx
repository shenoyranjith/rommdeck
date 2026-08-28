export function SettingsHeader() {
  return (
    <header className="shrink-0">
      <h1 className="text-[1.75rem] leading-none font-semibold tracking-wide text-text">
        Settings
      </h1>
      <p className="mt-1 text-sm text-muted">
        Shared with{" "}
        <span className="font-mono text-accent">rommdeck-syncd</span>
        {" · "}
        Changes save automatically
      </p>
    </header>
  );
}
