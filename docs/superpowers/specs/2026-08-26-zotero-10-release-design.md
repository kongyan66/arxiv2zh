# arxiv2zh Zotero 10 Compatibility and Release Design

## Context

arxiv2zh is currently version 0.1.3 and its plugin manifest caps supported
Zotero versions at `9.*`. Zotero 10 stable was released on August 17, 2026.
The Zotero 10 developer notes say plugins should set `strict_max_version` to
`10.0.*` after confirming compatibility.

The compatibility scan found one relevant Zotero 10 API risk:
`ZoteroPane.getSelectedLibraryID()` may throw when multiple collection-tree rows
are selected. The plugin uses it only when the user manually enters an arXiv ID
and no selected item can provide a target library.

## Approach

Release arxiv2zh 0.1.4 with a minimal compatibility patch:

- Update `addon/manifest.json` from `strict_max_version: "9.*"` to
  `strict_max_version: "10.0.*"`.
- Replace the direct `getSelectedLibraryID()` fallback with a helper that first
  uses Zotero 10's `getSelectedLibraryIDs()` when available, then falls back to
  the legacy singular API.
- Keep existing behavior when exactly one writable library can be inferred.
- Preserve item-based import behavior, task behavior, UI behavior, and release
  workflow.
- Update `package.json` and `CHANGELOG.md` for version 0.1.4.

## Verification

Run the existing local checks:

- `npm run check`
- `npm run build`

The release workflow already builds the XPI and publishes GitHub release assets
when a `v*` tag is pushed. Publishing this change means committing the patch,
tagging `v0.1.4`, and pushing the branch plus tag.

## Scope

This work does not change translation service protocols, login behavior, PDF
import behavior, localization text, documentation pages, or unrelated generated
LinuxDO files currently present as untracked files.
