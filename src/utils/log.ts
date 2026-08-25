import { config } from "../../package.json";

export function debugLog(message: string): void {
  if (__env__ !== "development") return;
  Zotero.debug(`[${config.addonName}] ${message}`);
}
