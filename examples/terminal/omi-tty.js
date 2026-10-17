#!/usr/bin/env node
/* Omi in a terminal: the reference player, drawn with half-block characters.
   Each character is two square pixels, top and bottom.

     node examples/terminal/omi-tty.js                 Omi, live: a tour of
                         every mode, the eyes on the mouse, keys to play
     node examples/terminal/omi-tty.js idle thinking   only these modes
     node examples/terminal/omi-tty.js -- npm test     run a command with Omi
                         beside it: busy while it runs, then happy or sad,
                         and the command's own exit code
     node examples/terminal/omi-tty.js --once warning  print one still and exit
     node examples/terminal/omi-tty.js --follow        follow the shared Omi
                         (start service/omi-service.js, change it with
                         service/omictl.js; every follower moves together)

   Live, the keys are: ← → step through the modes (↑ ↓ a group at a time),
   Space or a click on Omi plays a reaction, c changes the color, b turns
   whole-body motion on and off, t starts or stops the tour, q quits. Left
   alone off the tour, Omi falls asleep; any key or mouse move wakes it.

   Options:
     --size 44      pixels across, rounded down to a multiple of 22 (see
                    "Drawing Omi crisp" in the kit's README); default: as
                    big as fits the terminal (22 beside a command)
     --fg #9ece6a   Omi's color; default: the Omarchy theme's accent (and it
                    follows a theme change), or the terminal's own foreground
     --bg #1a1b26   the color faded pixels blend into; default: the Omarchy
                    theme's background, or the terminal's own, which it asks
                    the terminal for. Empty pixels always show the terminal's
                    background, so there's no box around Omi
     --look 0,-1    where the eyes look, each -1..1 (x right, y down)
     --bounce       whole-body motion (bobs, hops, shakes); off by default:
                    at terminal sizes it moves a pixel at a time and stutters
     --every 2.5    the least time per mode on a tour; each mode stays until
                    its morph has landed and its whole loop has played once
     --busy working the mode beside a running command; default: thinking
     --say "Hi"     with --once, text beside Omi (\n for a new line) */
const fs = require("fs"),
  os = require("os"),
  path = require("path"),
  { spawn } = require("child_process"),
  Omi = require("../../kit/omi.js");

const kit = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../kit/omi.json"), "utf8"),
);
const out = process.stdout,
  tty = out.isTTY && process.stdin.isTTY;

// ---------------------------------------------------------------- options
const argv = process.argv.slice(2),
  dash = argv.indexOf("--"),
  command = dash >= 0 ? argv.slice(dash + 1) : null,
  args = dash >= 0 ? argv.slice(0, dash) : argv,
  opt = (name, def) => {
    const i = args.indexOf("--" + name);
    if (i < 0) return def;
    const v = args[i + 1];
    args.splice(i, 2);
    return v;
  },
  flag = (name) =>
    args.includes(name) && args.splice(args.indexOf(name), 1).length > 0;
const once = flag("--once"),
  following = flag("--follow"),
  askedSize = opt("size", null),
  every = +opt("every", 2.5),
  busy = opt("busy", "thinking"),
  say = opt("say", ""),
  look = String(opt("look", "0,0")).split(",").map(Number),
  rgb = (hex) =>
    /^#[0-9a-f]{6}$/i.test(hex || "")
      ? [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
      : null,
  askedFg = rgb(opt("fg", null)),
  askedBg = rgb(opt("bg", null));
let bounce = flag("--bounce");
const ids = kit.modes.map((m) => m.id),
  modes = args.length ? args : ids.filter((id) => id !== "logo");
for (const m of [...modes, busy])
  if (!ids.includes(m)) {
    console.error(`No mode "${m}". Modes: ${ids.join(", ")}`);
    process.exit(1);
  }
const named = (id) => kit.modes.find((m) => m.id === id).name;

// ---------------------------------------------------------------- colors
/* Omi's color and the background faded pixels blend into, each [r, g, b]
   or null. null fg: the terminal's own foreground; null bg: no blending, a
   pixel is on or off. Asked-for colors win, then the Omarchy theme's, then
   what the terminal says its colors are. */
const THEME = path.join(os.homedir(), ".local/state/omarchy/current");
let fg = null,
  bg = null,
  term = { fg: null, bg: null };
function omarchyTheme() {
  try {
    const toml = fs.readFileSync(path.join(THEME, "theme/colors.toml"), "utf8");
    const get = (key) => {
      const m = toml.match(
        new RegExp("^\\s*" + key + '\\s*=\\s*"(#[0-9a-fA-F]{6})"', "m"),
      );
      return m ? rgb(m[1]) : null;
    };
    return { accent: get("accent"), background: get("background") };
  } catch (e) {
    return { accent: null, background: null };
  }
}
// the swatches c steps through: the default first, then a few of Omarchy's
const SWATCHES = [null, "#7aa2f7", "#9ece6a", "#f7768e", "#e0af68", "#bb9af7"];
let swatch = 0;
function pickColors() {
  const theme = omarchyTheme();
  fg = rgb(SWATCHES[swatch]) || askedFg || theme.accent || term.fg;
  bg = askedBg || theme.background || term.bg;
}
pickColors();

/* Ask the terminal for its colors (OSC 10 and 11), so faded pixels blend
   into the real background. Most terminals answer; the device-attributes
   query after them is answered by all, so the wait ends there at the latest. */
function askTerminal() {
  if (!tty || (askedFg && askedBg)) return Promise.resolve();
  return new Promise((done) => {
    const stdin = process.stdin;
    let buf = "",
      timer = null;
    const finish = () => {
      clearTimeout(timer);
      stdin.off("data", read);
      stdin.setRawMode(false);
      stdin.pause();
      const color = (n) => {
        const m = buf.match(
          new RegExp(
            `\\x1b\\]${n};rgba?:([0-9a-f]+)\\/([0-9a-f]+)\\/([0-9a-f]+)`,
            "i",
          ),
        );
        return m
          ? m
              .slice(1, 4)
              .map((h) =>
                Math.round((parseInt(h, 16) / (16 ** h.length - 1)) * 255),
              )
          : null;
      };
      term = { fg: color(10), bg: color(11) };
      pickColors();
      done();
    };
    const read = (d) => {
      buf += d;
      if (/\x1b\[\?[\d;]*c/.test(buf)) finish();
    };
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.on("data", read);
    stdin.resume();
    out.write("\x1b]10;?\x1b\\\x1b]11;?\x1b\\\x1b[c");
    timer = setTimeout(finish, 300);
  });
}

// An Omarchy theme change recolors Omi as it happens.
function followTheme(onChange) {
  try {
    let t = 0;
    fs.watch(THEME, () => {
      clearTimeout(t);
      t = setTimeout(() => (pickColors(), onChange()), 150);
    }).unref();
  } catch (e) {}
}

// ---------------------------------------------------------------- drawing
// Crisp when one logo cell (kit.grid units) is a whole number of pixels: the
// view is 22 cells across, so the width is a multiple of 22.
const cells = kit.view[2] / kit.grid,
  crisp = (n) => Math.max(cells, Math.floor(n / cells) * cells);

/* How far Omi's pieces reach, in kit units: the view, and past it where a
   mode's pieces go (the download arrow's tip, sleeping's z's, the party's
   confetti), over a few seconds of every mode with the body moving. */
const reach = (() => {
  const [vx, vy, vw, vh] = kit.view,
    probe = new Omi(null, kit, { color: "#fff", bodyMotion: true }),
    box = [vx, vy, vx + vw, vy + vh];
  for (const m of kit.modes)
    for (let t = 0; t < 8; t += 1 / 20)
      for (const r of probe.modeRects(probe.modes[m.id], t)) {
        if (r.o <= 0.01) continue;
        box[0] = Math.min(box[0], r.x);
        box[1] = Math.min(box[1], r.y);
        box[2] = Math.max(box[2], r.x + r.w);
        box[3] = Math.max(box[3], r.y + r.h);
      }
  return box;
})();
/* Where Omi is drawn at a size (the view's width in pixels): the view, and
   whole logo cells around it out to the reach, so Omi stays crisp. The
   height is a whole number of rows; cx, cy is the view's center. */
function area(size) {
  const [vx, vy, vw, vh] = kit.view,
    s = size / vw,
    cell = size / cells,
    pad = (units) => Math.ceil((units * s) / cell - 1e-9) * cell,
    left = pad(vx - reach[0]),
    top = pad(vy - reach[1]),
    w = left + size + pad(reach[2] - vx - vw),
    h = top + vh * s + pad(reach[3] - vy - vh);
  return {
    s,
    x: vx - left / s,
    y: vy - top / s,
    w,
    h: h + (h % 2),
    cx: left + size / 2,
    cy: top + (vh * s) / 2,
  };
}

/* Rects to pixels. Edges snap to whole pixels, so Omi stays crisp; a pixel
   is as opaque as the rect over it. */
function pixels(rects, A) {
  const { s, w, h } = A,
    on = new Float32Array(w * h);
  for (const r of rects) {
    if (r.o <= 0.001) continue;
    const x0 = Math.max(0, Math.round((r.x - A.x) * s)),
      y0 = Math.max(0, Math.round((r.y - A.y) * s)),
      x1 = Math.min(w, Math.round((r.x + r.w - A.x) * s)),
      y1 = Math.min(h, Math.round((r.y + r.h - A.y) * s)),
      o = Math.min(1, r.o);
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) on[y * w + x] = Math.max(on[y * w + x], o);
  }
  return on;
}

// A pixel's color: null for empty (the terminal's background), "fg" for Omi,
// or [r, g, b] for a faded pixel blended into the background.
function color(a) {
  if (a < 0.02) return null;
  if (a > 0.98 || !bg || !fg) return a >= 0.5 ? "fg" : null; // no blending: round
  return fg.map((c, k) => Math.round(bg[k] + (c - bg[k]) * a));
}
const sgr = (c, layer) =>
  c === null
    ? layer === 38
      ? "39"
      : "49"
    : c === "fg"
      ? fg
        ? `${layer};2;${fg.join(";")}`
        : layer === 38
          ? "39"
          : "7"
      : `${layer};2;${c.join(";")}`;
// text in Omi's color
const ink = (s) => `\x1b[${sgr("fg", 38)}m${s}\x1b[39m`,
  dim = (s) => `\x1b[2m${s}\x1b[22m`,
  bold = (s) => `\x1b[1m${s}\x1b[22m`;

/* Omi as lines of characters: ▀ with the top pixel's color as foreground
   and the bottom's as background. Escape codes only when a color changes. */
function draw(omi, A) {
  const on = pixels(omi.rects(), A),
    { w, h } = A,
    lines = [];
  for (let y = 0; y < h; y += 2) {
    let line = "",
      last = "";
    for (let x = 0; x < w; x++) {
      const top = color(on[y * w + x]),
        bottom = color(on[(y + 1) * w + x]);
      let ch, code;
      if (top === null && bottom === null) ((ch = " "), (code = "\x1b[39;49m"));
      else if (bottom === null)
        ((ch = "▀"), (code = `\x1b[${sgr(top, 38)};49m`));
      else if (top === null)
        ((ch = "▄"), (code = `\x1b[${sgr(bottom, 38)};49m`));
      else if (top === "fg" && bottom === "fg")
        ((ch = "█"), (code = `\x1b[${sgr("fg", 38)};49m`));
      else ((ch = "▀"), (code = `\x1b[${sgr(top, 38)};${sgr(bottom, 48)}m`));
      if (code !== last) ((line += code), (last = code));
      line += ch;
    }
    lines.push(line + "\x1b[0m");
  }
  return lines;
}

// Text as it shows: no escape codes, one line of a carriage-returned one
// (a progress bar's last state), cut to fit.
const plain = (s) =>
  s
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)?/g, "")
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "");
const fit = (s, w) =>
  w <= 0 ? "" : s.length > w ? s.slice(0, Math.max(0, w - 1)) + "…" : s;
const seconds = (ms) => {
  const s = ms / 1000;
  return s < 60
    ? `${s.toFixed(1)} s`
    : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

const omi = new Omi(null, kit, { color: "#fff", bodyMotion: bounce });
if (look[0] || look[1]) omi.look(look[0] || 0, look[1] || 0);

if (once) still();
else if (command) askTerminal().then(() => runCommand(command));
else if (!tty) {
  console.error("Live Omi needs a terminal. Try --once, or -- a command.");
  process.exit(1);
} else askTerminal().then(live);

// ---------------------------------------------------------------- --once
// One still, with any --say text beside it, centred on Omi's height. The
// empty rows above and below Omi are left out.
function still() {
  omi.set(modes[0], { instant: true });
  const size = crisp(askedSize ? +askedSize : 44),
    blank = (l) => !plain(l).trim(),
    lines = draw(omi, area(size));
  while (lines.length > 1 && blank(lines[0])) lines.shift();
  while (lines.length > 1 && blank(lines[lines.length - 1])) lines.pop();
  const text = say ? say.split("\\n") : [],
    top = Math.floor((lines.length - text.length) / 2);
  out.write(
    lines
      .map((l, i) => {
        const t = text[i - top];
        return t == null ? l : `${l}  ${i === top ? ink(bold(t)) : t}`;
      })
      .join("\n") + "\n",
  );
}

// ---------------------------------------------------------------- -- command
/* Omi beside a command: busy while it runs, with the command's last lines
   next to it, then happy or sad. The block stays in the scrollback; a
   failed command's whole output is printed under it, and its exit code is
   this one's. */
function runCommand(cmd) {
  const label = cmd.join(" ");
  if (!out.isTTY) {
    // nowhere to draw: just run it
    const child = spawn(cmd[0], cmd.slice(1), {
      stdio: "inherit",
      shell: cmd.length === 1,
    });
    child.on("exit", (code) => (process.exitCode = code ?? 1));
    return;
  }
  const A = area(crisp(askedSize ? +askedSize : 22)),
    height = A.h / 2,
    t0 = Date.now();
  let log = "",
    tail = [""],
    result = null,
    shown = false;
  const take = (chunk) => {
    const s = chunk.toString();
    if (log.length < 4e6) log += s;
    const parts = s.split("\n");
    tail[tail.length - 1] += parts[0];
    tail.push(...parts.slice(1));
    tail = tail.slice(-height);
  };
  const frame = () => {
    omi.frame(Date.now());
    const lines = draw(omi, A),
      room = (out.columns || 80) - A.w - 3,
      elapsed = seconds((result ? result.at : Date.now()) - t0),
      status = !result
        ? dim(`running · ${elapsed}`)
        : result.ok
          ? ink(`✓ done · ${elapsed}`)
          : `\x1b[31m✗ ${result.why} · ${elapsed}\x1b[39m`,
      text = [
        bold(fit("$ " + label, room)),
        status,
        "",
        ...tail
          .map((l) => plain(l.split("\r").pop()))
          .filter((l, i, all) => l || i < all.length - 1)
          .slice(-(height - 3))
          .map((l) => dim(fit(l, room))),
      ];
    let s = shown ? `\x1b[${height}F` : "";
    lines.forEach((l, i) => (s += `\x1b[2K${l}  ${text[i] || ""}\x1b[0m\n`));
    out.write(s);
    shown = true;
  };
  out.write("\x1b[?25l");
  process.on("exit", () => out.write("\x1b[0m\x1b[?25h"));
  // Ctrl+C reaches the command too; Omi waits to say how it ended
  process.on("SIGINT", () => {});
  omi.set("logo", { instant: true });
  omi.set(busy);
  const timer = setInterval(frame, 1000 / 30);
  frame();

  const child = spawn(cmd[0], cmd.slice(1), {
    stdio: ["inherit", "pipe", "pipe"],
    shell: cmd.length === 1,
    env: { FORCE_COLOR: "1", ...process.env },
  });
  child.stdout.on("data", take);
  child.stderr.on("data", take);
  const end = (code, why) => {
    if (result) return;
    result = { ok: code === 0, why, at: Date.now() };
    const mode = result.ok ? "success" : "sad";
    omi.set(mode);
    // let the reaction land and play, then leave its last frame
    const hold =
      kit.morph.duration +
      kit.morph.stagger +
      (result.ok ? omi.hold(mode) : 1.2);
    setTimeout(() => {
      clearInterval(timer);
      frame();
      if (!result.ok && log)
        out.write("\n" + log + (log.endsWith("\n") ? "" : "\n"));
      process.exitCode = code;
      process.exit();
    }, hold * 1000);
  };
  child.on("error", (e) => {
    take(
      `${cmd[0]}: ${e.code === "ENOENT" ? "command not found" : e.message}\n`,
    );
    end(127, "couldn’t start");
  });
  child.on("close", (code, sig) => {
    const n = sig ? 128 + (os.constants.signals[sig] || 0) : code;
    end(n, sig ? `stopped (${sig})` : `exit ${code}`);
  });
}

// ---------------------------------------------------------------- live
function live() {
  const stdin = process.stdin;
  /* Full screen, keys raw, the mouse reported (any motion, SGR coordinates)
     and focus in and out; the terminal is put back on exit. */
  const restore = () => {
    out.write("\x1b[?1003l\x1b[?1006l\x1b[?1004l\x1b[0m\x1b[?25h\x1b[?1049l");
    stdin.isTTY && stdin.setRawMode(false);
  };
  out.write("\x1b[?1049h\x1b[?25l\x1b[2J\x1b[?1003h\x1b[?1006h\x1b[?1004h");
  process.on("exit", restore);
  process.on("SIGTERM", () => process.exit(0));
  stdin.setRawMode(true);
  stdin.setEncoding("utf8");
  stdin.resume();

  // the reactions Space and a click play, in turn
  const reactions = ids.filter((id) => omi.kind(id) === "reaction"),
    groups = [];
  for (const id of modes) {
    const g = kit.modes.find((m) => m.id === id).group || "";
    if (!groups.length || groups[groups.length - 1].name !== g)
      groups.push({ name: g, ids: [] });
    groups[groups.length - 1].ids.push(id);
  }

  // ------------------------------------------------ layout
  // Omi in the middle, then its name, what it's doing, the modes and keys.
  const TEXT = 6;
  let A, ox, oy; // where Omi is drawn, and its top-left cell (1-based)
  const layout = () => {
    const cols = out.columns || 80,
      rows = out.rows || 24;
    // the biggest that fits, room for the reach and the text included
    let size = crisp(askedSize ? +askedSize : 88);
    A = area(size);
    while (
      !askedSize &&
      size > cells &&
      (A.w > cols - 2 || A.h / 2 > rows - TEXT)
    )
      A = area((size -= cells));
    ox = Math.max(1, Math.floor((cols - A.w) / 2) + 1);
    oy = Math.max(1, Math.floor((rows - A.h / 2 - TEXT) / 2) + 1);
  };
  layout();
  let shown = [];
  out.on("resize", () => {
    layout();
    shown = [];
    out.write("\x1b[2J");
  });
  followTheme(() => (shown = []));

  // ------------------------------------------------ what Omi is doing
  let touring = !following,
    started = false, // the entrance is over
    current = modes[0], // the mode picked, the tour's or yours
    next = 0,
    landed = 0,
    hold = 0,
    poked = null, // a reaction playing: { timer }
    pokes = 0,
    asleep = false,
    lastInput = Date.now();
  omi.on("settled", () => (landed = Date.now()));
  const go = (id) => {
    current = id;
    if (poked) (clearTimeout(poked.timer), (poked = null));
    omi.set(id);
    landed = omi.morph ? 0 : Date.now(); // set when the morph lands, if there is one
    hold = Math.max(every, omi.loopSeconds(id)) * 1000;
  };
  const step = (by) => {
    touring = false;
    const i = modes.indexOf(current);
    go(modes[(i + by + modes.length) % modes.length]);
  };
  const stepGroup = (by) => {
    touring = false;
    const g = groups.findIndex((g) => g.ids.includes(current));
    go(groups[(g + by + groups.length) % groups.length].ids[0]);
  };
  const poke = () => {
    if (following || !reactions.length) return;
    const id = reactions[pokes++ % reactions.length];
    if (poked) clearTimeout(poked.timer);
    omi.set(id);
    poked = {
      timer: setTimeout(
        () => ((poked = null), omi.set(current)),
        (kit.morph.duration + kit.morph.stagger + omi.hold(id)) * 1000,
      ),
    };
  };
  // Input wakes Omi; a minute without any, off the tour, puts it to sleep.
  const touched = () => {
    lastInput = Date.now();
    if (asleep) ((asleep = false), following || omi.set(current));
  };

  // ------------------------------------------------ the eyes on the mouse
  let rest = 0;
  const lookAt = (col, row) => {
    const dx = col - (ox + A.cx),
      dy = (row - (oy + A.cy / 2)) * 2, // a row is two pixels
      far = A.s * kit.view[2] * 1.2; // full tilt this far from Omi's center
    omi.look(
      Math.max(-1, Math.min(1, dx / far)),
      Math.max(-1, Math.min(1, dy / far)),
    );
    clearTimeout(rest);
    rest = setTimeout(() => omi.look(0, 0), 2500);
  };
  const onOmi = (col, row) =>
    col >= ox && col < ox + A.w && row >= oy && row < oy + A.h / 2;

  // ------------------------------------------------ keys and the mouse
  stdin.on("data", (data) => {
    const re =
      /\x1b\[<(\d+);(\d+);(\d+)([Mm])|\x1b\[([ABCDIO])|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[[\d;?]*[ -/]*[@-~]|[\s\S]/g;
    let m;
    while ((m = re.exec(data))) {
      if (m[1] != null) {
        const b = +m[1],
          col = +m[2],
          row = +m[3];
        touched();
        lookAt(col, row);
        if (m[4] === "M" && (b & 3) === 0 && !(b & 32) && !(b & 64))
          onOmi(col, row) && poke();
        continue;
      }
      const k = m[5] || m[0];
      if (k === "I" || k === "O") {
        // focus in or out: out, the eyes come back to the middle
        if (k === "O") omi.look(0, 0);
        continue;
      }
      if (k === "\x03" || k === "q" || k === "Q") process.exit(0);
      touched();
      if (following && !"cb".includes(k)) continue;
      if (k === "C") step(1);
      else if (k === "D") step(-1);
      else if (k === "B") stepGroup(1);
      else if (k === "A") stepGroup(-1);
      else if (k === " " || k === "\r") poke();
      else if (k === "c") {
        swatch = (swatch + 1) % SWATCHES.length;
        pickColors();
        shown = [];
      } else if (k === "b") omi.bodyMotion = bounce = !bounce;
      else if (k === "t") {
        touring = !touring;
        if (touring) next = modes.indexOf(current) + 1;
      }
    }
  });

  if (following)
    require("../../service/client.js").follow(omi, {
      name: "omi-tty",
      onError: (e) => {
        restore();
        console.error(`Can't reach the Omi service (${e.code || e.message}).`);
        process.exit(1);
      },
      onClose: () => process.exit(0),
    });

  // ------------------------------------------------ every frame
  const center = (s, w) => {
    const cols = out.columns || 80;
    return " ".repeat(Math.max(0, Math.floor((cols - w) / 2))) + s;
  };
  // a mark per mode, a gap between groups, the one showing in Omi's color
  const strip = () => {
    const now = following ? omi.mode : current;
    let s = "",
      w = 0;
    groups.forEach((g, i) => {
      if (i) ((s += "  "), (w += 2));
      for (const id of g.ids) ((s += id === now ? ink("■") : dim("·")), w++);
    });
    return center(s, w);
  };
  const hints = () => {
    const cols = out.columns || 80,
      sets = following
        ? [["following the shared Omi", "c color", "b bounce", "q quit"]]
        : [
            [
              "← → modes",
              "↑ ↓ groups",
              "space react",
              "c color",
              `b bounce ${bounce ? "off" : "on"}`,
              `t tour ${touring ? "off" : "on"}`,
              "q quit",
            ],
            ["← →", "↑ ↓", "space", "c", "b", "t", "q"],
          ],
      fits = sets.map((s) => s.join("   ")).find((s) => s.length <= cols - 2);
    const s = fits || sets[sets.length - 1].join(" ");
    return center(dim(s), s.length);
  };
  const tick = () => {
    const now = Date.now();
    if (started && !following && !asleep && !poked) {
      if (touring && landed && now - landed >= hold)
        go(modes[next++ % modes.length]);
      else if (!touring && now - lastInput > 60e3) {
        asleep = true;
        omi.set("sleeping");
      }
    }
    omi.frame(now);
    const cols = out.columns || 80,
      id = omi.mode,
      name = named(id),
      lines = draw(omi, A).map((l) => " ".repeat(ox - 1) + l);
    lines.push(
      "",
      center(ink(bold(name)), name.length),
      center(
        dim(fit(omi.label(id), cols - 2)),
        fit(omi.label(id), cols - 2).length,
      ),
      "",
      strip(),
      hints(),
    );
    let s = "";
    lines.forEach((l, i) => {
      if (shown[i] !== l) s += `\x1b[${oy + i};1H\x1b[2K${l}`;
    });
    shown = lines;
    if (s) out.write(s);
  };
  // the plain logo first, then Omi comes to life
  omi.set("logo", { instant: true });
  if (!following)
    setTimeout(() => {
      started = true;
      if (!poked && omi.mode === "logo") go(modes[next++]);
    }, 700);
  setInterval(tick, 1000 / 30);
  tick();
}
