import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

export async function sha1File(path: string): Promise<string> {
  return hashFile(path, "sha1");
}

export async function md5File(path: string): Promise<string> {
  return hashFile(path, "md5");
}

async function hashFile(path: string, algo: "sha1" | "md5"): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash(algo);
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

export async function fileMtimeIso(path: string): Promise<string> {
  const s = await stat(path);
  return s.mtime.toISOString();
}

export interface ExpectedRomHashes {
  sha1?: string | null;
  md5?: string | null;
}

export interface RomFileHashResult {
  sha1: string;
  /** False when RomM did not provide a hash to compare against. */
  verified: boolean;
}

/** Compare downloaded file against RomM SHA-1/MD5 when available; otherwise hash locally only. */
export async function verifyRomFileHash(
  path: string,
  expected: ExpectedRomHashes,
): Promise<RomFileHashResult> {
  const wantSha1 = expected.sha1?.trim().toLowerCase();
  const wantMd5 = expected.md5?.trim().toLowerCase();

  if (!wantSha1 && !wantMd5) {
    const sha1 = await sha1File(path);
    return { sha1, verified: false };
  }

  if (wantSha1) {
    const sha1 = (await sha1File(path)).toLowerCase();
    if (sha1 !== wantSha1) {
      throw new Error(`SHA-1 mismatch (expected ${wantSha1}, got ${sha1})`);
    }
    return { sha1, verified: true };
  }

  const md5 = (await md5File(path)).toLowerCase();
  if (md5 !== wantMd5) {
    throw new Error(`MD5 mismatch (expected ${wantMd5}, got ${md5})`);
  }
  const sha1 = await sha1File(path);
  return { sha1, verified: true };
}
