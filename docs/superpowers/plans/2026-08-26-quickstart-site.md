# arxiv2zh Quickstart Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a concise Apple-inspired GitHub Pages quickstart that introduces arxiv2zh and teaches installation, login, translation, and result retrieval with privacy-safe screenshots.

**Architecture:** Serve a dependency-free static site from `docs/`, with semantic HTML, one focused stylesheet, and progressive-enhancement JavaScript. Validate critical content and links with the existing Node test runner, deploy `docs/` through an isolated GitHub Pages workflow, and keep plugin CI and release automation unchanged.

**Tech Stack:** HTML5, CSS custom properties, vanilla JavaScript, Node.js `node:test`, GitHub Actions, GitHub Pages

---

## File Map

- Create `docs/index.html`: lightweight root entry that forwards users to the tutorial.
- Create `docs/tutorial.html`: semantic one-page product introduction and quickstart.
- Create `docs/assets/tutorial.css`: responsive visual system, layout, dark mode, and reduced-motion rules.
- Create `docs/assets/tutorial.js`: mobile navigation and progressive scroll-state enhancement.
- Create `docs/assets/images/tutorial-install.webp`: privacy-safe plugin installation screenshot.
- Create `docs/assets/images/tutorial-login.webp`: privacy-safe service login entry screenshot.
- Create `docs/assets/images/tutorial-translate.webp`: privacy-safe right-click translation screenshot.
- Create `docs/assets/images/tutorial-result.webp`: privacy-safe completed attachment and task-panel screenshot.
- Create `test/unit/tutorialSite.test.mts`: static contract tests for page structure, links, accessibility hooks, and assets.
- Create `.github/workflows/pages.yml`: isolated Pages deployment workflow.
- Modify `README.md`: add a Chinese tutorial link near the top.
- Modify `README.en-US.md`: add an English-labeled link to the Chinese visual quickstart.

### Task 1: Lock the tutorial contract with failing tests

**Files:**

- Create: `test/unit/tutorialSite.test.mts`

- [ ] **Step 1: Add static page contract tests**

```ts
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const tutorialPath = new URL("../../docs/tutorial.html", import.meta.url);

test("tutorial exposes the quickstart structure and project links", async () => {
  const html = await readFile(tutorialPath, "utf8");
  for (const anchor of [
    "overview",
    "install",
    "login",
    "translate",
    "result",
  ]) {
    assert.match(html, new RegExp(`id=["']${anchor}["']`));
  }
  assert.match(html, /<h1[^>]*>\s*arxiv2zh\s*<\/h1>/i);
  assert.match(html, /github\.com\/kongyan66\/arxiv2zh\/releases\/latest/);
  assert.match(html, /github\.com\/kongyan66\/arxiv2zh/);
  assert.match(html, /hjfy\.top/);
});

test("tutorial images have local sources, dimensions, and alternative text", async () => {
  const html = await readFile(tutorialPath, "utf8");
  const images = [...html.matchAll(/<img\s+([^>]+)>/g)].map(
    (match) => match[1],
  );
  assert.equal(images.length, 4);
  for (const attributes of images) {
    assert.match(attributes, /src=["']assets\/images\//);
    assert.match(attributes, /alt=["'][^"']+["']/);
    assert.match(attributes, /width=["']\d+["']/);
    assert.match(attributes, /height=["']\d+["']/);
  }
});

test("all declared tutorial assets exist", async () => {
  for (const asset of [
    "../../docs/assets/tutorial.css",
    "../../docs/assets/tutorial.js",
    "../../docs/assets/images/tutorial-install.webp",
    "../../docs/assets/images/tutorial-login.webp",
    "../../docs/assets/images/tutorial-translate.webp",
    "../../docs/assets/images/tutorial-result.webp",
  ]) {
    await access(new URL(asset, import.meta.url));
  }
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run: `node --experimental-strip-types --test test/unit/tutorialSite.test.mts`

Expected: FAIL with `ENOENT` for `docs/tutorial.html`.

- [ ] **Step 3: Commit the failing contract test**

```bash
git add test/unit/tutorialSite.test.mts
git commit -m "test: define quickstart site contract"
```

### Task 2: Build semantic tutorial content

**Files:**

- Create: `docs/index.html`
- Create: `docs/tutorial.html`

- [ ] **Step 1: Add the root entry page**

Create `docs/index.html` as an accessible immediate redirect with a usable fallback:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="0; url=./tutorial.html" />
    <title>arxiv2zh 使用说明</title>
    <link
      rel="canonical"
      href="https://kongyan66.github.io/arxiv2zh/tutorial.html"
    />
  </head>
  <body>
    <p><a href="./tutorial.html">进入 arxiv2zh 快速上手</a></p>
  </body>
</html>
```

- [ ] **Step 2: Add the product introduction and quickstart sections**

Create `docs/tutorial.html` with this semantic skeleton and the approved concise Chinese copy:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#ffffff" />
    <meta
      name="description"
      content="arxiv2zh 快速上手：在 Zotero 中翻译 arXiv 论文并自动归档中文 PDF。"
    />
    <title>arxiv2zh · Zotero arXiv 中文翻译快速上手</title>
    <link rel="stylesheet" href="assets/tutorial.css" />
    <script src="assets/tutorial.js" defer></script>
  </head>
  <body>
    <a class="skip-link" href="#main">跳到主要内容</a>
    <header class="site-header">
      <nav class="nav-shell" aria-label="主导航">
        <a class="brand" href="#overview" aria-label="arxiv2zh 首页"
          >arxiv2zh</a
        >
        <button
          class="nav-toggle"
          type="button"
          aria-expanded="false"
          aria-controls="site-menu"
        >
          <span class="sr-only">打开导航</span>
        </button>
        <div class="site-menu" id="site-menu">
          <a href="#install">安装</a><a href="#translate">翻译</a>
          <a
            href="https://github.com/kongyan66/arxiv2zh"
            target="_blank"
            rel="noreferrer"
            >GitHub</a
          >
        </div>
      </nav>
    </header>
    <main id="main">
      <section class="hero" id="overview">
        <div class="hero-copy">
          <p class="eyebrow">Zotero × arXiv</p>
          <h1>arxiv2zh</h1>
          <p class="hero-lede">
            简单配置，即可在 Zotero 中翻译 arXiv 论文，并自动归档排版完整的中文
            PDF。
          </p>
          <div class="hero-actions">
            <a
              class="button button-primary"
              href="https://github.com/kongyan66/arxiv2zh/releases/latest"
              >下载插件</a
            >
            <a
              class="button button-secondary"
              href="https://github.com/kongyan66/arxiv2zh"
              >查看源码</a
            >
          </div>
        </div>
        <figure class="product-shot">
          <img
            src="assets/images/tutorial-result.webp"
            alt="arxiv2zh 在 Zotero 中显示完成的中文 PDF 附件"
            width="1600"
            height="1000"
          />
        </figure>
      </section>
      <section class="step" id="install">
        <div class="step-copy">
          <p class="step-number">01</p>
          <h2>安装插件</h2>
          <p>
            从 GitHub Release 下载 <code>arxiv2zh.xpi</code>，在 Zotero 的“工具
            → 插件”中选择“从文件安装插件”，随后重启 Zotero。
          </p>
        </div>
        <figure>
          <img
            src="assets/images/tutorial-install.webp"
            alt="在 Zotero 插件管理器中从文件安装 arxiv2zh"
            width="1600"
            height="1000"
          />
        </figure>
      </section>
      <section class="step step-reverse" id="login">
        <div class="step-copy">
          <p class="step-number">02</p>
          <h2>登录一次</h2>
          <p>
            从 arxiv2zh 设置或任务面板打开 hjfy.top 并完成登录。Cookie
            保存在当前 Zotero 配置中，无需每次重复登录。
          </p>
        </div>
        <figure>
          <img
            src="assets/images/tutorial-login.webp"
            alt="从 arxiv2zh 打开 hjfy.top 登录入口"
            width="1600"
            height="1000"
          />
        </figure>
      </section>
      <section class="step" id="translate">
        <div class="step-copy">
          <p class="step-number">03</p>
          <h2>翻译为中文</h2>
          <p>
            选中包含 arXiv 信息的条目或 PDF 附件，右键选择“arxiv2zh →
            翻译为中文”。
          </p>
        </div>
        <figure>
          <img
            src="assets/images/tutorial-translate.webp"
            alt="在 Zotero 条目右键菜单中选择翻译为中文"
            width="1600"
            height="1000"
          />
        </figure>
      </section>
      <section class="result" id="result">
        <div>
          <p class="eyebrow">完成</p>
          <h2>中文 PDF 自动回到 Zotero</h2>
          <p>
            翻译服务使用 arXiv 的 TeX
            源码翻译并重新编译，尽可能保留公式、图表、引用与论文结构。完成后，中文
            PDF 自动成为原条目的子附件。
          </p>
        </div>
      </section>
    </main>
    <footer>
      <p>兼容 Zotero 7–9 · arxiv2zh 是独立社区项目，hjfy.top 为第三方服务。</p>
      <nav aria-label="页尾导航">
        <a href="https://github.com/kongyan66/arxiv2zh/blob/main/PRIVACY.md"
          >隐私说明</a
        ><a href="https://github.com/kongyan66/arxiv2zh/issues">问题反馈</a>
      </nav>
    </footer>
  </body>
</html>
```

- [ ] **Step 3: Run the contract test and confirm only style/script/image assertions remain**

Run: `node --experimental-strip-types --test test/unit/tutorialSite.test.mts`

Expected: the structure test passes; the asset test fails because assets do not exist yet.

- [ ] **Step 4: Commit semantic content**

```bash
git add docs/index.html docs/tutorial.html
git commit -m "docs: add quickstart tutorial content"
```

### Task 3: Implement the Apple-inspired responsive presentation

**Files:**

- Create: `docs/assets/tutorial.css`
- Create: `docs/assets/tutorial.js`

- [ ] **Step 1: Create the visual system and responsive layout**

Implement `docs/assets/tutorial.css` with these required primitives:

```css
:root {
  color-scheme: light dark;
  --page: #ffffff;
  --band: #f5f5f7;
  --text: #1d1d1f;
  --muted: #6e6e73;
  --line: rgba(0, 0, 0, 0.1);
  --brand: #087f5b;
  --brand-hover: #066b4d;
  --shell: min(1120px, calc(100% - 48px));
  font-family:
    -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC",
    "Microsoft YaHei", sans-serif;
}
* {
  box-sizing: border-box;
}
html {
  scroll-behavior: smooth;
}
body {
  margin: 0;
  background: var(--page);
  color: var(--text);
  letter-spacing: 0;
}
.site-header {
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--page) 88%, transparent);
  backdrop-filter: saturate(180%) blur(18px);
}
.nav-shell {
  width: var(--shell);
  min-height: 52px;
  margin: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.hero {
  min-height: calc(100svh - 52px);
  padding: clamp(64px, 9vh, 112px) 0 0;
  overflow: hidden;
  background: var(--band);
}
.hero-copy,
.hero .product-shot,
.step,
.result > div,
footer {
  width: var(--shell);
  margin-inline: auto;
}
.hero-copy {
  text-align: center;
  max-width: 780px;
}
h1 {
  margin: 12px 0 18px;
  font-size: clamp(52px, 7vw, 88px);
  line-height: 0.98;
}
h2 {
  margin: 0 0 18px;
  font-size: clamp(34px, 5vw, 58px);
  line-height: 1.06;
}
.hero-lede {
  margin: auto;
  max-width: 700px;
  color: var(--muted);
  font-size: clamp(19px, 2.2vw, 28px);
  line-height: 1.45;
}
.step {
  min-height: 76vh;
  padding-block: clamp(72px, 10vw, 144px);
  display: grid;
  grid-template-columns: minmax(260px, 0.8fr) minmax(0, 1.2fr);
  gap: clamp(48px, 8vw, 112px);
  align-items: center;
}
.step-reverse .step-copy {
  order: 2;
}
figure {
  margin: 0;
}
.product-shot img,
.step img {
  display: block;
  width: 100%;
  height: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.12);
}
.button {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  padding: 0 21px;
  text-decoration: none;
  border-radius: 999px;
}
.button-primary {
  color: #fff;
  background: var(--brand);
}
.button-primary:hover {
  background: var(--brand-hover);
}
@media (max-width: 720px) {
  :root {
    --shell: min(100% - 32px, 1120px);
  }
  .step {
    grid-template-columns: 1fr;
    min-height: auto;
  }
  .step-reverse .step-copy {
    order: initial;
  }
  .site-menu {
    display: none;
  }
  .site-menu[data-open="true"] {
    display: grid;
    position: absolute;
    inset: 52px 0 auto;
    padding: 16px;
    background: var(--page);
  }
}
@media (prefers-color-scheme: dark) {
  :root {
    --page: #000000;
    --band: #161617;
    --text: #f5f5f7;
    --muted: #a1a1a6;
    --line: rgba(255, 255, 255, 0.16);
    --brand: #32b98a;
    --brand-hover: #47c99b;
  }
}
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Append the remaining navigation, accessibility, content, and footer rules:

```css
body {
  min-width: 320px;
  line-height: 1.5;
}
a {
  color: inherit;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.skip-link {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 100;
  padding: 9px 13px;
  color: #fff;
  background: var(--brand);
  transform: translateY(-150%);
}
.skip-link:focus {
  transform: translateY(0);
}
.brand {
  color: var(--brand);
  font-size: 18px;
  font-weight: 700;
  text-decoration: none;
}
.site-menu {
  display: flex;
  align-items: center;
  gap: 28px;
}
.site-menu a {
  color: var(--muted);
  font-size: 14px;
  text-decoration: none;
}
.site-menu a:hover {
  color: var(--text);
}
.nav-toggle {
  display: none;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  color: var(--text);
  background: transparent;
}
.nav-toggle::before {
  content: "☰";
  font-size: 20px;
}
.nav-toggle[aria-expanded="true"]::before {
  content: "×";
}
.eyebrow,
.step-number {
  margin: 0;
  color: var(--brand);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}
.hero-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 30px;
}
.button-secondary {
  border: 1px solid var(--line);
  color: var(--text);
  background: var(--page);
}
.hero .product-shot {
  width: min(1120px, calc(100% - 48px));
  margin: clamp(54px, 8vh, 88px) auto -18%;
}
.step-copy p:not(.step-number),
.result p,
footer {
  color: var(--muted);
  font-size: 18px;
}
.step-number {
  margin-bottom: 18px;
}
.step:nth-of-type(even) {
  background: var(--band);
}
.result {
  padding-block: clamp(92px, 14vw, 180px);
  text-align: center;
  background: var(--band);
}
.result > div {
  max-width: 850px;
}
.result p {
  max-width: 760px;
  margin-inline: auto;
}
footer {
  padding-block: 36px;
  display: flex;
  justify-content: space-between;
  gap: 24px;
  border-top: 1px solid var(--line);
  font-size: 13px;
}
footer p {
  margin: 0;
}
footer nav {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}
footer a {
  color: var(--muted);
}
:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--brand) 72%, white);
  outline-offset: 3px;
}
@media (max-width: 720px) {
  .nav-toggle {
    display: inline-grid;
    place-items: center;
  }
  .site-menu {
    gap: 0;
    border-bottom: 1px solid var(--line);
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.12);
  }
  .site-menu a {
    min-height: 44px;
    display: flex;
    align-items: center;
    padding-inline: 16px;
  }
  .hero {
    min-height: auto;
    padding-top: 70px;
  }
  .hero .product-shot {
    width: calc(100% - 32px);
    margin-top: 54px;
    margin-bottom: -10%;
  }
  .hero-actions .button {
    flex: 1 1 150px;
  }
  .step {
    gap: 36px;
  }
  footer {
    display: grid;
  }
}
```

- [ ] **Step 2: Add progressive mobile navigation**

Create `docs/assets/tutorial.js`:

```js
const toggle = document.querySelector(".nav-toggle");
const menu = document.querySelector("#site-menu");

toggle?.addEventListener("click", () => {
  const isOpen = toggle.getAttribute("aria-expanded") === "true";
  toggle.setAttribute("aria-expanded", String(!isOpen));
  menu?.setAttribute("data-open", String(!isOpen));
});

menu?.addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLAnchorElement)) return;
  toggle?.setAttribute("aria-expanded", "false");
  menu.removeAttribute("data-open");
});
```

- [ ] **Step 3: Format and inspect the new files**

Run: `npx prettier --write docs/index.html docs/tutorial.html docs/assets/tutorial.css docs/assets/tutorial.js`

Expected: four files formatted without errors.

- [ ] **Step 4: Commit presentation files**

```bash
git add docs/index.html docs/tutorial.html docs/assets/tutorial.css docs/assets/tutorial.js
git commit -m "style: add responsive tutorial presentation"
```

### Task 4: Produce privacy-safe Zotero screenshots

**Files:**

- Create: `docs/assets/images/tutorial-install.webp`
- Create: `docs/assets/images/tutorial-login.webp`
- Create: `docs/assets/images/tutorial-translate.webp`
- Create: `docs/assets/images/tutorial-result.webp`

- [ ] **Step 1: Start Zotero with the isolated development profile**

Run: `npm start`

Expected: Zotero starts with the project development profile and loads arxiv2zh.

- [ ] **Step 2: Create the public demonstration state**

Use one public arXiv example item, such as `1706.03762`, and ensure the visible library contains only the example paper and generated plugin attachments. Do not sign in with or display personal account identifiers.

- [ ] **Step 3: Capture the four approved states**

Capture installation, login entry, right-click translation, and completed result at a consistent desktop size. Crop each image to the Zotero window or relevant panel, leaving no system menu bar, private library, filesystem path, account name, Cookie, or signed download URL.

- [ ] **Step 4: Convert and optimize screenshots**

Run once for each source PNG:

```bash
sips -s format webp screenshot.png --out docs/assets/images/tutorial-result.webp
```

Expected: each WebP exists, opens successfully, and remains legible at 1600px or less on its long edge.

- [ ] **Step 5: Run the asset contract test**

Run: `node --experimental-strip-types --test test/unit/tutorialSite.test.mts`

Expected: PASS for structure, image attributes, and all asset paths.

- [ ] **Step 6: Commit reviewed screenshots**

```bash
git add docs/assets/images test/unit/tutorialSite.test.mts
git commit -m "docs: add privacy-safe tutorial screenshots"
```

### Task 5: Add discoverability and Pages deployment

**Files:**

- Modify: `README.md`
- Modify: `README.en-US.md`
- Create: `.github/workflows/pages.yml`

- [ ] **Step 1: Add tutorial links to both README introductions**

Add below the language switch in `README.md`:

```md
<p align="center">
  <a href="https://kongyan66.github.io/arxiv2zh/tutorial.html">图文快速上手</a>
</p>
```

Add the equivalent entry in `README.en-US.md`:

```md
<p align="center">
  <a href="https://kongyan66.github.io/arxiv2zh/tutorial.html">Visual quickstart (Chinese)</a>
</p>
```

- [ ] **Step 2: Add the isolated Pages workflow**

Create `.github/workflows/pages.yml`:

```yaml
name: Pages

on:
  push:
    branches: [main]
    paths:
      - "docs/**"
      - ".github/workflows/pages.yml"
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
      - name: Configure Pages
        uses: actions/configure-pages@983d7736d9b0ae728b81ab479565c72886d7745b # v5
      - name: Upload site
        uses: actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa # v3
        with:
          path: docs
      - name: Deploy Pages
        id: deployment
        uses: actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e # v4
```

- [ ] **Step 3: Run repository checks**

Run: `npm run check`

Expected: Prettier, ESLint, TypeScript, and all Node unit tests pass.

- [ ] **Step 4: Commit links and deployment workflow**

```bash
git add README.md README.en-US.md .github/workflows/pages.yml
git commit -m "ci: publish quickstart with GitHub Pages"
```

### Task 6: Perform visual QA and publish

**Files:**

- Review and correct: `docs/tutorial.html`
- Review and correct: `docs/assets/tutorial.css`
- Review and correct: `docs/assets/tutorial.js`

- [ ] **Step 1: Start a local static server**

Run: `python3 -m http.server 4173 --directory docs`

Expected: `http://localhost:4173/` redirects to a working `tutorial.html` page.

- [ ] **Step 2: Verify desktop and mobile layouts**

Inspect at 1440×900, 1024×768, 390×844, and 320×568. Confirm the hero identifies the product in the first viewport, hints at following content, all four images render, and no text or controls overlap or overflow.

- [ ] **Step 3: Verify interaction and accessibility states**

Check keyboard navigation, visible focus, mobile menu open/close, JavaScript-disabled reading, light mode, dark mode, and reduced-motion mode. Confirm external links and the Release download target are correct.

- [ ] **Step 4: Run the final automated suite**

Run: `npm run check && npm run build`

Expected: all checks pass and `.scaffold/build/arxiv2zh.xpi` is generated.

- [ ] **Step 5: Commit any QA corrections**

```bash
git add docs test/unit/tutorialSite.test.mts
git commit -m "fix: polish tutorial responsive layout"
```

Skip this commit only when QA requires no changes.

- [ ] **Step 6: Push the clean implementation history**

Run: `git push origin main`

Expected: the push succeeds and both CI and Pages workflows start.

- [ ] **Step 7: Enable GitHub Actions as the Pages source**

Run: `gh api --method POST repos/kongyan66/arxiv2zh/pages -f build_type=workflow`

Expected: HTTP 201 when Pages is first enabled. If Pages is already enabled, query `gh api repos/kongyan66/arxiv2zh/pages` and confirm `build_type` is `workflow`.

- [ ] **Step 8: Verify the deployed site**

Run: `curl -fsS https://kongyan66.github.io/arxiv2zh/tutorial.html | grep -F '<h1>arxiv2zh</h1>'`

Expected: the command prints the product heading, and the live page loads all four screenshots without mixed-content or 404 errors.
