# Repository History Cleanup Design

## Goal

Publish `kongyan66/arxiv2zh` as an independent project without inherited
`zotero-plugin-template` commits, contributors, generated release notes, or
Dependabot branches.

## Repository History

- Preserve the current working tree as the source of truth.
- Remove `.github/dependabot.yml` so automated dependency branches are not
  recreated.
- Replace `main` with one orphan root commit named
  `Initial release v0.1.2`.
- Move the annotated `v0.1.2` tag to that root commit.
- Keep a local backup reference until all remote checks pass.

## GitHub Cleanup

- Force-update `main` and `v0.1.2` because the public repository has just been
  created and has no external development history to preserve.
- Delete all existing `dependabot/*` remote branches. Their pull requests should
  close when their source branches disappear.
- Keep the `release` update channel because Zotero uses its `update.json` asset.
- Replace the generated `v0.1.2` release body with the project-specific notes in
  `CHANGELOG.md` and regenerate release assets from the clean commit.

## Verification

- Confirm `main` contains exactly one commit and one contributor identity.
- Confirm only `main` remains as a development branch.
- Run formatting, linting, type checking, unit tests, and production build.
- Confirm GitHub CI and Release workflows succeed.
- Download the published XPI and verify its archive, manifest, plugin ID, and
  checksum.
- Confirm the update manifest points to the rebuilt `v0.1.2` XPI.

## Recovery

Before rewriting history, create a local backup tag for the previous `main` and
record the old release/tag identifiers. Do not delete the backup until the clean
repository and release have been fully verified.
