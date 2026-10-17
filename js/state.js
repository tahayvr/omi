/* ---------- state: the settings, shared by the home page and the jig ----------
   The jig's Controls (controls.js) change them, and both pages draw with
   them; they're kept in localStorage, so the home page shows Omi the way the
   jig left it. */
// Omarchy's built-in themes (github.com/omacom/omarchy, quattro):
// background + accent from each theme's colors.toml.
const THEMES = [
  { name: "Tokyo Night", bg: "#1a1b26", fg: "#9ece6a" },
  { name: "Catppuccin", bg: "#1e1e2e", fg: "#89b4fa" },
  { name: "Ethereal", bg: "#060b1e", fg: "#7d82d9" },
  { name: "Everforest", bg: "#2d353b", fg: "#7fbbb3" },
  { name: "Gruvbox", bg: "#282828", fg: "#7daea3" },
  { name: "Hackerman", bg: "#0b0c16", fg: "#82fb9c" },
  { name: "Kanagawa", bg: "#1f1f28", fg: "#dcd7ba" },
  { name: "Last Horizon", bg: "#0c0b0c", fg: "#b59790" },
  { name: "Lumon", bg: "#16242d", fg: "#8bc9eb" },
  { name: "Matte Black", bg: "#121212", fg: "#e68e0d" },
  { name: "Miasma", bg: "#222222", fg: "#78824b" },
  { name: "Nord", bg: "#2e3440", fg: "#81a1c1" },
  { name: "Osaka Jade", bg: "#111c18", fg: "#509475" },
  { name: "Retro 82", bg: "#05182e", fg: "#faa968" },
  { name: "Ristretto", bg: "#2c2525", fg: "#f38d70" },
  { name: "Solitude", bg: "#101315", fg: "#798186" },
  { name: "Vantablack", bg: "#000000", fg: "#8d8d8d" },
  { name: "Catppuccin Latte", bg: "#eff1f5", fg: "#1e66f5", light: true },
  { name: "Flexoki Light", bg: "#fffcf0", fg: "#205ea6", light: true },
  { name: "Lupine", bg: "#fafafa", fg: "#3264eb", light: true },
  { name: "Rosé Pine", bg: "#faf4ed", fg: "#56949f", light: true },
  { name: "White", bg: "#ffffff", fg: "#6e6e6e", light: true },
];
const BG_SW = [
  "#1a1b26",
  "#000000",
  "#ffffff",
  "#f5f5f0",
  "#9ece6a",
  "#7aa2f7",
  null,
];
const FG_SW = [
  "#9ece6a",
  "#7aa2f7",
  "#bb9af7",
  "#f7768e",
  "#e0af68",
  "#c0caf5",
  "#ffffff",
  "#1a1b26",
];
const DEF = {
  bg: "#1a1b26",
  fg: "#9ece6a",
  anim: true,
  names: true,
  tile: 220,
  fmt: "svg",
  size: "1024",
  pad: "0.08",
  clear: true,
  side: false,
  loops: "2", // a video's length, in whole loops of the mode
  filter: "all",
  speed: 1,
  body: true, // whole-body motion: bobs, hops, shakes
  rest: 1, // the still time between passes of a loop, scaled
  ratio: "1:1",
  force: false,
  over: {},
  fmtOpts: {}, // per format, the export options last picked for it
};
// What each export format starts with, until it is given others: a still
// square with a little room, transparent where the format can be; a 1080p
// landscape video; text and data as they are.
const FMT_KEYS = ["ratio", "size", "pad", "clear", "loops"];
const FMT_DEFAULTS = {
  svg: { ratio: "1:1", pad: "0.08", clear: true },
  svga: { ratio: "1:1", pad: "0.08", clear: true },
  png: { ratio: "1:1", size: "1024", pad: "0.08", clear: true },
  jpg: { ratio: "1:1", size: "1024", pad: "0.16", clear: false },
  webp: { ratio: "1:1", size: "1024", pad: "0.08", clear: true },
  mp4: { ratio: "16:9", size: "1920", pad: "0.16", loops: "2" },
  webm: { ratio: "16:9", size: "1920", pad: "0.16", loops: "2" },
  txt: { pad: "0" },
  json: { ratio: "1:1", pad: "0" },
};
// A format's export options: its defaults, then what was last picked for it.
const fmtOpts = (fmt, from = S) => ({
  ...FMT_DEFAULTS[fmt],
  ...(from.fmtOpts || {})[fmt],
});
// What each format is, in a line.
const FMT_NOTES = {
  svg: "A still, as vectors: sharp at any size.",
  svga: "A loop, as vectors: plays in any browser.",
  png: "A still picture, transparent if you like.",
  jpg: "A still picture on the background color: JPG has no transparency.",
  webp: "A still picture, smaller than PNG, transparent if you like.",
  mp4: "A video of the loop, for anywhere video goes.",
  webm: "A video of the loop, for the web.",
  txt: "Omi as text, for terminals and READMEs.",
  json: "Every rect of the design, for your own renderer.",
};
let S = { ...DEF };
try {
  const saved = JSON.parse(localStorage.getItem("omi-jig") || "null");
  if (saved) S = { ...DEF, ...saved };
} catch (e) {}
if (window.matchMedia("(max-width:720px)").matches) S.side = false;
S.side = false;
const persist = () => {
  try {
    localStorage.setItem("omi-jig", JSON.stringify(S));
  } catch (e) {}
};

const $ = (id) => document.getElementById(id);
const stage = $("stage");

function lum(hex) {
  const n = parseInt(hex.slice(1), 16),
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function uniformBox() {
  const b = { x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity };
  DESIGNS.forEach((d) => {
    const s = shapes(d).box;
    b.x = Math.min(b.x, s.x);
    b.y = Math.min(b.y, s.y);
    b.x2 = Math.max(b.x2, s.x2);
    b.y2 = Math.max(b.y2, s.y2);
  });
  // Center on the logo so extras that stick out on one side (z's, confetti)
  // grow the frame evenly instead of pushing every Omi off-center.
  const ref = shapes(DESIGNS.find((d) => d.id === "idle") || DESIGNS[0]).box,
    cx = (ref.x + ref.x2) / 2,
    cy = (ref.y + ref.y2) / 2,
    p = 30,
    hw = Math.max(cx - b.x, b.x2 - cx) + p,
    hh = Math.max(cy - b.y, b.y2 - cy) + p;
  return { x: cx - hw, y: cy - hh, w: hw * 2, h: hh * 2 };
}

function applySpeed() {
  requestAnimationFrame(() => {
    if (!document.getAnimations) return;
    document.getAnimations().forEach((a) => {
      if (
        window.CSSAnimation &&
        a instanceof CSSAnimation &&
        a.animationName.startsWith("omi-")
      ) {
        const t = a.effect && a.effect.target,
          host = t && t.closest && t.closest("[data-sid]");
        a.playbackRate = host ? eff(host.dataset.sid).speed : S.speed;
      }
    });
  });
}
// Which export options apply to a format.
const fmtRules = (fmt) => ({
  raster: ["png", "jpg", "webp", "webm", "mp4"].includes(fmt),
  video: ["webm", "mp4"].includes(fmt),
  noClear: ["jpg", "txt", "json", "webm", "mp4"].includes(fmt),
  noRatio: ["txt"].includes(fmt),
  noPad: ["json"].includes(fmt),
});
const eff = (id) => ({ ...S, ...(S.over || {})[id] });
const inView = () => typeof view !== "undefined" && view.open;
const ctx = () => (inView() ? eff(DESIGNS[vi].id) : S);
let X = S; // settings for the export in progress
const RM = window.matchMedia("(prefers-reduced-motion: reduce)");
const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

// The page in the current colors: what both pages' render() starts with.
function paintStage() {
  setRest(S.rest ?? 1);
  const dark = S.bg ? lum(S.bg) < 0.35 : false;
  stage.classList.toggle("checker", !S.bg);
  stage.style.background = S.bg || "";
  stage.style.setProperty(
    "--label",
    S.bg ? (dark ? "#e6e9f5" : "#1f2335") : "#1f2335",
  );
  stage.style.setProperty("--accent", S.fg);
  stage.style.setProperty("--accent-ink", S.bg || "#ffffff");
  stage.style.setProperty(
    "--rule",
    dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)",
  );
  stage.style.setProperty(
    "--label-hover",
    dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.07)",
  );
}
