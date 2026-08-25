# Changelog

All notable changes to arxiv2zh are documented here. The project follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.2] - 2026-08-25

### Added

- Initial public release for Zotero 7-9.
- arXiv ID discovery from selected items and PDF attachments.
- Single and batch translation tasks through hjfy.top.
- Persistent first-party sign-in using the Zotero profile cookie store.
- Task recovery, retry, stop, removal, and forced re-download actions.
- arXiv metadata import and automatic preprint creation.
- PDF validation before importing translated attachments.
- Toolbar status badge, closable task panel, and preferences pane.
- Simplified Chinese and English interface strings.

### Fixed

- Open the hjfy.top sign-in page with Zotero's supported viewer so the page is
  rendered instead of appearing blank.
- Place the task shortcut in the left item-toolbar group.
- Provide a working task-panel close button and `Esc` dismissal.

### Known limitations

- hjfy.top does not provide a stable public plugin API.
- Only arXiv papers with processable source and Chinese PDF output are supported.
- Stopping a task does not cancel remote service processing.

[Unreleased]: https://github.com/kongyan66/arxiv2zh/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/kongyan66/arxiv2zh/releases/tag/v0.1.2
