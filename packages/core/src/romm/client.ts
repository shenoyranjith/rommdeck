import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import type {
  ClientSaveState,
  CompleteSessionBody,
  NegotiateResponse,
  RommDevice,
  RommPlatform,
  RommRom,
  SyncOperation,
  SyncOpAction,
} from "./types.js";

export class RommApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
  ) {
    super(formatRommApiErrorMessage(message, status, body));
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
      throw new RommApiError(`RomM ${method} ${path}`, res.status, text);
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
    sync_config?: { paths?: Record<string, string> };
    paths?: Record<string, string>;
    allow_duplicate?: boolean;
    allow_existing?: boolean;
    reset_syncs?: boolean;
  }): Promise<RommDevice> {
    const { allow_duplicate, allow_existing, reset_syncs, ...rest } = body;
    const data = await this.request<
      RommDevice | { device_id: string; name?: string | null }
    >("POST", "/api/devices", {
      body: {
        ...rest,
        ...(allow_duplicate != null ? { allow_duplicate } : {}),
        ...(allow_existing != null ? { allow_existing } : {}),
        ...(reset_syncs != null ? { reset_syncs } : {}),
      },
    });
    if ("device_id" in data) {
      return {
        id: data.device_id,
        name: data.name ?? body.name,
        platform: body.platform,
        hostname: body.hostname,
        sync_mode: body.sync_mode,
        sync_config: body.sync_config ?? null,
        paths: body.paths,
      };
    }
    return data;
  }

  async getDevice(deviceId: string): Promise<RommDevice> {
    return this.request<RommDevice>("GET", `/api/devices/${deviceId}`);
  }

  async updateDevice(
    deviceId: string,
    body: {
      name?: string;
      sync_mode?: string;
      sync_config?: { paths?: Record<string, string> };
    },
  ): Promise<RommDevice> {
    return this.request<RommDevice>("PUT", `/api/devices/${deviceId}`, { body });
  }

  async listDevices(): Promise<RommDevice[]> {
    const data = await this.request<RommDevice[] | { items: RommDevice[] }>("GET", "/api/devices");
    return Array.isArray(data) ? data : (data.items ?? []);
  }

  async negotiate(
    deviceId: number | string,
    saves: ClientSaveState[],
  ): Promise<NegotiateResponse> {
    const raw = await this.request<{
      session_id: string | number;
      operations: Array<Record<string, unknown>>;
      total_upload?: number;
      total_download?: number;
      total_conflict?: number;
      total_no_op?: number;
    }>("POST", "/api/sync/negotiate", {
      body: { device_id: String(deviceId), saves },
    });
    return {
      session_id: raw.session_id,
      operations: raw.operations.map((op) => normalizeSyncOperation(op)),
      total_upload: raw.total_upload,
      total_download: raw.total_download,
      total_conflict: raw.total_conflict,
      total_no_op: raw.total_no_op,
    };
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
    appendSaveUploadFile(form, buf, basename(filePath));
    await this.request("POST", destination, { formData: form, expectJson: false });
  }

  /** RomM 4.9+ slot-aware save upload during sync. */
  async uploadSaveForSync(
    romId: number,
    filePath: string,
    opts: {
      slot: string;
      emulator?: string;
      deviceId: string;
      sessionId?: string | number;
      overwrite?: boolean;
    },
  ): Promise<void> {
    const { readFile } = await import("node:fs/promises");
    const { basename } = await import("node:path");
    const buf = await readFile(filePath);
    const form = new FormData();
    appendSaveUploadFile(form, buf, basename(filePath));
    await this.request("POST", "/api/saves", {
      query: {
        rom_id: romId,
        slot: opts.slot,
        emulator: opts.emulator ?? "retroarch",
        device_id: opts.deviceId,
        session_id: opts.sessionId,
        overwrite: opts.overwrite ? "true" : undefined,
      },
      formData: form,
      expectJson: false,
    });
  }

  async downloadSaveContent(
    saveId: number,
    destPath: string,
    opts?: { deviceId?: string; sessionId?: string | number },
  ): Promise<void> {
    const res = await fetch(
      this.url(`/api/saves/${saveId}/content`, {
        device_id: opts?.deviceId,
        session_id: opts?.sessionId,
      }),
      { headers: this.headers() },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new RommApiError(`RomM GET /api/saves/${saveId}/content`, res.status, text);
    }
    await mkdir(dirname(destPath), { recursive: true });
    if (!res.body) throw new RommApiError(`RomM GET /api/saves/${saveId}/content`, res.status);
    const nodeStream = Readable.fromWeb(res.body as import("stream/web").ReadableStream);
    await pipeline(nodeStream, createWriteStream(destPath));
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

export type ConflictUploadResolution = "keep_both" | "server_wins" | "device_wins";

/** RomM expects multipart field name `saveFile` (see backend/endpoints/saves.py). */
function appendSaveUploadFile(form: FormData, buf: Buffer, filename: string): void {
  form.append("saveFile", new Blob([new Uint8Array(buf)]), filename);
}

function formatRommApiErrorMessage(
  prefix: string,
  status: number,
  body?: string,
): string {
  const detail = formatRommApiErrorDetail(body);
  return `${prefix} failed (${status})${detail}`;
}

function formatRommApiErrorDetail(body?: string): string {
  if (!body?.trim()) return "";
  try {
    const parsed = JSON.parse(body) as { detail?: unknown };
    if (parsed.detail !== undefined) {
      const detail =
        typeof parsed.detail === "string"
          ? parsed.detail
          : JSON.stringify(parsed.detail);
      return `: ${detail}`;
    }
  } catch {
    // fall through to raw body
  }
  const trimmed = body.trim();
  return trimmed.length > 500 ? `: ${trimmed.slice(0, 500)}…` : `: ${trimmed}`;
}

function normalizeSyncOperation(raw: Record<string, unknown>): SyncOperation {
  const actionRaw = (raw.action ?? raw.type) as string | undefined;
  const type = normalizeSyncAction(actionRaw);
  const fileName = String(raw.file_name ?? raw.file ?? "");
  return {
    type,
    rom_id: Number(raw.rom_id),
    file: fileName,
    file_name: fileName,
    save_id: raw.save_id == null ? null : Number(raw.save_id),
    slot: raw.slot == null ? null : String(raw.slot),
    emulator: raw.emulator == null ? null : String(raw.emulator),
    reason: raw.reason == null ? undefined : String(raw.reason),
    destination: raw.destination == null ? undefined : String(raw.destination),
    source: raw.source == null ? undefined : String(raw.source),
    dest_path: raw.dest_path == null ? undefined : String(raw.dest_path),
    resolution: raw.resolution as SyncOperation["resolution"],
    server_updated_at:
      raw.server_updated_at == null ? undefined : String(raw.server_updated_at),
    server_content_hash:
      raw.server_content_hash == null ? null : String(raw.server_content_hash),
  };
}

function normalizeSyncAction(action: string | undefined): SyncOpAction {
  switch (action) {
    case "upload":
    case "download":
    case "conflict":
      return action;
    case "noop":
    case "no_op":
      return "no_op";
    default:
      throw new Error(`Unknown sync operation action: ${action ?? "(missing)"}`);
  }
}
