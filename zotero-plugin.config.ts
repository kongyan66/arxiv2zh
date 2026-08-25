import { readFileSync } from "node:fs";
import { defineConfig } from "zotero-plugin-scaffold";
import pkg from "./package.json";

function getReleaseNotes() {
  const changelog = readFileSync(
    new URL("./CHANGELOG.md", import.meta.url),
    "utf8",
  );
  const heading = `## [${pkg.version}]`;
  const start = changelog.indexOf(heading);

  if (start === -1) {
    throw new Error(`Missing ${heading} section in CHANGELOG.md`);
  }

  const headingEnd = changelog.indexOf("\n", start);
  const content = changelog.slice(headingEnd + 1);
  const boundaries = [
    content.indexOf("\n## "),
    content.indexOf("\n[Unreleased]:"),
  ]
    .filter((index) => index !== -1)
    .sort((left, right) => left - right);
  return content.slice(0, boundaries[0] ?? content.length).trim();
}

export default defineConfig({
  source: ["src", "addon"],
  dist: ".scaffold/build",
  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,
  xpiName: "arxiv2zh",
  updateURL: `https://github.com/{{owner}}/{{repo}}/releases/download/release/${
    pkg.version.includes("-") ? "update-beta.json" : "update.json"
  }`,
  xpiDownloadLink:
    "https://github.com/{{owner}}/{{repo}}/releases/download/v{{version}}/{{xpiName}}.xpi",

  build: {
    assets: ["addon/**/*.*"],
    define: {
      ...pkg.config,
      author: pkg.author,
      description: pkg.description,
      homepage: pkg.homepage,
      buildVersion: pkg.version,
      buildTime: "{{buildTime}}",
    },
    prefs: {
      prefix: pkg.config.prefsPrefix,
    },
    esbuildOptions: [
      {
        entryPoints: ["src/index.ts"],
        define: {
          __env__: `"${process.env.NODE_ENV}"`,
        },
        bundle: true,
        target: "firefox115",
        outfile: `.scaffold/build/addon/content/scripts/${pkg.config.addonRef}.js`,
      },
    ],
  },

  test: {
    waitForPlugin: `() => Zotero.${pkg.config.addonInstance}.data.initialized`,
  },

  release: {
    changelog: getReleaseNotes,
  },

  // If you need to see a more detailed log, uncomment the following line:
  // logLevel: "trace",
});
