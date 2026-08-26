import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const tutorialUrl = new URL("../../docs/tutorial.html", import.meta.url);
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

test("tutorial page exposes the quickstart sections and destinations", async () => {
  const html = await readFile(tutorialUrl, "utf8");
  const tags = openingTags(html);
  const ids = new Set(tags.flatMap((tag) => tag.attributes.get("id") ?? []));
  const hrefs = tags.flatMap((tag) => tag.attributes.get("href") ?? []);

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
  assert.ok(
    hrefs.includes("https://github.com/kongyan66/arxiv2zh/releases/latest"),
  );
  assert.ok(hrefs.includes("https://github.com/kongyan66/arxiv2zh"));
  assert.ok(html.includes("hjfy.top"));
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
    assert.match(requiredAttribute(image, "width"), /^\d+$/);
    assert.match(requiredAttribute(image, "height"), /^\d+$/);
  }
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
