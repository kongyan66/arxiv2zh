<p align="center">
  <img src="addon/content/icons/arxiv2zh.svg" width="72" alt="arxiv2zh icon">
</p>

<h1 align="center">arxiv2zh</h1>

<p align="center">
  Translate arXiv papers in Zotero with minimal setup and automatically archive well-formatted Chinese PDFs.
</p>

<p align="center">
  <a href="https://github.com/kongyan66/arxiv2zh/actions/workflows/ci.yml"><img src="https://github.com/kongyan66/arxiv2zh/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/kongyan66/arxiv2zh/releases"><img src="https://img.shields.io/github/v/release/kongyan66/arxiv2zh" alt="GitHub Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/kongyan66/arxiv2zh" alt="AGPL-3.0-or-later"></a>
  <a href="https://www.zotero.org/download/"><img src="https://img.shields.io/badge/Zotero-7-CC2936?logo=zotero&amp;logoColor=white" alt="Zotero 7"></a>
  <a href="https://www.zotero.org/download/"><img src="https://img.shields.io/badge/Zotero-8-E76F2E?logo=zotero&amp;logoColor=white" alt="Zotero 8"></a>
  <a href="https://www.zotero.org/download/"><img src="https://img.shields.io/badge/Zotero-9-F2C94C?logo=zotero&amp;logoColor=white" alt="Zotero 9"></a>
</p>

<p align="center"><a href="README.md">简体中文</a></p>

arxiv2zh is a lightweight arXiv translation plugin for Zotero 7-9. No API key
or local translation environment is required: install the plugin, sign in to
[hjfy.top](https://hjfy.top/), and submit translation tasks directly from
Zotero. The service uses large language models and translates from the TeX
source provided by arXiv before recompiling the paper. This preserves formulas,
figures, citations, and document structure as faithfully as possible, produces
a well-formatted Chinese PDF, and automatically attaches it to the corresponding
Zotero item.

> [!IMPORTANT]
> arxiv2zh is an independent community project. It is not affiliated with or
> endorsed by Zotero, arXiv, or hjfy.top. hjfy.top does not provide a stable,
> public plugin API, so server-side changes may temporarily break the plugin.

## Features

- Finds arXiv IDs in item URLs, DOIs, Extra fields, and PDF attachment metadata.
- Supports modern, legacy, and versioned IDs, plus arXiv, DOI, and alphaXiv URLs.
- Handles batch submission, task recovery, retries, and forced re-downloads.
- Creates a preprint item from arXiv metadata when no target item exists.
- Validates the PDF header and trailer before importing it into Zotero storage.
- Shows progress in a toolbar badge and a compact task panel.
- Opens the first-party hjfy.top page for sign-in and reuses cookies stored by
  the Zotero profile.

## Requirements

- Zotero 7, 8, or 9.
- Network access to hjfy.top and the PDF download URL returned by the service.
- An arXiv paper with processable LaTeX source.
- A hjfy.top account when the service requests sign-in.

## Installation

1. Download `arxiv2zh.xpi` from the latest
   [GitHub Release](https://github.com/kongyan66/arxiv2zh/releases).
2. In Zotero, open **Tools → Plugins**.
3. Open the gear menu, choose **Install Plugin From File**, and select the XPI.
4. Restart Zotero.

Install a newer XPI over the existing version to upgrade while retaining local
preferences and task history.

## Usage

### Translate an existing item

Select a regular item or one of its PDF attachments, then choose
**arxiv2zh → Translate to Chinese** from the context menu. Multiple selected
items can be submitted as a batch.

The plugin searches the item URL, DOI, Extra field, and attachment metadata. If
it cannot find an arXiv ID, it opens the manual input prompt.

### Enter an arXiv address

Choose **Tools → arxiv2zh → Enter arXiv URL** and paste an arXiv URL or ID. When
there is no target item, the plugin retrieves metadata and creates a preprint
item.

### Sign-in and task status

The first submission may open the first-party hjfy.top page. After sign-in, the
task continues polling. Closing the window does not delete cookies retained by
the current Zotero profile.

Use the `译` button on the left side of the item toolbar to open the task panel.
Click it again, use the close button, or press `Esc` to dismiss the panel. A
completed attachment is named `Chinese Translation - arxiv2zh`, with a file name
such as `{arxiv-id}_zh_CN.pdf`.

## Preferences

The **arxiv2zh** pane in Zotero Settings provides:

- The hjfy.top service URL.
- Automatic opening of a completed single PDF.
- A polling interval of at least five seconds.
- Local task-history retention.
- Account-page access and removal of cookies for the configured service host.

The service URL must use HTTPS. HTTP is accepted only for local development.

## Data and privacy

arxiv2zh contains no telemetry or advertising and does not store passwords.

| Data                                                     | Location and purpose                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------- |
| arXiv ID, title, Zotero item IDs, status, and timestamps | `arxiv2zh/tasks.json` inside the Zotero data directory, for task recovery |
| Sign-in cookies                                          | Zotero's built-in Firefox profile storage, to retain the service session  |
| Translated PDF                                           | Zotero attachment storage                                                 |
| Service URL and behavior settings                        | Zotero plugin preferences                                                 |

The plugin sends an arXiv ID that you explicitly submit to the configured
service and accesses the PDF URL returned by that service. The download URL may
belong to a separate third-party storage domain. See the full
[Privacy Notice](PRIVACY.md).

## Known limitations

- hjfy.top does not publish a versioned API contract.
- Only arXiv papers and Chinese PDF output are supported; arbitrary local PDFs
  are not accepted.
- Stopping a task only stops local polling because there is no known public
  remote cancellation endpoint.
- Task history is not synchronized through Zotero Sync.
- Translation quality and output content are controlled by the third-party
  service.

## Troubleshooting

- **Blank sign-in page:** update the plugin and verify that hjfy.top opens in a
  regular browser.
- **No LaTeX source:** the paper cannot be processed by the current service.
- **Waiting for sign-in:** open the account page in Preferences, or clear the
  session and sign in again.
- **Invalid response or download failure:** retry later and confirm that the
  service website is available before opening an issue.

Bug reports should include the Zotero version, plugin version, arXiv ID,
reproduction steps, and sanitized errors. Never submit cookies, account data,
signed download URLs, or logs containing private local paths. Use the
[bug report form](https://github.com/kongyan66/arxiv2zh/issues/new?template=bug_report.yml).

## Development

Node.js 20 or later is required. Use a dedicated Zotero profile and data
directory for development.

```bash
git clone https://github.com/kongyan66/arxiv2zh.git
cd arxiv2zh
npm ci
cp .env.example .env
```

Set the Zotero binary, development profile, and optional data directory in
`.env`, then run:

```bash
npm start                 # Development mode
npm test                  # Node unit tests
npm run test:integration  # Isolated Zotero/network integration tests
npm run check             # Formatting, ESLint, types, and unit tests
npm run build             # Production XPI
```

The XPI is written to `.scaffold/build/arxiv2zh.xpi`. Integration tests access
hjfy.top and may create Zotero items and attachments in the configured test data
directory. Never point them at your everyday Zotero data.

See the [design specification](docs/superpowers/specs/2026-08-24-arxiv2zh-design.md),
[contribution guide](CONTRIBUTING.md), and [security policy](SECURITY.md).

## Release process

The project uses Semantic Versioning and `v*` Git tags. Maintainers update the
[changelog](CHANGELOG.md), complete local integration tests, and push a tag.
GitHub Actions builds the XPI and update manifests and creates the release.

## Acknowledgements

- [Zotero](https://www.zotero.org/) provides the reference manager and plugin
  APIs.
- [hjfy.top](https://hjfy.top/) provides the translation service.
- The project is built from
  [zotero-plugin-template](https://github.com/windingwind/zotero-plugin-template)
  and Zotero's native plugin APIs.
- The interaction design was informed by
  [zotero-pdf2zh](https://github.com/guaguastandup/zotero-pdf2zh).

See [Third-Party Notices](THIRD_PARTY_NOTICES.md) for details.

## License

Copyright (C) 2026 kongyan66.

This project is licensed under the
[GNU Affero General Public License v3.0 or later](LICENSE). By contributing, you
agree that your contribution is released under the same license.
