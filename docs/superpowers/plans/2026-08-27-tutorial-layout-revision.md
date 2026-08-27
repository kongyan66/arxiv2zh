# arxiv2zh Tutorial Layout Revision Implementation Plan

**Goal:** Correct the tutorial page's oversized vertical whitespace and make every Zotero UI demonstration visibly larger on desktop and mobile.

**Architecture:** Keep the existing dependency-free static tutorial. Reframe the four privacy-safe WebP assets so the useful Zotero UI fills each 1600 × 1000 canvas, then revise only the tutorial layout CSS and focused static tests. Validate with automated checks and real Chrome screenshots before publishing through the existing Pages workflow.

**Tech Stack:** HTML5, CSS, WebP, Node.js tests, Sharp from the bundled workspace runtime for one-time image processing, Playwright, GitHub Actions, GitHub Pages

---

## Task 1: Strengthen the layout contract

**Files:**

- Modify: `test/unit/tutorialSite.test.mts`

- [ ] Add assertions that the tutorial keeps all four 1600 × 1000 accessible image declarations.
- [ ] Add focused stylesheet contract checks for a substantially larger product shot, expanded content width, desktop image-weighted step grid, and removal of the short-screen 216px screenshot cap.
- [ ] Keep tests semantic enough to allow harmless formatting changes.
- [ ] Run the tutorial unit tests and confirm the new contract fails against the current CSS.
- [ ] Commit the failing contract test.

## Task 2: Reframe all privacy-safe tutorial images

**Files:**

- Modify: `docs/assets/images/tutorial-install.webp`
- Modify: `docs/assets/images/tutorial-login.webp`
- Modify: `docs/assets/images/tutorial-translate.webp`
- Modify: `docs/assets/images/tutorial-result.webp`

- [ ] Inspect each existing asset and determine a crop rectangle that retains the action context while removing unused canvas.
- [ ] Crop and resize each image back to 1600 × 1000 with high-quality WebP output.
- [ ] Preserve the current fictional public paper, generic interface data, and absence of personal information.
- [ ] Verify all files decode, remain 1600 × 1000, and keep reasonable file sizes.
- [ ] Render a contact sheet at desktop and mobile display sizes and visually verify that labels and controls are legible.
- [ ] Commit the reframed image assets.

## Task 3: Correct the page layout and enlarge demonstrations

**Files:**

- Modify: `docs/assets/tutorial.css`

- [ ] Remove viewport-height centering from the hero and replace it with natural top-to-bottom spacing.
- [ ] Increase the product shot to the approved 900–1040px desktop range while keeping it full-width within mobile gutters.
- [ ] Separate the third-party service note from the primary lede sizing so it remains visually secondary.
- [ ] Expand the main content width to 1240–1280px.
- [ ] Change desktop step columns so images receive 65%–70% of the row width and reduce the horizontal gap to 48–56px.
- [ ] Switch steps to one column early enough for tablet readability.
- [ ] Remove the short-screen rule that shrinks the product shot to 216px.
- [ ] Preserve dark mode, reduced motion, keyboard navigation, no-JavaScript behavior, fixed breakpoints, and current visual language.
- [ ] Run formatting, linting, type checking, and unit tests.
- [ ] Commit the layout revision.

## Task 4: Browser and visual quality assurance

**Files:**

- Verify: `docs/tutorial.html`
- Verify: `docs/assets/tutorial.css`
- Verify: `docs/assets/tutorial.js`
- Verify: `docs/assets/images/*.webp`

- [ ] Start the static tutorial server on an available local port.
- [ ] Test 1440 × 900, 1024 × 768, 390 × 844, and 320 × 568 in Chrome.
- [ ] Confirm the hero begins naturally below the header and contains no excessive blank area.
- [ ] Confirm the Zotero UI is materially larger than the current release at every viewport.
- [ ] Check horizontal overflow, image aspect ratio, text overlap, mobile menu open/close, Escape handling, dark mode, reduced motion, and no-JavaScript fallback.
- [ ] Fix any visual regressions and rerun the automated checks.
- [ ] Obtain a final independent review and commit any focused corrections.

## Task 5: Publish and verify GitHub Pages

**Files:**

- No new files expected.

- [ ] Confirm the worktree contains only the intended tracked changes plus the pre-existing unrelated `linuxdo-*` files.
- [ ] Push `main` to `origin`.
- [ ] Monitor CI and Pages until both complete successfully.
- [ ] Verify the live tutorial HTML, stylesheet, script, and four WebP assets return successful responses.
- [ ] Open the live page at desktop and mobile widths for a final production check.
