import type { RomItem } from "./types";

export function romStatusLabel(rom: RomItem): string {
  if (!rom.downloaded) return "Missing";
  if (rom.verified === false) return "Unverified";
  return "Downloaded";
}

export interface RomDetailBadge {
  key: string;
  label: string;
  className: string;
}

/** Detail pane shows independent badges for download, verification, and metadata state. */
export function romDetailBadges(
  rom: RomItem,
  queueStatus?: "queued" | "downloading" | "metadata",
): RomDetailBadge[] {
  if (!rom.downloaded) {
    if (queueStatus === "queued") {
      return [
        {
          key: "queued",
          label: "Queued",
          className: "border border-warn/60 text-warn bg-warn/10",
        },
      ];
    }
    if (queueStatus === "downloading") {
      return [
        {
          key: "downloading",
          label: "Downloading",
          className: "border border-accent/70 text-accent bg-accent/10",
        },
      ];
    }
    return [
      {
        key: "missing",
        label: "Missing",
        className: "border border-warn/50 text-warn bg-warn/10",
      },
    ];
  }

  const badges: RomDetailBadge[] = [
    {
      key: "downloaded",
      label: "Downloaded",
      className: "border border-accent/70 text-accent bg-accent/10",
    },
  ];

  if (rom.verified === false) {
    badges.push({
      key: "unverified",
      label: "Unverified",
      className: "border border-warn/50 text-warn bg-warn/10",
    });
  }

  if (queueStatus === "metadata") {
    badges.push({
      key: "metadata-writing",
      label: "Writing metadata",
      className: "border border-accent/50 text-accent bg-accent/10",
    });
  } else if (rom.metadataMissing) {
    badges.push({
      key: "metadata",
      label: "Missing metadata",
      className: "border border-danger/40 text-danger bg-danger/10",
    });
  }

  return badges;
}

export function romStatusClass(rom: RomItem): string {
  if (!rom.downloaded) return "border-warn/60 text-warn";
  if (rom.verified === false) return "border-warn/50 text-warn";
  return "border-accent/70 text-accent";
}
