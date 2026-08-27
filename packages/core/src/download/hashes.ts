import type { RommRom } from "../romm/types.js";
import type { ExpectedRomHashes } from "../hash.js";

export function expectedHashesForFile(rom: RommRom, filename: string): ExpectedRomHashes {
  const file = rom.files?.find((f) => f.file_name === filename);
  const romAny = rom as RommRom & { sha1_hash?: string | null; md5_hash?: string | null };
  return {
    sha1: file?.sha1_hash ?? romAny.sha1_hash ?? null,
    md5: file?.md5_hash ?? romAny.md5_hash ?? null,
  };
}

export function romHasExpectedHash(rom: RommRom, filename: string): boolean {
  const expected = expectedHashesForFile(rom, filename);
  return Boolean(expected.sha1?.trim() || expected.md5?.trim());
}

export function hashesMatchRom(
  rom: RommRom,
  filename: string,
  storedSha1: string | null | undefined,
): boolean {
  const expected = expectedHashesForFile(rom, filename);
  const wantSha1 = expected.sha1?.trim().toLowerCase();
  if (wantSha1) {
    return storedSha1?.trim().toLowerCase() === wantSha1;
  }
  return Boolean(storedSha1);
}
