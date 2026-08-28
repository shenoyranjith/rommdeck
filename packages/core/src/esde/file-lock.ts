import { closeSync, existsSync, mkdirSync, openSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const LOCK_POLL_MS = 50;
const DEFAULT_TIMEOUT_MS = 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface FileLockOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  onAcquired?: (release: () => void) => void;
}

/**
 * Exclusive lock via atomic lockfile create (`wx`).
 * Returns a release function; throws after timeout if lock is held.
 */
export async function acquireFileLock(
  lockPath: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal?: AbortSignal,
): Promise<() => void> {
  mkdirSync(dirname(lockPath), { recursive: true });
  const deadline = Date.now() + timeoutMs;

  while (true) {
    if (signal?.aborted) throw new Error("cancelled");
    try {
      const fd = openSync(lockPath, "wx");
      writeFileSync(fd, `${process.pid}\n`, "utf8");
      const release = () => {
        try {
          closeSync(fd);
        } catch {
          /* ignore */
        }
        try {
          if (existsSync(lockPath)) unlinkSync(lockPath);
        } catch {
          /* ignore */
        }
      };
      return release;
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
      if (code !== "EEXIST") throw e;
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for lock: ${lockPath}`);
      }
      await sleep(LOCK_POLL_MS + Math.random() * LOCK_POLL_MS);
    }
  }
}

export async function withFileLock<T>(
  lockPath: string,
  fn: () => T | Promise<T>,
  opts?: FileLockOptions,
): Promise<T> {
  if (opts?.signal?.aborted) throw new Error("cancelled");
  const release = await acquireFileLock(lockPath, opts?.timeoutMs, opts?.signal);
  opts?.onAcquired?.(release);
  try {
    if (opts?.signal?.aborted) throw new Error("cancelled");
    return await fn();
  } finally {
    release();
  }
}

export function gamelistLockPath(gamelistPath: string): string {
  return `${gamelistPath}.lock`;
}

/** Remove a stale lock file (e.g. after forced shutdown). */
export function releaseLockFile(lockPath: string): void {
  try {
    if (existsSync(lockPath)) unlinkSync(lockPath);
  } catch {
    /* ignore */
  }
}
