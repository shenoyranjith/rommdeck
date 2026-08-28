export type PlatformMapSource = "default" | "override" | "identity";

export interface PlatformMapRow {
  rommSlug: string;
  esdeFolder: string;
  source: PlatformMapSource;
}

export function defaultEsdeFolder(
  rommSlug: string,
  bundled: Record<string, string>,
): string {
  return bundled[rommSlug] ?? rommSlug;
}

export function rowSource(
  rommSlug: string,
  esdeFolder: string,
  bundled: Record<string, string>,
): PlatformMapSource {
  const fallback = defaultEsdeFolder(rommSlug, bundled);
  if (esdeFolder === fallback) {
    return bundled[rommSlug] !== undefined ? "default" : "identity";
  }
  return "override";
}

export function buildPlatformMapRows(
  bundled: Record<string, string>,
  overrides: Record<string, string>,
): PlatformMapRow[] {
  const slugs = new Set([
    ...Object.keys(bundled),
    ...Object.keys(overrides),
  ]);
  return [...slugs].sort((a, b) => a.localeCompare(b)).map((rommSlug) => {
    const esdeFolder =
      overrides[rommSlug] ?? defaultEsdeFolder(rommSlug, bundled);
    return {
      rommSlug,
      esdeFolder,
      source: rowSource(rommSlug, esdeFolder, bundled),
    };
  });
}

export function overridesFromRows(
  rows: PlatformMapRow[],
  bundled: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const fallback = defaultEsdeFolder(row.rommSlug, bundled);
    if (row.esdeFolder !== fallback) {
      out[row.rommSlug] = row.esdeFolder;
    }
  }
  return out;
}

export const PLATFORM_MAP_SOURCE_LABEL: Record<PlatformMapSource, string> = {
  default: "Default",
  override: "Override",
  identity: "Identity",
};
