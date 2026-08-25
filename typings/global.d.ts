declare const _globalThis: {
  [key: string]: any;
  Zotero: _ZoteroTypes.Zotero;
  addon: typeof addon;
};

declare const rootURI: string;

declare const addon: import("../src/addon").default;

declare const __env__: "production" | "development";
