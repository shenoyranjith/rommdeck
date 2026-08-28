import { join } from "node:path";

export interface EsdePaths {
  gamelistsRoot: string;
  mediaRoot: string;
}

/** Resolve ES-DE gamelist + media directories under RetroDECK home. */
export function resolveEsdePaths(
  rdHomePath: string,
  downloadedMediaPath?: string,
): EsdePaths {
  const home = rdHomePath.replace(/\/+$/, "");
  return {
    gamelistsRoot: join(home, "ES-DE", "gamelists"),
    mediaRoot: downloadedMediaPath?.replace(/\/+$/, "") || join(home, "ES-DE", "downloaded_media"),
  };
}

export function gamelistFilePath(gamelistsRoot: string, esdeFolder: string): string {
  return join(gamelistsRoot, esdeFolder, "gamelist.xml");
}

export function mediaTypeDir(mediaRoot: string, esdeFolder: string, mediaType: string): string {
  return join(mediaRoot, esdeFolder, mediaType);
}
