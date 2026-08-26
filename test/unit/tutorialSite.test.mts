import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const tutorialPath = "docs/tutorial.html";

function attribute(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"));
  return match?.[1];
}

test("tutorial page exposes the quickstart sections and destinations", async () => {
  const html = await readFile(tutorialPath, "utf8");

  for (const id of ["overview", "install", "login", "translate", "result"]) {
    assert.match(html, new RegExp(`\\bid=["']${id}["']`));
  }

  assert.match(html, /<h1\b[^>]*>\s*arxiv2zh\s*<\/h1>/i);
  assert.match(
    html,
    /\bhref=["']https:\/\/github\.com\/kongyan66\/arxiv2zh\/releases\/latest["']/,
  );
  assert.match(
    html,
    /\bhref=["']https:\/\/github\.com\/kongyan66\/arxiv2zh["']/,
  );
  assert.ok(html.includes("hjfy.top"));
});

test("tutorial page uses four accessible, dimensioned local images", async () => {
  const html = await readFile(tutorialPath, "utf8");
  const images = html.match(/<img\b[^>]*>/gi) ?? [];

  assert.equal(images.length, 4);
  for (const image of images) {
    assert.match(attribute(image, "src") ?? "", /^assets\/images\//);
    assert.ok((attribute(image, "alt") ?? "").trim());
    assert.match(attribute(image, "width") ?? "", /^\d+$/);
    assert.match(attribute(image, "height") ?? "", /^\d+$/);
  }
});

test("tutorial styles, behavior, and screenshots exist", async () => {
  const assets = [
    "docs/assets/tutorial.css",
    "docs/assets/tutorial.js",
    "docs/assets/images/tutorial-install.webp",
    "docs/assets/images/tutorial-login.webp",
    "docs/assets/images/tutorial-translate.webp",
    "docs/assets/images/tutorial-result.webp",
  ];

  await Promise.all(assets.map((asset) => access(asset)));
});
