import type { RommDeckApi } from "../electron/preload";

declare global {
  interface Window {
    rommdeck: RommDeckApi;
  }
}

export {};
