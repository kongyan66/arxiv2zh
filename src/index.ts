import Addon from "./addon";
import { config } from "../package.json";

// @ts-expect-error - Plugin instance is not typed
if (!Zotero[config.addonInstance]) {
  _globalThis.addon = new Addon();
  // @ts-expect-error - Plugin instance is not typed
  Zotero[config.addonInstance] = addon;
}
