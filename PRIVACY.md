# Privacy Notice

Last updated: 2026-08-25

## Summary

arxiv2zh does not contain analytics, advertising, or telemetry. It does not read
or store your hjfy.top password. The plugin sends arXiv identifiers you choose to
submit to the configured translation service and stores enough task information
locally to resume work after Zotero restarts.

## Local data

The plugin stores these records in `arxiv2zh/tasks.json` under the active Zotero
data directory:

- arXiv ID and canonical arXiv URL;
- paper title when available;
- Zotero library, item, and attachment identifiers;
- task status, progress details, errors, timestamps, and retry count.

Behavior settings and the service URL are stored as Zotero plugin preferences.
Translated PDFs are imported into normal Zotero attachment storage.

## Cookies and account data

Sign-in happens in a first-party page opened by Zotero. Cookies are managed by
the built-in Firefox profile used by Zotero. arxiv2zh does not copy cookies into
its task file or preferences and does not access password fields.

The **Clear Session** action removes cookies whose host matches the configured
service host or one of its subdomains. It does not clear unrelated website
cookies.

## Network requests

For an arXiv ID you explicitly submit, the plugin requests metadata, task status,
and result information from the configured service. It then downloads the
translated PDF from the URL returned by that service. That URL can belong to a
separate third-party storage provider.

Opening the website, account page, or an arXiv link is always initiated through
a visible user action or a translation task waiting for sign-in.

The operators of the configured service, download host, and opened websites may
process requests according to their own privacy policies. arxiv2zh does not
control those services.

## Data deletion

- Remove completed task entries from the task panel, or delete
  `arxiv2zh/tasks.json` while Zotero is closed, to clear local task history.
- Use **Clear Session** in the arxiv2zh preferences to remove service cookies.
- Delete translated attachments through Zotero in the same way as other files.
- Uninstalling the plugin does not automatically delete task history, cookies,
  or imported PDFs.

## Diagnostic information

Development builds may write diagnostic messages to the Zotero debug console.
Production builds disable the plugin toolkit's console logging by default.
Before sharing logs, remove account information, cookies, signed download URLs,
and private filesystem paths.

## Changes

Material changes to this notice will be recorded in `CHANGELOG.md`. Questions
and privacy-related bug reports can be submitted through the project's
[GitHub Issues](https://github.com/kongyan66/arxiv2zh/issues).
