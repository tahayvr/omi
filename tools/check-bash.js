#!/usr/bin/env node
/* Checks the bash example's player (examples/bash/omi.awk) against
   kit/conformance.json: every mode at its times, body motion on. Its
   morphs are its own (see omi.awk), and it has no rest scale, so those
   parts of the conformance data don't apply.

     node tools/check-bash.js */
const fs = require("fs"),
  path = require("path"),
  { execFileSync } = require("child_process");

const root = path.join(__dirname, ".."),
  conf = JSON.parse(
    fs.readFileSync(path.join(root, "kit/conformance.json"), "utf8"),
  ),
  tol = conf.tolerance,
  asks = [];
for (const [mode, times] of Object.entries(conf.modes))
  for (const t of Object.keys(times)) asks.push([mode, t]);

const out = execFileSync(
  "bash",
  [path.join(root, "examples/bash/omi.sh"), "--rects"],
  { input: asks.map((a) => a.join(" ")).join("\n") + "\n", encoding: "utf8" },
);
const got = out.split("\n\n").map((block) =>
  block
    .split("\n")
    .filter(Boolean)
    .map((l) => l.split("\t").map((v, i) => (i < 5 ? +v : v))),
);

const fails = [];
asks.forEach(([mode, t], k) => {
  const want = conf.modes[mode][t],
    have = got[k] || [];
  if (have.length !== want.length)
    return fails.push(
      `${mode} at ${t}: ${have.length} rects, not ${want.length}`,
    );
  want.forEach((w, i) => {
    const h = have[i],
      off =
        h[5] !== w[5] ||
        [0, 1, 2, 3].some((j) => Math.abs(h[j] - w[j]) > tol.position) ||
        Math.abs(h[4] - w[4]) > tol.opacity;
    if (off)
      fails.push(`${mode} at ${t}, rect ${i}: ${h.join(" ")} ≠ ${w.join(" ")}`);
  });
});
if (fails.length) {
  console.log(
    `FAIL bash player: ${fails.length} of ${asks.length}:\n  ${fails.slice(0, 20).join("\n  ")}`,
  );
  process.exit(1);
}
console.log(`ok   bash player: ${asks.length} mode frames`);
