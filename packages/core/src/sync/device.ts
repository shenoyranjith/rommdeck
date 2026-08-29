import os from "node:os";
import type { RommClient } from "../romm/client.js";
import type { RommDevice } from "../romm/types.js";
import type { SyncMode } from "../config.js";
import type { SyncPaths } from "./protocol.js";
import { log } from "../log.js";

export interface DeviceRegistration {
  name: string;
  platform: string;
  hostname: string;
  syncMode: SyncMode;
  paths: SyncPaths;
}

function registrationBody(reg: DeviceRegistration): Record<string, unknown> {
  const paths = {
    roms: reg.paths.romsPath,
    saves: reg.paths.savesPath,
    states: reg.paths.statesPath,
  };
  return {
    name: reg.name,
    platform: reg.platform,
    hostname: reg.hostname,
    sync_mode: reg.syncMode,
    sync_config: { paths },
    paths,
  };
}

function pathsFromDevice(device: RommDevice): {
  roms?: string;
  saves?: string;
  states?: string;
} | null {
  const raw = device.sync_config?.paths ?? device.paths;
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, string>;
  return {
    roms: p.roms ?? p.roms_path,
    saves: p.saves ?? p.saves_path,
    states: p.states ?? p.states_path,
  };
}

function pathsMatch(
  device: RommDevice,
  desired: SyncPaths,
): boolean {
  const current = pathsFromDevice(device);
  if (!current) return false;
  return (
    current.roms === desired.romsPath &&
    current.saves === desired.savesPath &&
    current.states === desired.statesPath
  );
}

function syncModeMatches(device: RommDevice, mode: SyncMode): boolean {
  if (!device.sync_mode) return true;
  return device.sync_mode === mode;
}

export interface EnsureDeviceResult {
  deviceId: string;
  registered: boolean;
  updated: boolean;
}

/** Register or refresh RomM device registration when paths/mode change. */
export async function ensureDevice(
  client: RommClient,
  opts: {
    deviceId: string | null;
    deviceName: string;
    syncMode: SyncMode;
    paths: SyncPaths;
    /** Force a new RomM device row (skip fingerprint dedup). */
    registerNew?: boolean;
    /** Clear save sync history when RomM returns an existing fingerprint match. */
    resetSyncHistory?: boolean;
  },
): Promise<EnsureDeviceResult> {
  const baseHostname = os.hostname() || process.env.HOSTNAME || "rommdeck";
  const reg: DeviceRegistration = {
    name: opts.deviceName,
    platform: "retrodeck",
    hostname: opts.registerNew
      ? `${baseHostname}-${slugifyDeviceName(opts.deviceName)}`
      : baseHostname,
    syncMode: opts.syncMode,
    paths: opts.paths,
  };
  const body = registrationBody(reg);

  if (opts.deviceId && !opts.registerNew) {
    try {
      const device = await client.getDevice(opts.deviceId);
      const needsUpdate =
        !pathsMatch(device, opts.paths) ||
        !syncModeMatches(device, opts.syncMode) ||
        (opts.deviceName && device.name !== opts.deviceName);

      if (needsUpdate) {
        await client.updateDevice(opts.deviceId, {
          name: opts.deviceName,
          sync_mode: opts.syncMode,
          sync_config: body.sync_config as { paths: Record<string, string> },
        });
        log.sync("device updated", { deviceId: opts.deviceId, name: opts.deviceName });
        return { deviceId: opts.deviceId, registered: false, updated: true };
      }
      log.debug("sync", "device unchanged", { deviceId: opts.deviceId });
      return { deviceId: opts.deviceId, registered: false, updated: false };
    } catch (e) {
      const status = e && typeof e === "object" && "status" in e ? (e as { status: number }).status : 0;
      if (status !== 404) throw e;
    }
  }

  const device = await client.registerDevice({
    name: reg.name,
    platform: reg.platform,
    hostname: reg.hostname,
    sync_mode: reg.syncMode,
    sync_config: body.sync_config as { paths: Record<string, string> },
    paths: body.paths as Record<string, string>,
    allow_duplicate: opts.registerNew ?? false,
    reset_syncs: opts.resetSyncHistory ?? false,
  });
  log.sync("device registered", {
    deviceId: String(device.id),
    registerNew: opts.registerNew ?? false,
    resetSyncHistory: opts.resetSyncHistory ?? false,
  });
  return {
    deviceId: String(device.id),
    registered: true,
    updated: false,
  };
}

function slugifyDeviceName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "device";
}
