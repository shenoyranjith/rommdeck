import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarizeSyncOperations, discoveryToReport } from "./report.js";
import type { SyncOperation } from "../romm/types.js";

describe("summarizeSyncOperations", () => {
  it("counts operation types", () => {
    const ops: SyncOperation[] = [
      { type: "upload", rom_id: 1, file: "a.srm" },
      { type: "download", rom_id: 2, file: "b.srm" },
      { type: "conflict", rom_id: 3, file: "c.srm" },
      { type: "no_op", rom_id: 4, file: "d.srm" },
    ];
    assert.deepEqual(summarizeSyncOperations(ops), {
      upload: 1,
      download: 1,
      conflict: 1,
      no_op: 1,
      total: 4,
    });
  });
});

describe("discoveryToReport", () => {
  it("serializes skipped platform set", () => {
    const report = discoveryToReport({
      indexedRomFiles: 10,
      retroArchRomFiles: 8,
      skippedStandalonePlatforms: new Set(["gc", "ps2"]),
      existingSaveFiles: 3,
    });
    assert.deepEqual(report?.skippedStandalonePlatforms, ["gc", "ps2"]);
  });
});
