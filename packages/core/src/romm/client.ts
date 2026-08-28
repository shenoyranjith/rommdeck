import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import type {
  CompleteSessionBody,
  NegotiateResponse,
  RommDevice,
  RommPlatform,
  RommRom,
  SyncLocalRom,
} from "./types.js";

export class RommApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
  ) {
    super(message);
    this.name = "RommApiError";
  }
}

export interface RommClientOptions {
  baseUrl: string;
  apiToken: string;
}

/** RomM serves stored media under this path prefix (see FRONTEND_RESOURCES_PATH). */
const ROMM_RESOURCES_PREFIX = "/assets/romm/resources";

export class RommClient {
  readonly baseUrl: string;
  private readonly token: string;

  constructor(opts: RommClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.token = opts.apiToken;
  }

  private headers(extra?: HeadersInit): Headers {
    const h = new Headers(extra);
    h.set("Authorization", `Bearer ${this.token}`);
    if (!h.has("Accept")) h.set("Accept", "application/json");
    return h;
  }

  /** Join configured RomM base URL with an absolute or root-relative path. */
  private joinBaseUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) return path;
    const base = this.baseUrl.replace(/\/+$/, "");
    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  }

  /**
   * Normalize RomM asset references to a server-relative resources path.
   * Covers may arrive as `/assets/romm/resources/roms/...` while videos/screenshots
   * are sometimes bare `roms/{platform_id}/{rom_id}/...` paths.
   */
  private toResourcePath(assetPath: string): string {
    const trimmed = assetPath.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith("/assets/romm/")) return trimmed;
    if (trimmed.startsWith("/assets/")) return trimmed;
    const relative = trimmed.replace(/^\/+/, "");
    return `${ROMM_RESOURCES_PREFIX}/${relative}`;
  }

  /** Build a fetchable URL; RomM asset paths often have unencoded spaces in ?ts= values. */
  private normalizeUrl(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) throw new TypeError("Invalid URL");
    const absolute = /^https?:\/\//i.test(trimmed) ? trimmed : this.joinBaseUrl(trimmed);
    const encoded = absolute.replace(/ /g, "%20");
    return new URL(encoded).href;
  }

  private url(path: string, query?: Record<string, string | number | undefined>): string {
    const href = path.startsWith("http") ? this.normalizeUrl(path) : this.normalizeUrl(this.joinBaseUrl(path));
    const u = new URL(href);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== "") u.searchParams.set(k, String(v));
      }
    }
    return u.toString();
  }

  async request<T>(
    method: string,
    path: string,
    opts?: {
      query?: Record<string, string | number | undefined>;
      body?: unknown;
      formData?: FormData;
      expectJson?: boolean;
    },
  ): Promise<T> {
    const headers = this.headers();
    let body: BodyInit | undefined;
    if (opts?.formData) {
      body = opts.formData;
    } else if (opts?.body !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(opts.body);
    }

    const res = await fetch(this.url(path, opts?.query), { method, headers, body });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new RommApiError(`RomM ${method} ${path} failed: ${res.status}`, res.status, text);
    }
    if (opts?.expectJson === false) {
      return undefined as T;
    }
    if (res.status === 204) return undefined as T;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      return (await res.text()) as T;
    }
    return (await res.json()) as T;
  }

  async testConnection(): Promise<{ ok: boolean; platforms?: number; error?: string }> {
    try {
      const platforms = await this.getPlatforms();
      return { ok: true, platforms: platforms.length };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async getPlatforms(): Promise<RommPlatform[]> {
    const data = await this.request<RommPlatform[] | { items: RommPlatform[] }>(
      "GET",
      "/api/platforms",
    );
    return Array.isArray(data) ? data : (data.items ?? []);
  }

  async getRoms(opts?: {
    platformId?: number;
    platformSlug?: string;
    searchTerm?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: RommRom[]; total: number }> {
    // RomM filters by repeated `platform_ids` (not platform_id / platform_slug).
    // Library search is also on GET /api/roms via search_term.
    const data = await this.request<RommRom[] | { items: RommRom[]; total?: number }>(
      "GET",
      "/api/roms",
      {
        query: {
          platform_ids: opts?.platformId,
          search_term: opts?.searchTerm,
          limit: opts?.limit ?? 100,
          offset: opts?.offset ?? 0,
        },
      },
    );
    const items = Array.isArray(data) ? data : (data.items ?? []);
    const total = Array.isArray(data) ? items.length : (data.total ?? items.length);
    return { items, total };
  }

  /** Turn RomM asset paths into an absolute fetch URL on this server. */
  resolveAssetUrl(assetPath: string | null | undefined): string | null {
    if (!assetPath?.trim()) return null;
    try {
      const path = this.toResourcePath(assetPath);
      return this.normalizeUrl(path);
    } catch {
      return null;
    }
  }

  coverUrlFor(rom: RommRom, prefer: "small" | "large" = "small"): string | null {
    if (prefer === "large") {
      return (
        this.resolveAssetUrl(rom.path_cover_large) ??
        this.resolveAssetUrl(rom.path_cover_small) ??
        this.resolveAssetUrl(rom.url_cover)
      );
    }
    return (
      this.resolveAssetUrl(rom.path_cover_small) ??
      this.resolveAssetUrl(rom.path_cover_large) ??
      this.resolveAssetUrl(rom.url_cover)
    );
  }

  /** Absolute logo URL for a platform (RomM-hosted path or remote url_logo). */
  logoUrlFor(platform: RommPlatform): string | null {
    return this.resolveAssetUrl(platform.logo_path) ?? this.resolveAssetUrl(platform.url_logo);
  }

  async getRom(id: number): Promise<RommRom> {
    return this.request<RommRom>("GET", `/api/roms/${id}`);
  }

  /** Download a ROM content file to destPath. */
  async downloadRomContent(
    romId: number,
    fileName: string,
    destPath: string,
    opts?: { onProgress?: (bytes: number) => void; signal?: AbortSignal },
  ): Promise<void> {
    const encoded = encodeURIComponent(fileName);
    const res = await fetch(this.url(`/api/roms/${romId}/content/${encoded}`), {
      headers: this.headers(),
      signal: opts?.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new RommApiError(`Download failed: ${res.status}`, res.status, text);
    }
    await mkdir(dirname(destPath), { recursive: true });
    if (!res.body) throw new RommApiError("Empty response body", res.status);

    const nodeStream = Readable.fromWeb(res.body as import("stream/web").ReadableStream);
    let received = 0;
    const progressTap = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        received += chunk.length;
        opts?.onProgress?.(received);
        cb(null, chunk);
      },
    });
    await pipeline(nodeStream, progressTap, createWriteStream(destPath));
  }

  async registerDevice(body: {
    name: string;
    platform?: string;
    hostname?: string;
    sync_mode?: string;
    paths?: Record<string, string>;
  }): Promise<RommDevice> {
    return this.request<RommDevice>("POST", "/api/devices", { body });
  }

  async listDevices(): Promise<RommDevice[]> {
    const data = await this.request<RommDevice[] | { items: RommDevice[] }>("GET", "/api/devices");
    return Array.isArray(data) ? data : (data.items ?? []);
  }

  async negotiate(
    deviceId: number,
    roms: SyncLocalRom[],
  ): Promise<NegotiateResponse> {
    return this.request<NegotiateResponse>("POST", "/api/sync/negotiate", {
      body: { device_id: deviceId, roms },
    });
  }

  async completeSession(sessionId: string, body: CompleteSessionBody): Promise<void> {
    await this.request("POST", `/api/sync/sessions/${sessionId}/complete`, {
      body,
      expectJson: false,
    });
  }

  async uploadSave(
    destination: string,
    filePath: string,
    fields: Record<string, string>,
  ): Promise<void> {
    const { readFile } = await import("node:fs/promises");
    const { basename } = await import("node:path");
    const buf = await readFile(filePath);
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    form.append(
      "file",
      new Blob([new Uint8Array(buf)]),
      basename(filePath),
    );
    await this.request("POST", destination, { formData: form, expectJson: false });
  }

  async downloadAsset(source: string, destPath: string): Promise<void> {
    const res = await fetch(this.normalizeUrl(source), { headers: this.headers() });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new RommApiError(`Asset download failed: ${res.status}`, res.status, text);
    }
    await mkdir(dirname(destPath), { recursive: true });
    if (!res.body) throw new RommApiError("Empty response body", res.status);
    const nodeStream = Readable.fromWeb(res.body as import("stream/web").ReadableStream);
    await pipeline(nodeStream, createWriteStream(destPath));
  }
}

export function createRommClient(baseUrl: string, apiToken: string): RommClient {
  return new RommClient({ baseUrl, apiToken });
}
