#!/usr/bin/env node
/* Builds the Omi kit into kit/ from the jig's own sources, without a
   browser: the same files "Export Omi kit" downloads, and the same kit
   the site plays (tools/check-site.js holds the site to it).

     node tools/build-kit.js           write kit/
     node tools/build-kit.js --check   fail if kit/ isn't what it would write

   kit/ is what gets released, so it carries a copy of the player:
   player/omi.js is the source, kit/omi.js is built from it. Edit the
   source, never the copy. Run it after changing a mode, an animation or the
   player, and commit what it writes.

   It also writes what each package needs to ship the kit itself:
   kit/package.json for npm, and a copy of omi.json and LICENSE in the
   Python and the Rust player, so `Kit.bundled()` works from an install.
   Every package's version is the one in the root package.json: this
   writes it into kit/package.json, pyproject.toml, Cargo.toml, the
   Cargo.lock files and the site's header. */
const fs = require("fs"),
  path = require("path"),
  vm = require("vm");

const root = path.join(__dirname, "..");
// the jig's scripts, in the page's order, minus the ones that need a page
const SOURCES = [
  "js/motion.js",
  "js/geometry.js",
  "js/frames.js",
  "js/designs.js",
  "js/render.js",
  "player/omi.js",
  "js/kit.js",
];

// just enough of a browser for those scripts to load
const ctx = vm.createContext({
  console,
  document: {
    createElement: () => ({}),
    head: { appendChild() {} },
  },
});
for (const f of SOURCES)
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, {
    filename: f,
  });

const kitFiles = vm.runInContext("kitFiles()", ctx);
kitFiles["omi.js"] = read("player/omi.js");

const version = JSON.parse(read("package.json")).version,
  license = read("LICENSE"),
  json = kitFiles["omi.json"];

// kit/, as built from the jig, plus what npm needs to publish it
const files = {};
for (const [name, text] of Object.entries(kitFiles))
  files[`kit/${name}`] = text;
Object.assign(files, {
  "kit/omi.d.ts": read("player/omi.d.ts"),
  "kit/LICENSE": license,
  "kit/package.json": JSON.stringify(npmPackage(), null, 2) + "\n",
  // the Python package and the Rust crate carry the kit they were built with
  "player/python/omi/omi.json": json,
  "player/python/LICENSE": license,
  "player/rust/omi.json": json,
  "player/rust/LICENSE": license,
  // one version for every package
  "player/python/pyproject.toml": setVersion(
    read("player/python/pyproject.toml"),
    /^version = ".*"$/m,
    `version = "${version}"`,
  ),
  "player/rust/Cargo.toml": setVersion(
    read("player/rust/Cargo.toml"),
    /^version = ".*"$/m,
    `version = "${version}"`,
  ),
});
// the site shows the release it's at, with a link to it
for (const page of ["index.html", "jig.html", "docs.html"])
  files[page] = setVersion(
    read(page),
    /(releases\/tag\/v)[^"]+("[^]*?>v)[^<]+(<\/a)/,
    `$1${version}$2${version}$3`,
  );
for (const lock of ["player/rust/Cargo.lock", "examples/rust/Cargo.lock"])
  if (fs.existsSync(path.join(root, lock)))
    files[lock] = setVersion(
      read(lock),
      /(\[\[package\]\]\nname = "omi"\nversion = )".*"/,
      `$1"${version}"`,
    );

function read(f) {
  return fs.readFileSync(path.join(root, f), "utf8");
}
function setVersion(text, re, to) {
  if (!re.test(text)) throw new Error(`no version to set (${re})`);
  return text.replace(re, to);
}
function npmPackage() {
  return {
    name: "omi-kit",
    version,
    description:
      "Omi, the Omarchy mascot: every mode as data (omi.json) and the player that draws and morphs it (omi.js)",
    keywords: ["omi", "omarchy", "mascot", "pixel-art", "animation", "canvas"],
    homepage: "https://tahayvr.github.io/omi/",
    repository: {
      type: "git",
      url: "git+https://github.com/tahayvr/omi.git",
      directory: "kit",
    },
    license: "SEE LICENSE IN LICENSE",
    main: "omi.js",
    types: "omi.d.ts",
    exports: {
      ".": { types: "./omi.d.ts", default: "./omi.js" },
      "./omi.json": "./omi.json",
      "./omi.schema.json": "./omi.schema.json",
      "./conformance.json": "./conformance.json",
      "./package.json": "./package.json",
    },
    files: [
      "omi.js",
      "omi.d.ts",
      "omi.json",
      "omi.schema.json",
      "conformance.json",
      "README.md",
      "LICENSE",
    ],
    sideEffects: false,
  };
}

if (process.argv.includes("--check")) {
  const stale = Object.keys(files).filter((name) => {
    const file = path.join(root, name);
    return !fs.existsSync(file) || read(name) !== files[name];
  });
  for (const name of stale) console.log(`FAIL ${name} is out of date`);
  if (stale.length) {
    console.log("run node tools/build-kit.js and commit what it writes");
    process.exit(1);
  }
  console.log(`ok: kit/ and the packages' copies are up to date (${version})`);
  process.exit(0);
}

for (const [name, text] of Object.entries(files)) {
  fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
  fs.writeFileSync(path.join(root, name), text);
}
console.log(
  `kit/: ${Object.keys(kitFiles)
    .map(
      (n) => `${n} (${(Buffer.byteLength(kitFiles[n]) / 1024).toFixed(0)} KB)`,
    )
    .join(", ")}; packages at ${version}`,
);
