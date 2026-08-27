import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const tutorialUrl = new URL("../../docs/tutorial.html", import.meta.url);
const indexUrl = new URL("../../docs/index.html", import.meta.url);
const behaviorUrl = new URL("../../docs/assets/tutorial.js", import.meta.url);
const stylesUrl = new URL("../../docs/assets/tutorial.css", import.meta.url);
const readmeUrl = new URL("../../README.md", import.meta.url);
const englishReadmeUrl = new URL("../../README.en-US.md", import.meta.url);
const pagesWorkflowUrl = new URL(
  "../../.github/workflows/pages.yml",
  import.meta.url,
);
const repositoryUrl = "https://github.com/kongyan66/arxiv2zh";
const releaseUrl = `${repositoryUrl}/releases/latest`;
const tutorialPageUrl = "https://kongyan66.github.io/arxiv2zh/tutorial.html";
const expectedImageSources = [
  "assets/images/tutorial-install.webp",
  "assets/images/tutorial-login.webp",
  "assets/images/tutorial-translate.webp",
  "assets/images/tutorial-result.webp",
] as const;

interface OpeningTag {
  name: string;
  attributes: Map<string, string>;
  end: number;
}

function parseAttributes(attributeText: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const attributePattern =
    /\s+([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gy;
  let cursor = 0;

  while (cursor < attributeText.length) {
    if (/^\s*\/?\s*$/.test(attributeText.slice(cursor))) break;

    attributePattern.lastIndex = cursor;
    const match = attributePattern.exec(attributeText);
    assert.ok(match, `invalid attribute text: ${attributeText.slice(cursor)}`);
    attributes.set(
      match[1].toLowerCase(),
      match[2] ?? match[3] ?? match[4] ?? "",
    );
    cursor = attributePattern.lastIndex;
  }

  return attributes;
}

function openingTags(html: string): OpeningTag[] {
  const searchableHtml = html.replace(/<!--[\s\S]*?-->/g, (comment) =>
    " ".repeat(comment.length),
  );
  const lowerHtml = searchableHtml.toLowerCase();
  const tagPattern = /<([A-Za-z][\w:-]*)(?=\s|>)(?:[^"'<>]|"[^"]*"|'[^']*')*>/g;
  const tags: OpeningTag[] = [];
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(searchableHtml))) {
    const [openingTag, originalName] = match;
    const name = originalName.toLowerCase();
    tags.push({
      name,
      attributes: parseAttributes(
        openingTag.slice(originalName.length + 1, -1),
      ),
      end: match.index + openingTag.length,
    });

    if (name === "script" || name === "style") {
      const closingStart = lowerHtml.indexOf(`</${name}`, tagPattern.lastIndex);
      const closingEnd = searchableHtml.indexOf(">", closingStart);
      if (closingStart !== -1 && closingEnd !== -1) {
        tagPattern.lastIndex = closingEnd + 1;
      }
    }
  }

  return tags;
}

function requiredAttribute(tag: OpeningTag, name: string): string {
  const value = tag.attributes.get(name);
  if (value === undefined) {
    assert.fail(`<${tag.name}> requires a ${name} attribute`);
  }
  return value;
}

function localAssetUrls(references: readonly string[]): URL[] {
  return references
    .map((reference) => new URL(reference, tutorialUrl))
    .filter((url) => url.protocol === "file:");
}

function descendantMarkup(html: string, parent: OpeningTag): string {
  const closingTag = new RegExp(`</${parent.name}\\s*>`, "i").exec(
    html.slice(parent.end),
  );
  assert.ok(closingTag, `missing closing <${parent.name}> tag`);
  return html.slice(parent.end, parent.end + closingTag.index);
}

function descendantTags(html: string, parent: OpeningTag): OpeningTag[] {
  return openingTags(descendantMarkup(html, parent));
}

function hrefsWithin(html: string, parent: OpeningTag): string[] {
  return descendantTags(html, parent)
    .filter((tag) => tag.name === "a")
    .map((tag) => requiredAttribute(tag, "href"));
}

test("root page redirects to the canonical tutorial with a fallback link", async () => {
  const html = await readFile(indexUrl, "utf8");
  const tags = openingTags(html);
  const refresh = tags.find(
    (tag) =>
      tag.name === "meta" &&
      tag.attributes.get("http-equiv")?.toLowerCase() === "refresh",
  );
  const canonical = tags.find(
    (tag) =>
      tag.name === "link" &&
      tag.attributes.get("rel")?.toLowerCase() === "canonical",
  );
  const fallbackLinks = tags
    .filter((tag) => tag.name === "a")
    .map((tag) => requiredAttribute(tag, "href"));

  assert.ok(refresh, "root page requires a meta refresh");
  assert.match(
    requiredAttribute(refresh, "content"),
    /url=\.\/tutorial\.html/i,
  );
  assert.ok(canonical, "root page requires a canonical URL");
  assert.equal(requiredAttribute(canonical, "href"), tutorialPageUrl);
  assert.ok(fallbackLinks.includes("./tutorial.html"));
});

test("tutorial page exposes the quickstart sections and destinations", async () => {
  const html = await readFile(tutorialUrl, "utf8");
  const tags = openingTags(html);
  const ids = new Set(tags.flatMap((tag) => tag.attributes.get("id") ?? []));
  const hrefs = tags.flatMap((tag) => tag.attributes.get("href") ?? []);
  const hero = tags.find(
    (tag) => tag.name === "section" && tag.attributes.get("id") === "overview",
  );

  for (const id of ["overview", "install", "login", "translate", "result"]) {
    assert.ok(ids.has(id), `missing #${id}`);
  }

  const heading = tags.find((tag) => tag.name === "h1");
  assert.ok(heading, "missing h1");
  const closingHeading = /<\/h1\s*>/i.exec(html.slice(heading.end));
  assert.ok(closingHeading, "missing closing h1");
  assert.equal(
    html.slice(heading.end, heading.end + closingHeading.index).trim(),
    "arxiv2zh",
  );
  assert.ok(hrefs.includes(releaseUrl));
  assert.ok(hrefs.includes(repositoryUrl));
  assert.ok(hero, "missing hero section");
  const heroText = descendantMarkup(html, hero)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  assert.match(heroText, /第三方服务\s+hjfy\.top/);
  assert.match(heroText, /登录与服务可用性/);
});

test("top and footer navigation expose the expected destinations", async () => {
  const html = await readFile(tutorialUrl, "utf8");
  const tags = openingTags(html);
  const topNavigation = tags.find(
    (tag) =>
      tag.name === "nav" && tag.attributes.get("aria-label") === "主导航",
  );
  const footerNavigation = tags.find(
    (tag) =>
      tag.name === "nav" && tag.attributes.get("aria-label") === "页尾导航",
  );

  assert.ok(topNavigation, "missing top navigation");
  assert.ok(footerNavigation, "missing footer navigation");

  const topHrefs = hrefsWithin(html, topNavigation);
  const footerHrefs = hrefsWithin(html, footerNavigation);
  for (const destination of [
    "#install",
    "#translate",
    releaseUrl,
    repositoryUrl,
  ]) {
    assert.ok(
      topHrefs.includes(destination),
      `top nav is missing ${destination}`,
    );
  }
  for (const destination of [
    `${repositoryUrl}#readme`,
    repositoryUrl,
    `${repositoryUrl}/blob/main/PRIVACY.md`,
    `${repositoryUrl}/issues`,
  ]) {
    assert.ok(
      footerHrefs.includes(destination),
      `footer nav is missing ${destination}`,
    );
  }
});

test("tutorial page uses four accessible, dimensioned local images", async () => {
  const html = await readFile(tutorialUrl, "utf8");
  const images = openingTags(html).filter((tag) => tag.name === "img");
  const sources = images.map((image) => requiredAttribute(image, "src"));

  assert.equal(images.length, 4);
  assert.deepEqual([...sources].sort(), [...expectedImageSources].sort());
  for (const image of images) {
    assert.match(requiredAttribute(image, "src"), /^assets\/images\//);
    assert.ok(requiredAttribute(image, "alt").trim());
    assert.equal(requiredAttribute(image, "width"), "1600");
    assert.equal(requiredAttribute(image, "height"), "1000");
  }
});

test("tutorial layout gives product demonstrations visual priority", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  const rule = (selector: string): string => {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(
      `(?:^|})\\s*${escapedSelector}\\s*{([^}]*)}`,
      "s",
    ).exec(styles);
    assert.ok(match, `missing ${selector} rule`);
    return match[1];
  };
  const fractions = (declarations: string): number[] =>
    [...declarations.matchAll(/([\d.]+)fr/g)].map((match) => Number(match[1]));

  const contentWidth = Number(
    /--content-width:\s*(\d+)px/.exec(styles)?.[1] ?? 0,
  );
  const productWidth = Number(
    /width:\s*min\(100%,\s*(\d+)px\)/.exec(rule(".product-shot"))?.[1] ?? 0,
  );
  const regularTracks = fractions(rule(".step"));
  const reverseTracks = fractions(rule(".step-reverse"));

  assert.ok(contentWidth >= 1240);
  assert.ok(productWidth >= 900);
  assert.equal(regularTracks.length, 2);
  assert.ok(regularTracks[1] > regularTracks[0]);
  assert.equal(reverseTracks.length, 2);
  assert.ok(reverseTracks[0] > reverseTracks[1]);
  assert.match(rule(".product-shot img"), /transform:\s*scale\(1\.[0-9]+\)/);
  assert.match(rule(".step figure img"), /transform:\s*scale\(1\.[0-9]+\)/);
  assert.doesNotMatch(styles, /216px/);
});

test("tutorial references existing local styles, behavior, and screenshots", async () => {
  const html = await readFile(tutorialUrl, "utf8");
  const tags = openingTags(html);
  const imageSources = tags
    .filter((tag) => tag.name === "img")
    .map((tag) => requiredAttribute(tag, "src"));
  const stylesheetReferences = tags
    .filter(
      (tag) =>
        tag.name === "link" &&
        (tag.attributes.get("rel") ?? "")
          .toLowerCase()
          .split(/\s+/)
          .includes("stylesheet"),
    )
    .map((tag) => requiredAttribute(tag, "href"));
  const scriptReferences = tags
    .filter((tag) => tag.name === "script" && tag.attributes.has("src"))
    .map((tag) => requiredAttribute(tag, "src"));

  assert.ok(stylesheetReferences.includes("assets/tutorial.css"));
  assert.ok(scriptReferences.includes("assets/tutorial.js"));
  assert.deepEqual([...imageSources].sort(), [...expectedImageSources].sort());

  const assetUrls = localAssetUrls([
    ...imageSources,
    ...stylesheetReferences,
    ...scriptReferences,
  ]);
  await Promise.all(assetUrls.map((url) => access(url)));
});

test("navigation progressively enhances and remains usable without JavaScript", async () => {
  const [html, behavior, styles] = await Promise.all([
    readFile(tutorialUrl, "utf8"),
    readFile(behaviorUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);
  const tags = openingTags(html);
  const root = tags.find((tag) => tag.name === "html");
  const toggle = tags.find(
    (tag) => tag.name === "button" && tag.attributes.has("aria-controls"),
  );
  const inlineScript = /<script>([\s\S]*?)<\/script>/i.exec(html)?.[1] ?? "";

  assert.ok(root?.attributes.get("class")?.split(/\s+/).includes("no-js"));
  assert.equal(toggle?.attributes.get("aria-controls"), "site-menu");
  assert.equal(toggle?.attributes.get("aria-expanded"), "false");
  assert.match(
    inlineScript,
    /classList\.replace\(\s*["']no-js["']\s*,\s*["']js["']\s*\)/,
  );

  assert.match(behavior, /addEventListener\(\s*["']click["']/);
  assert.match(behavior, /addEventListener\(\s*["']keydown["']/);
  assert.match(behavior, /event\.key\s*===\s*["']Escape["']/);
  assert.match(behavior, /setAttribute\(\s*["']aria-expanded["']/);
  assert.match(behavior, /toggleAttribute\(\s*["']data-open["']/);
  assert.match(behavior, /classList\.add\(\s*["']nav-ready["']/);

  assert.match(styles, /html:not\(\.nav-ready\)\s+\.site-header/);
  assert.match(styles, /\.js\.nav-ready\s+\.nav-toggle/);
  assert.match(styles, /\.js\.nav-ready\s+\.site-menu:not\(\[data-open\]\)/);
});

test("README entry points and Pages workflow publish the tutorial", async () => {
  const [readme, englishReadme, workflow] = await Promise.all([
    readFile(readmeUrl, "utf8"),
    readFile(englishReadmeUrl, "utf8"),
    readFile(pagesWorkflowUrl, "utf8"),
  ]);

  assert.ok(readme.includes(tutorialPageUrl));
  assert.ok(englishReadme.includes(tutorialPageUrl));
  assert.match(workflow, /paths:\s*[\s\S]*?["']docs\/\*\*["']/);
  assert.match(workflow, /actions\/upload-pages-artifact@[0-9a-f]{40}/);
  assert.match(workflow, /with:\s*\n\s+path:\s*docs(?:\s|$)/);
  assert.match(workflow, /actions\/deploy-pages@[0-9a-f]{40}/);
});
