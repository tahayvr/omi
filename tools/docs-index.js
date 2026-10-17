#!/usr/bin/env node
/* Writes docs/index.json, the docs page's table of contents (docs.html),
   from the folders in docs/:

     docs/2-reference/3-state-protocol.md

   is the page "State protocol", third in the section "Reference", second
   on the page, at docs.html?doc=reference/state-protocol. The numbers
   order sections and pages and are left out of the names. Folders without
   a number (docs/modes/, the stills) aren't sections.

   A page that starts with <!-- docs: path --> is shown from that file:
   one that has to stay where it ships (the kit's README goes to npm, the
   players' to PyPI and crates.io). Its links are read from there.

     node tools/docs-index.js           write docs/index.json
     node tools/docs-index.js --check   fail if it isn't what it would write */
const fs = require("fs"),
  path = require("path");

const root = path.join(__dirname, ".."),
  docs = path.join(root, "docs"),
  out = path.join(docs, "index.json"),
  NUMBERED = /^(\d+)-(.+?)(\.md)?$/;

// names as they read: words, a capital to start, and the names of things
const NAMES = {
  omi: "Omi",
  omarchy: "Omarchy",
  python: "Python",
  rust: "Rust",
  javascript: "JavaScript",
  qt: "Qt",
  quickshell: "Quickshell",
  node: "Node",
};
const title = (slug) =>
  slug
    .split("-")
    .map((w, i) => NAMES[w] || (i === 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
const numbered = (dir, files) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) =>
      files ? e.isFile() && e.name.endsWith(".md") : e.isDirectory(),
    )
    .map((e) => ({ name: e.name, m: e.name.match(NUMBERED) }))
    .filter((e) => e.m)
    .sort((a, b) => a.m[1] - b.m[1]);

const index = numbered(docs, false).map(({ name, m }) => {
  const section = m[2];
  return {
    section: title(section),
    pages: numbered(path.join(docs, name), true).map((p) => {
      const file = `docs/${name}/${p.name}`,
        text = fs.readFileSync(path.join(root, file), "utf8"),
        from = text.match(/^<!--\s*docs:\s*(\S+)\s*-->/),
        source = from
          ? path.posix.normalize(
              path.posix.join(path.posix.dirname(file), from[1]),
            )
          : file;
      if (!fs.existsSync(path.join(root, source)))
        throw new Error(`${file} shows ${source}, which isn't there`);
      return {
        id: `${section}/${p.m[2]}`,
        title: title(p.m[2]),
        file,
        source,
      };
    }),
  };
});
const json = JSON.stringify(index, null, 2) + "\n";

if (process.argv.includes("--check")) {
  if (!fs.existsSync(out) || fs.readFileSync(out, "utf8") !== json) {
    console.log(
      "FAIL docs/index.json is out of date: run node tools/docs-index.js",
    );
    process.exit(1);
  }
  console.log(
    `ok: docs/index.json is up to date (${index.length} sections, ${index.reduce((n, s) => n + s.pages.length, 0)} pages)`,
  );
  process.exit(0);
}
fs.writeFileSync(out, json);
console.log(
  `docs/index.json: ${index.map((s) => `${s.section} (${s.pages.length})`).join(", ")}`,
);
