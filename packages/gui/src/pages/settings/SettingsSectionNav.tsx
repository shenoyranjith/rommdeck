import { cn } from "../../lib/cn";
import { SETTINGS_SECTIONS, type SettingsSectionId } from "./sections";

export function SettingsSectionNav({
  active,
  onSelect,
}: {
  active: SettingsSectionId;
  onSelect: (id: SettingsSectionId) => void;
}) {
  return (
    <nav
      className="flex shrink-0 flex-row gap-1 overflow-x-auto md:w-[9.5rem] md:flex-col md:gap-0.5 md:overflow-visible"
      aria-label="Settings sections"
    >
      {SETTINGS_SECTIONS.map(({ id, label }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={cn(
              "shrink-0 border px-3 py-2.5 text-left text-sm font-semibold transition-colors md:w-full",
              isActive
                ? "border-accent bg-accent/15 text-accent md:border-l-[4px]"
                : "border-line text-muted hover:border-accent/60 hover:bg-bg2/40 hover:text-text md:border-transparent",
            )}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}
