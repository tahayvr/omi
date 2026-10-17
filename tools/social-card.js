#!/usr/bin/env node
/* Makes the social card, assets/social.png: the picture a link to the site
   or the repo shows (og:image on the pages, and the repo's social preview
   on GitHub). Omi is drawn by the kit's own player, at a scale where every
   logo cell is whole pixels, in the site's default theme (Tokyo Night).

     node tools/social-card.js          write assets/social.png
     node tools/social-card.js out.png  write it somewhere else

   It needs Chrome or Chromium (the one it finds, or the one CHROME names),
   which it runs without a window. Run it again after a change to the kit
   that shows on the card, and commit the picture. GitHub doesn't read the
   picture from the repo: upload it in the repo's Settings, Social preview. */
const fs = require("fs"),
  os = require("os"),
  path = require("path"),
  { spawnSync } = require("child_process");

const root = path.join(__dirname, ".."),
  out = path.resolve(process.argv[2] || path.join(root, "assets/social.png")),
  read = (f) => fs.readFileSync(path.join(root, f), "utf8");

const W = 1280,
  H = 640,
  BG = "#1a1b26",
  FG = "#9ece6a",
  TEXT = "#c0caf5",
  DIM = "#9aa3c7";

const page = `<!doctype html>
<html><head><meta charset="utf-8" />
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=block" rel="stylesheet" />
<style>
  html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: ${BG}; }
  body { position: relative; color: ${TEXT}; font-family: "JetBrains Mono", Menlo, "DejaVu Sans Mono", monospace; }
  #big { position: absolute; image-rendering: pixelated; }
  /* the words, the modes and how to get it: one column, centered */
  .copy { position: absolute; left: 640px; top: 50%; transform: translateY(-50%);
          display: flex; flex-direction: column; align-items: flex-start; }
  .tag { margin: 0; font-size: 34px; line-height: 1.3; font-weight: 600; }
  .sub { margin: 12px 0 0; font-size: 20px; line-height: 1.5; color: ${DIM}; }
  #row { display: block; margin: 26px 0 0 -14px; image-rendering: pixelated; }
  .install { margin: 26px 0 0; font-size: 18px; color: ${DIM}; line-height: 1.8; }
  .install b { color: ${FG}; font-weight: 600; }
</style></head>
<body>
  <canvas id="big"></canvas>
  <div class="copy">
    <p class="tag">The Omarchy logo,<br />brought to life.</p>
    <p class="sub">30 modes, morphs between any two, one color.</p>
    <canvas id="row"></canvas>
    <p class="install">
      <b>npm</b> i omi-kit · <b>pip</b> install omi-kit · <b>cargo</b> add omi<br />
      tahayvr.github.io/omi
    </p>
  </div>
<script>${read("kit/omi.js")}</script>
<script>
  const kit = ${read("kit/omi.json")};
  const omi = new Omi(null, kit, { color: "${FG}", animate: false });
  const [vx, vy, vw, vh] = kit.view;
  // a mode's rects at rest, cell pixels a logo cell, every edge on a whole
  // pixel, onto ctx with the view's corner at (left, top)
  function draw(ctx, mode, cell, left, top) {
    const s = cell / kit.grid;
    ctx.fillStyle = "${FG}";
    for (const r of omi.modeRects(omi.modes[mode], 0)) {
      if (r.o <= 0.001) continue;
      const x0 = Math.round((r.x - vx) * s), y0 = Math.round((r.y - vy) * s),
        x1 = Math.round((r.x + r.w - vx) * s), y1 = Math.round((r.y + r.h - vy) * s);
      ctx.globalAlpha = Math.min(1, r.o);
      ctx.fillRect(left + x0, top + y0, x1 - x0, y1 - y0);
    }
    ctx.globalAlpha = 1;
  }
  // Omi, big: 30 px a cell, its logo (0..300) centered on the left half
  const big = document.getElementById("big"), S = 30 / kit.grid;
  big.width = vw * S; big.height = vh * S;
  big.style.left = (320 - (150 - vx) * S) + "px";
  big.style.top = (${H} / 2 - (150 - vy) * S) + "px";
  draw(big.getContext("2d"), "idle", 30, 0, 0);
  // a few of its modes, small: 4 px a cell, one logo (60 px) and a gap apart
  const row = document.getElementById("row"),
    modes = ["download", "success", "love", "laughing", "party"],
    side = vw * 4 / kit.grid, step = 84;
  row.width = step * (modes.length - 1) + side; row.height = side;
  modes.forEach((m, i) => draw(row.getContext("2d"), m, 4, i * step, 0));
</script>
</body></html>`;

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  for (const p of [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ])
    if (fs.existsSync(p)) return p;
  for (const name of [
    "chromium",
    "google-chrome",
    "google-chrome-stable",
    "chromium-browser",
  ]) {
    const found = spawnSync("which", [name], { encoding: "utf8" });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  return null;
}

const chrome = findChrome();
if (!chrome) {
  console.error("social-card.js needs Chrome or Chromium; set CHROME to one");
  process.exit(1);
}
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omi-card-")),
  html = path.join(dir, "card.html");
fs.writeFileSync(html, page);
const run = spawnSync(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--user-data-dir=${path.join(dir, "profile")}`,
    `--window-size=${W},${H}`,
    "--virtual-time-budget=5000",
    `--screenshot=${out}`,
    "file://" + html,
  ],
  { encoding: "utf8" },
);
fs.rmSync(dir, { recursive: true, force: true });
if (!fs.existsSync(out)) {
  console.error(run.stderr || "Chrome made no picture");
  process.exit(1);
}
console.log(
  `${path.relative(root, out)}: ${W}×${H}, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`,
);
