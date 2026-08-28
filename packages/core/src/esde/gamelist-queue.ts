import { log } from "../log.js";
import { gamelistLockPath, withFileLock } from "./file-lock.js";

const SHUTDOWN_WAIT_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Serializes gamelist.xml read-modify-write per file across concurrent metadata jobs. */
class GamelistWriteQueue {
  private tails = new Map<string, Promise<void>>();
  private inFlight = 0;
  private rejectNew = false;
  private activeRelease: (() => void) | null = null;

  isWriteActive(): boolean {
    return this.inFlight > 0;
  }

  run<T>(gamelistPath: string, fn: () => T | Promise<T>, signal?: AbortSignal): Promise<T> {
    if (this.rejectNew) {
      return Promise.reject(new Error("cancelled"));
    }

    const checkAborted = () => {
      if (signal?.aborted || this.rejectNew) throw new Error("cancelled");
    };

    const prev = this.tails.get(gamelistPath) ?? Promise.resolve();
    const work = prev
      .catch(() => {
        /* keep chain alive after a failed task */
      })
      .then(async () => {
        checkAborted();
        return withFileLock(
          gamelistLockPath(gamelistPath),
          async () => {
            checkAborted();
            this.inFlight++;
            try {
              return await fn();
            } finally {
              this.inFlight--;
            }
          },
          {
            signal,
            onAcquired: (release) => {
              this.activeRelease = release;
            },
          },
        ).finally(() => {
          if (this.activeRelease) this.activeRelease = null;
        });
      });

    this.tails.set(
      gamelistPath,
      work.then(
        () => undefined,
        () => undefined,
      ),
    );
    return work;
  }

  /**
   * Stop accepting new writes. Wait for an in-flight gamelist transaction to finish;
   * if it does not complete in time, release the lock without finishing the write.
   */
  async shutdown(waitMs = SHUTDOWN_WAIT_MS): Promise<void> {
    this.rejectNew = true;
    const deadline = Date.now() + waitMs;
    while (this.inFlight > 0 && Date.now() < deadline) {
      await sleep(20);
    }
    if (this.inFlight > 0) {
      log.esde("gamelist shutdown: forcing lock release", { inFlight: this.inFlight });
      this.activeRelease?.();
      this.activeRelease = null;
      this.inFlight = 0;
    }
  }
}

export const gamelistWriteQueue = new GamelistWriteQueue();

export function isGamelistWriteActive(): boolean {
  return gamelistWriteQueue.isWriteActive();
}

export function shutdownGamelistWrites(): Promise<void> {
  return gamelistWriteQueue.shutdown();
}
