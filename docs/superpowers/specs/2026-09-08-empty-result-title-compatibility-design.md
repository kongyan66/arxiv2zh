# hjfy Empty Result Title Compatibility

## Problem

The hjfy result endpoint can return a completed translation with valid PDF URLs
but an empty or missing `title`. For arXiv `2604.27393`, the live response has a
finished status and a valid `zhCN` URL while `title` is an empty string. The
current client rejects that response before downloading the translated PDF.

The workflow already obtains the canonical paper title from arXiv metadata
before polling for completion, so the result endpoint title is not required to
finish or import the translation.

## Behavior

- Treat `arxivFiles.title` as optional metadata.
- Normalize a missing, empty, or whitespace-only result title to an empty
  string.
- Continue to require the result ID, original PDF URL, and translated PDF URL.
- Prefer a non-empty result title when present; otherwise retain the title
  already stored from arXiv metadata.
- Do not change task polling, login, download, PDF validation, or attachment
  import behavior.

## Tests

- Accept a result with an empty title and valid file URLs.
- Accept a result with no title and valid file URLs.
- Preserve a non-empty result title.
- Reject a result missing a required translated PDF URL.
- Run formatting, lint, type checking, and all unit tests.
- Verify the live `2604.27393` response reaches PDF download validation.

## Release

Publish the fix as the next patch release after automated checks and live
response verification succeed. The release notes will describe compatibility
with hjfy results that omit the paper title.
