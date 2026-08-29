import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  romBasename,
  slotForSaveFileName,
  untagSaveFileName,
  resolveLocalSaveFileName,
  resolveExpectedSavePaths,
  resolveLocalSavePath,
  uniqueIndexedRomFiles,
} from "./save-paths.js";
import { buildNegotiatePayload } from "./protocol.js";
import { LibraryIndex } from "../db/index.js";
import {
  loadPlatformEmulatorMap,
  resetPlatformEmulatorMapCache,
} from "../platform-emulator-map.js";

describe("romBasename", () => {
  it("preserves region tags", () => {
    assert.equal(romBasename("Super Mario World (USA).sfc"), "Super Mario World (USA)");
  });

  it("strips only the last extension", () => {
    assert.equal(romBasename("Game.tar.gz"), "Game.tar");
  });
});

describe("untagSaveFileName", () => {
  it("removes RomM datetime tags before the extension", () => {
    assert.equal(
      untagSaveFileName("Aladdin (USA) [2026-04-18_09-45-00].state"),
      "Aladdin (USA).state",
    );
  });
});

describe("resolveLocalSaveFileName", () => {
  it("uses indexed ROM basename with server save extension", () => {
    assert.equal(
      resolveLocalSaveFileName("Aladdin (USA).sfc", "Aladdin (USA) [2026-04-18_09-45-00].state"),
      "Aladdin (USA).state",
    );
  });
});

describe("slotForSaveFileName", () => {
  it("maps battery saves to default", () => {
    assert.equal(slotForSaveFileName("mario.srm"), "default");
  });

  it("maps quicksave slots", () => {
    assert.equal(slotForSaveFileName("mario.state"), "state");
    assert.equal(slotForSaveFileName("mario.state0"), "state0");
    assert.equal(slotForSaveFileName("mario.state9"), "state9");
  });
});

describe("resolveExpectedSavePaths", () => {
  it("builds deterministic battery and state paths", () => {
    const paths = resolveExpectedSavePaths(
      {
        rom_id: 1,
        romm_slug: "snes",
        esde_folder: "snes",
        filename: "Aladdin (USA).sfc",
        size: 0,
        sha1: null,
        path: "/roms/snes/Aladdin (USA).sfc",
        downloaded_at: "",
        verified: true,
      },
      { savesPath: "/saves", statesPath: "/states" },
    );
    assert.ok(paths.some((p) => p.absolutePath === "/saves/snes/Aladdin (USA).srm"));
    assert.ok(paths.some((p) => p.absolutePath === "/states/snes/Aladdin (USA).state3"));
  });

  it("skips standalone-default platforms", () => {
    resetPlatformEmulatorMapCache();
    const map = loadPlatformEmulatorMap();
    assert.equal(map.gc, "standalone");

    const paths = resolveExpectedSavePaths(
      {
        rom_id: 2,
        romm_slug: "ngc",
        esde_folder: "gc",
        filename: "Zelda.iso",
        size: 0,
        sha1: null,
        path: "/roms/gc/Zelda.iso",
        downloaded_at: "",
        verified: true,
      },
      { savesPath: "/saves", statesPath: "/states" },
    );
    assert.equal(paths.length, 0);
  });
});

describe("cross-platform same title", () => {
  it("does not cross-match SNES and megadrive basenames", () => {
    const snes = resolveExpectedSavePaths(
      {
        rom_id: 10,
        romm_slug: "snes",
        esde_folder: "snes",
        filename: "Aladdin (USA).sfc",
        size: 0,
        sha1: null,
        path: "",
        downloaded_at: "",
        verified: true,
      },
      { savesPath: "/saves", statesPath: "/states" },
    ).find((p) => p.file_name.endsWith(".srm"));
    const md = resolveExpectedSavePaths(
      {
        rom_id: 11,
        romm_slug: "genesis",
        esde_folder: "megadrive",
        filename: "Aladdin (USA).md",
        size: 0,
        sha1: null,
        path: "",
        downloaded_at: "",
        verified: true,
      },
      { savesPath: "/saves", statesPath: "/states" },
    ).find((p) => p.file_name.endsWith(".srm"));

    assert.notEqual(snes?.absolutePath, md?.absolutePath);
    assert.equal(snes?.absolutePath, "/saves/snes/Aladdin (USA).srm");
    assert.equal(md?.absolutePath, "/saves/megadrive/Aladdin (USA).srm");
  });
});

describe("buildNegotiatePayload", () => {
  it("hashes existing files with MD5 content_hash", async () => {
    const root = join(tmpdir(), `rommdeck-sync-test-${Date.now()}`);
    const savesPath = join(root, "saves");
    const statesPath = join(root, "states");
    mkdirSync(join(savesPath, "snes"), { recursive: true });
    writeFileSync(join(savesPath, "snes", "Demo (USA).srm"), "save-bytes");

    const dbPath = join(root, "library.db");
    const index = new LibraryIndex(dbPath);
    index.upsertFile({
      rom_id: 99,
      romm_slug: "snes",
      esde_folder: "snes",
      filename: "Demo (USA).sfc",
      size: 1,
      sha1: null,
      path: join(root, "roms", "snes", "Demo (USA).sfc"),
      downloaded_at: new Date().toISOString(),
      verified: true,
    });

    const { saves, discovery } = await buildNegotiatePayload(index, {
      savesPath,
      statesPath,
      romsPath: join(root, "roms"),
    });

    assert.equal(discovery.existingSaveFiles, 1);
    assert.equal(saves.length, 1);
    assert.equal(saves[0]?.file_name, "Demo (USA).srm");
    assert.equal(saves[0]?.slot, "default");
    assert.equal(saves[0]?.emulator, "retroarch");
    assert.match(saves[0]?.content_hash ?? "", /^[a-f0-9]{32}$/);

    index.close();
    rmSync(root, { recursive: true, force: true });
  });
});

describe("uniqueIndexedRomFiles", () => {
  it("dedupes identical rows", () => {
    const row = {
      rom_id: 1,
      romm_slug: "snes",
      esde_folder: "snes",
      filename: "a.sfc",
      size: 0,
      sha1: null,
      path: "/a",
      downloaded_at: "",
      verified: true,
    };
    assert.equal(uniqueIndexedRomFiles([row, row]).length, 1);
  });
});

describe("resolveLocalSavePath", () => {
  it("routes states to states_path", () => {
    assert.equal(
      resolveLocalSavePath({ savesPath: "/saves", statesPath: "/states" }, "snes", "game.state2"),
      "/states/snes/game.state2",
    );
  });
});
