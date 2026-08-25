# Contributing to arxiv2zh

Thank you for helping improve arxiv2zh. Contributions to code, tests,
documentation, and translations are welcome.

## Before you start

- Search existing Issues and pull requests before opening a duplicate.
- Use an Issue to discuss behavior changes or changes to the hjfy.top protocol.
- Report security issues privately as described in `SECURITY.md`.
- Do not include cookies, credentials, signed download URLs, private papers, or
  unsanitized Zotero logs in an Issue or pull request.

## Development setup

Requirements:

- Node.js 20 or later;
- npm;
- Zotero 7-9 for integration testing.

```bash
git clone https://github.com/kongyan66/arxiv2zh.git
cd arxiv2zh
npm ci
cp .env.example .env
```

Configure `.env` with a dedicated Zotero development profile and data directory.
Do not use your everyday Zotero database for integration tests.

## Making a change

1. Fork the repository and create a focused branch.
2. Follow the existing module boundaries and formatting conventions.
3. Add or update focused tests for behavior changes.
4. Update user-facing documentation and both locales when applicable.
5. Run the checks below before opening a pull request.

Use concise commit subjects such as `fix: close the task panel with Escape` or
`docs: clarify cookie storage`. Keep unrelated refactors out of the same pull
request.

## Checks

```bash
npm run check
npm run build
```

For changes involving Zotero APIs, UI, login, downloading, or attachment import,
also run:

```bash
npm run test:integration
```

Integration tests access hjfy.top and can create entries and attachments in the
configured test data directory.

## Pull requests

A pull request should explain:

- the problem and intended behavior;
- the implementation at a high level;
- the checks performed;
- user-visible, privacy, or compatibility effects.

Maintainers may ask for a smaller scope or additional tests. Approval does not
guarantee a release date.

## Third-party protocol changes

hjfy.top does not publish a stable plugin API. Keep raw response parsing and
endpoint assumptions inside `src/modules/hjfyClient.ts`. Include sanitized sample
shapes in tests; never commit real authenticated responses or signed URLs.

## License

By submitting a contribution, you agree to license it under
`AGPL-3.0-or-later`, the license used by this repository.
