# arxiv2zh Design Specification

Date: 2026-08-24

## Summary

arxiv2zh is a Zotero 7-9 plugin that sends arXiv papers through
[hjfy.top](https://hjfy.top/), waits for the Chinese PDF, and imports the
result into Zotero. The primary workflow starts from selected Zotero items or
PDF attachments. A secondary Tools menu command accepts a pasted arXiv URL and
creates a preprint item when no Zotero item is selected.

The plugin uses a native Zotero workflow with an embedded first-party login
window. The Zotero/Firefox profile persists the hjfy.top session cookie. The
plugin never stores passwords or copies cookies into ordinary preferences.

## Goals

- Accept current and legacy arXiv IDs and URLs.
- Resolve arXiv IDs from selected Zotero items and attachments.
- Support single-item and multi-item batch translation.
- Reuse an hjfy.top login across Zotero sessions.
- Poll task state, download the translated PDF, validate it, and import it as
  a child attachment.
- Create a metadata-rich Zotero preprint item for direct URL submissions when
  there is no selected item.
- Provide low-interruption progress plus a task panel for details and recovery.
- Resume unfinished local tasks after Zotero restarts.
- Run and debug on the installed Zotero 9.0.6 while retaining Zotero 7-9
  manifest compatibility.

## Non-Goals

- Uploading arbitrary local PDFs.
- Supporting non-Chinese target languages.
- Hosting or reimplementing the hjfy.top translation service.
- Storing hjfy.top account passwords.
- Cancelling a remote translation; the observed service exposes no cancel
  endpoint.
- Synchronizing task history through Zotero Sync.

## Observed Service Contract

The current hjfy.top web application uses these endpoints:

- `GET /api/arxivInfo/{id}` returns arXiv Atom metadata and `hasSrc`.
- `GET /api/arxivStatus/{id}` returns a task status and progress text.
- `GET /api/arxivFiles/{id}` returns `id`, `title`, `origin`, `zhCN`,
  `zhCNTar`, and `isDeepSeek` after completion.
- A top-level response status of `101` means that login is required.
- The web application polls every 10 seconds and treats `finished`, `failed`,
  `error`, and `fault` as terminal states.
- Loading `/arxiv/{id}` in an authenticated first-party page creates or
  resumes a task. The plugin delegates task creation to this page rather than
  inventing an undocumented submission request.

The endpoints are publicly reachable but are not a documented public API.
All protocol details therefore belong in one `HjfyClient` adapter. UI, task,
metadata, and attachment modules consume normalized domain objects only.

## Architecture

### Interaction Layer

- `ContextMenuController` registers the item/attachment submenu.
- `QuickInputDialog` accepts a pasted arXiv URL or ID.
- `TaskPanelController` owns the toolbar badge and right-side task panel.
- `PreferencesController` manages the small settings surface.

### Core Layer

- `ArxivResolver` extracts and normalizes IDs from direct input, item URL,
  DOI, Extra, and attachment source fields.
- `TaskManager` performs deduplication, batch scheduling, polling, persistence,
  recovery, and task-state transitions.
- `SessionManager` opens the embedded first-party hjfy.top login/account page
  and clears only hjfy.top cookies when the user signs out.
- `MetadataService` parses the Atom response and creates a Zotero preprint item
  when needed.
- `ResultImporter` downloads, validates, names, imports, and optionally opens
  translated PDFs.

### Boundary Layer

- `HjfyClient` maps raw hjfy.top responses to typed results and typed errors.
- `ZoteroAdapter` wraps menu, window, item, attachment, storage, and Reader APIs.
- `TaskStore` persists task records in
  `Zotero.DataDirectory.dir/arxiv2zh/tasks.json` using atomic replacement.

Modules expose narrow interfaces so a service contract change does not affect
Zotero item or UI code.

## User Experience

### Entry Points

The item context menu contains an `arxiv2zh` submenu:

- Translate to Chinese
- Download Again
- View on hjfy.top

The Tools menu contains:

- Enter arXiv URL
- Translation Tasks
- Login / Account

The toolbar icon shows the number of active tasks. Clicking it opens a compact
right-side task panel. A Tools menu fallback opens the same panel if a toolbar
integration is unavailable on a supported Zotero version.

### ID Resolution

For selected items, the resolver checks the item URL, DOI, Extra, and attachment
source metadata in that order. It accepts modern IDs such as `2501.14787v2`
and legacy IDs such as `hep-th/9901001v1`. Versions are preserved for remote
lookup, while a versionless base ID is retained for duplicate checks and
fallback lookup.

If automatic resolution fails, the quick input dialog opens with the selected
item retained as the attachment target.

### Task Panel

Task states are:

- Waiting for login
- Queued
- Translating
- Downloading
- Importing
- Completed
- Failed
- Stopped locally

Each row shows the arXiv ID, paper title when known, current detail, elapsed
time, and the relevant commands: open website, retry, open attachment, stop
local polling, or remove history. Removing history never deletes a Zotero
item or attachment.

Normal work uses a non-modal progress notification. The task panel is opened
only when the user wants details. Completing one paper opens the attachment by
default; a batch completion shows a summary without opening multiple readers.

### Attachments and Duplicates

The stored filename is `{normalizedArxivId}_zh_CN.pdf`. The Zotero attachment
title is `Chinese Translation - arxiv2zh` in English and
`中文翻译 - arxiv2zh` in Chinese.

The duplicate key is the Zotero library, parent item, and versionless arXiv ID.
Normal translation skips an existing completed attachment. `Download Again`
retrieves a fresh file and replaces only the plugin-owned attachment after the
new PDF has passed validation; it does not delete unrelated translation files.

### Direct URL Without a Selection

The plugin parses the Atom XML returned by `arxivInfo` with `DOMParser`. It
creates a Zotero preprint item containing the supported title, creators,
abstract, publication date, arXiv identifier, categories, and canonical URL,
then attaches the translated PDF. It does not download the original PDF.

When a target item already exists, the plugin does not overwrite user-edited
bibliographic fields.

## Authentication and Session Handling

When a status response indicates login is required, `SessionManager` opens a
Zotero content browser on `https://hjfy.top/arxiv/{id}`. Phone, WeChat, CAPTCHA,
and other authentication remain entirely inside the first-party page. Zotero's
Firefox cookie store persists the resulting session in the selected Zotero
profile.

The plugin does not inspect form fields, capture credentials, log cookies, or
serialize cookies into plugin preferences. The account command reopens the
first-party page. `Clear Session` removes cookies scoped to hjfy.top and its
subdomains, after an explicit confirmation.

Once login completes, the first-party page creates or resumes the remote task.
The plugin continues polling the public status endpoint. A login window opened
for a waiting task closes automatically as soon as the status is no longer
login-required. An account window opened explicitly from the Tools menu stays
open until the user closes it. Multiple waiting tasks share one login session
and resume automatically.

## Task Data and Persistence

Each stored task contains:

- Local task ID and deduplication key
- Normalized and versionless arXiv IDs
- Library, target item, and attachment IDs when available
- Paper title and source URL when available
- State, progress detail, attempt count, and last error
- Created, updated, started, and completed timestamps
- Whether the task is a forced re-download

Active tasks are written after every state transition. On startup, queued and
non-terminal tasks resume polling. Completed and failed history is retained for
30 days by default and pruned without touching Zotero data.

## Main Data Flow

1. Resolve and normalize the arXiv ID.
2. Build the deduplication key and check local tasks and attachments.
3. Query `arxivStatus`.
4. If login is required, open the first-party login/task page and keep the
   local task in `waiting-login`.
5. Poll every 10 seconds until a terminal state or the 30-minute local timeout.
6. On completion, request `arxivFiles` immediately before download.
7. Download `zhCN`, verify the PDF, and write an ASCII-only temporary filename.
8. Create metadata when required and import the attachment into Zotero storage.
9. Clean the temporary file, persist completion, notify the user, and open the
   Reader only for an eligible single task.

## Error Handling

- Network errors, HTTP 429, and HTTP 5xx use bounded exponential backoff.
- A local task times out after 30 minutes but can be resumed or retried without
  blindly creating another remote task.
- Batch tasks are isolated; one failure never aborts other papers.
- Signed download URLs are never persisted. `arxivFiles` is fetched again for
  every download retry.
- A downloaded file must contain `%PDF-` within its first 1 KiB and `%%EOF`
  within its last 64 KiB before import.
- Temporary files are removed in `finally` blocks.
- Missing LaTeX source, translation failure, compilation failure, login expiry,
  invalid response shape, and attachment import failure are separate typed
  errors with user-facing recovery actions.
- Unknown response fields are ignored. Missing required fields produce a
  service-compatibility error rather than a misleading generic failure.
- The default service URL must use HTTPS. HTTP is accepted only for localhost
  and `127.0.0.1` development endpoints.

## Preferences

- Service URL, default `https://hjfy.top`
- Open a completed single translation, default enabled
- Polling interval, default 10 seconds with a safe minimum of 5 seconds
- Completed/failed history retention, default 30 days

Login state is displayed but not stored as a preference. Account and cookie
controls are commands, not preference values.

## Testing and Debugging

### Unit Tests

- Modern, versioned, PDF, alphaXiv, and legacy arXiv input parsing
- Item-field resolution priority and invalid input
- State transitions, deduplication, batch isolation, timeout, and restart
  recovery
- Raw response validation and typed error mapping
- Atom metadata parsing
- Attachment naming and duplicate ownership rules
- PDF header/EOF validation

### Contract and Integration Tests

- Mock `arxivInfo`, `arxivStatus`, and `arxivFiles` responses for successful,
  login-required, translating, failed, malformed, and expired-link paths.
- Verify startup, context and Tools menus, preferences, task-panel rendering,
  preprint creation, attachment import, Reader opening, and persisted-task
  recovery inside Zotero.
- Use known completed paper `2501.14787` for a live smoke test of status, signed
  URL refresh, download, PDF validation, and attachment import.
- Run one new-task login flow. The user completes phone/WeChat/CAPTCHA input in
  the first-party window; automated debugging resumes after authentication.

### Release Checks

- TypeScript type checking
- Prettier and ESLint checks
- Unit and Zotero integration tests
- Production XPI build
- Zotero 9.0.6 visual and behavioral verification on macOS
- Manifest compatibility declaration for Zotero 7, 8, and 9

## Implementation Boundaries

The current template examples will be replaced with focused arxiv2zh modules,
localization, preferences, and tests. Existing template/toolkit patterns remain
the baseline. The reference
[zotero-pdf2zh](https://github.com/guaguastandup/zotero-pdf2zh) informs menu,
progress, PDF validation, temporary-file, and attachment-import behavior, but
arxiv2zh will use its own service adapter and task model.

Both the template and reference project use AGPL-3.0-or-later. Any reused code
will retain required attribution and license notices.

## Acceptance Criteria

- A selected arXiv Zotero item can be translated from the context menu and
  receives a valid Chinese PDF child attachment.
- Multiple selected items run independently and report an accurate summary.
- A pasted arXiv URL with no selection creates a populated preprint item and
  attaches the translation.
- Login survives a Zotero restart without storing a password in plugin data.
- Existing plugin-owned translations are skipped unless `Download Again` is
  chosen.
- Interrupted tasks resume after restart, and terminal history can be removed
  without deleting Zotero data.
- The plugin builds and passes its automated checks, and the complete workflow
  is verified in Zotero 9.0.6.
