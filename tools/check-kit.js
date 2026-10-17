#!/usr/bin/env node
/* Checks the kit itself: that kit/omi.json has the shape
   kit/omi.schema.json gives it, that it hangs together, and that it keeps
   the rules Omi is drawn by (docs/designing.md), as far as a program can
   tell.

     node tools/check-kit.js

   A rule a mode breaks on purpose is argued for here, in ARGUED, with the
   reason: one line, where the next person will look. An argument nothing
   needs any more fails too, so the list stays true. */
const fs = require("fs"),
  path = require("path"),
  vm = require("vm"),
  { validate } = require("./schema.js");

const dir = path.join(__dirname, "..", "kit"),
  read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")),
  kit = read("omi.json"),
  schema = read("omi.schema.json");

// mode: why it may
const ARGUED = {
  // The grid: the frame sits on the logo's cells.
  grid: {},
  // The eyes are inside the inner square at rest, so a look can keep them there.
  eyes: {
    peek: "its eyes are below the logo, looking over the ledge",
  },
  // No mouths.
  mouths: {},
};

let failed = 0,
  passed = 0;
// One rule: `problems` are sentences, each about one thing that breaks it.
function rule(name, problems) {
  if (!problems.length) {
    passed++;
    return console.log(`ok   ${name}`);
  }
  failed++;
  console.log(`FAIL ${name}`);
  for (const p of problems.slice(0, 12)) console.log(`       ${p}`);
  if (problems.length > 12)
    console.log(`       and ${problems.length - 12} more`);
}
/* A rule modes may be argued out of. `breaks(mode)` gives what a mode does
   against it (sentences); a mode in `argued` may, and has to: an argument
   for a mode that keeps the rule is a problem too. */
function argued(name, table, breaks) {
  const problems = [];
  for (const m of kit.modes) {
    const found = breaks(m);
    if (m.id in table) {
      if (!found.length)
        problems.push(
          `${m.id} keeps this rule now: take it out of ARGUED in tools/check-kit.js`,
        );
    } else for (const f of found) problems.push(`${m.id}: ${f}`);
  }
  for (const id of Object.keys(table))
    if (!kit.modes.some((m) => m.id === id))
      problems.push(`ARGUED names "${id}", which the kit doesn't have`);
  const let_off = Object.keys(table).filter((id) =>
    kit.modes.some((m) => m.id === id),
  );
  rule(
    name +
      (let_off.length
        ? ` (but ${let_off.map((id) => `${id}: ${table[id]}`).join("; ")})`
        : ""),
    problems,
  );
}
const piece = (p) => `the ${p.role} piece at ${p.x}, ${p.y} (${p.w} × ${p.h})`;

/* ---------- the shape ---------- */
// modes[3].pieces[2] reads better with the mode's name on it
const named = (at) =>
  at.replace(/^modes\[(\d+)\]/, (all, i) =>
    kit.modes[i] && kit.modes[i].id ? `${all} (${kit.modes[i].id})` : all,
  );
rule(
  "omi.json has the shape omi.schema.json gives it: every mode has a kind and a label, every reaction a hold",
  validate(schema, kit).map((p) => `${named(p.at)} ${p.message}`),
);
if (failed) {
  // the rest reads the kit as if it had its shape
  console.log("FAIL: fix the shape first");
  process.exit(1);
}

/* ---------- it hangs together ---------- */
const A = kit.animations,
  problems = [];
const ids = kit.modes.map((m) => m.id);
ids.forEach(
  (id, i) =>
    ids.indexOf(id) !== i && problems.push(`two modes are called "${id}"`),
);
if (!ids.includes("logo"))
  problems.push(
    `there is no "logo", the plain logo every morph is cut against`,
  );
for (const r of (kit.gaze || {}).roles || [])
  if (!kit.roles.includes(r))
    problems.push(`gaze.roles has "${r}", which isn't one of the roles`);
const played = new Set();
for (const m of kit.modes) {
  const play = (name, what, body) => {
    if (name == null) return;
    played.add(name);
    if (!A[name])
      problems.push(
        `${m.id}: ${what} plays "${name}", which isn't an animation`,
      );
    else if (!!A[name].body !== body)
      problems.push(
        `${m.id}: ${what} plays "${name}", which ${body ? "isn't" : "is"} one that moves the whole of Omi (body)`,
      );
  };
  play(m.anim, "the mode", true);
  if (m.clip) play(m.clip.anim, "its window", false);
  if (!m.clip && m.pieces.some((p) => p.clip))
    problems.push(
      `${m.id}: a piece is seen through a window (clip), and the mode has none`,
    );
  for (const p of m.pieces) {
    if (!kit.roles.includes(p.role))
      problems.push(
        `${m.id}: ${piece(p)} has a role that isn't one of the roles`,
      );
    play(p.anim, piece(p), false);
    // a piece's other numbers are the ones its animation reads, all of them
    const reads = (A[p.anim] && A[p.anim].vars) || [],
      has = Object.keys(p).filter(
        (k) =>
          ![
            "x",
            "y",
            "w",
            "h",
            "role",
            "opacity",
            "anim",
            "delay",
            "duration",
            "clip",
          ].includes(k),
      );
    for (const v of reads)
      if (!(v in p))
        problems.push(
          `${m.id}: ${piece(p)} plays "${p.anim}" without the ${v} it reads`,
        );
    for (const k of has)
      if (!reads.includes(k))
        problems.push(`${m.id}: ${piece(p)} has a ${k} that nothing reads`);
    if ((p.delay != null || p.duration != null) && !p.anim)
      problems.push(
        `${m.id}: ${piece(p)} has a delay or a duration and no animation`,
      );
  }
}
for (const [name, a] of Object.entries(A)) {
  if (!played.has(name)) problems.push(`nothing plays the animation "${name}"`);
  a.keys.forEach(
    ([p], i) =>
      i &&
      p <= a.keys[i - 1][0] &&
      problems.push(
        `the animation "${name}" has its keys out of order at ${p}`,
      ),
  );
  // a value read by name is one the animation says it reads
  for (const [, values] of a.keys)
    for (const v of Object.values(values))
      if (Array.isArray(v) && !(a.vars || []).includes(v[0]))
        problems.push(
          `the animation "${name}" reads ${v[0]}, which isn't in its vars`,
        );
}
const families = {};
for (const m of kit.modes)
  if (m.family) (families[m.family] = families[m.family] || []).push(m.id);
for (const [f, of] of Object.entries(families))
  if (of.length < 2)
    problems.push(
      `the family "${f}" has one mode, ${of[0]}: a family is modes that mean the same thing`,
    );
rule(
  "it hangs together: every animation, role and number a piece names is there, and nothing is left over",
  problems,
);

/* ---------- rests ---------- */
// An animation with a rest holds its pose at progress 0 through it, so it
// must end there (or the rest would start with a jump), and its pieces play
// it at its own duration (the rest is the animation's, one for the row).
const restProblems = [];
const CHANNELS = [["tx", "ty", "sx", "sy"], ["op"]],
  REST_AT = { tx: 0, ty: 0, sx: 1, sy: 1, op: 1 };
for (const [name, a] of Object.entries(A)) {
  if (!a.rest) continue;
  for (const props of CHANNELS) {
    const ks = a.keys.filter(([, v]) => props.some((q) => q in v)),
      at = (k) =>
        JSON.stringify(
          props.map((q) => (k && q in k[1] ? k[1][q] : REST_AT[q])),
        );
    if (!ks.length) continue;
    const first = ks[0][0] === 0 ? ks[0] : null,
      last = ks[ks.length - 1][0] === 1 ? ks[ks.length - 1] : null;
    if (at(first) !== at(last))
      restProblems.push(
        `the animation "${name}" has a rest but doesn't end where it starts (${props.join(", ")})`,
      );
  }
}
for (const m of kit.modes)
  for (const p of m.pieces)
    if (p.duration != null && A[p.anim] && A[p.anim].rest)
      restProblems.push(
        `${m.id}: ${piece(p)} sets its own duration for "${p.anim}", which has a rest`,
      );
rule(
  "a rest is still: an animation with one ends where it starts, and its pieces play it at its own duration",
  restProblems,
);

/* ---------- the rules Omi is drawn by ---------- */
// the reference player, without a browser: what a mode looks like at a time
const ctx = vm.createContext({});
vm.runInContext(
  fs.readFileSync(path.join(dir, "omi.js"), "utf8") + ";this.Omi = Omi;",
  ctx,
);
const omi = new ctx.Omi(null, kit, { color: "#000" }),
  shown = (m, t) => omi.modeRects(m, t).filter((r) => r.o > 0.001),
  inside = (r, [x, y, w, h]) =>
    r.x >= x - 1e-6 &&
    r.y >= y - 1e-6 &&
    r.x + r.w <= x + w + 1e-6 &&
    r.y + r.h <= y + h + 1e-6,
  grid = kit.grid,
  on = (v, step) => Math.abs(v / step - Math.round(v / step)) < 1e-9;

const logo = kit.modes.find((m) => m.id === "logo");
rule(
  "Omi is the Omarchy logo: logo is the frame alone, at rest",
  logo.pieces
    .filter((p) => p.role !== "frame" || p.anim)
    .map((p) => `${piece(p)} isn't a still piece of the frame`),
);

rule(
  "the grid: every piece sits on whole units",
  kit.modes.flatMap((m) =>
    m.pieces
      .filter((p) => ![p.x, p.y, p.w, p.h].every(Number.isInteger))
      .map((p) => `${m.id}: ${piece(p)}`),
  ),
);
argued(
  `the grid: the frame sits on the logo's ${grid}-unit cells`,
  ARGUED.grid,
  (m) =>
    m.pieces
      .filter(
        (p) =>
          p.role === "frame" &&
          ![p.x, p.y, p.x + p.w, p.y + p.h].every((v) => on(v, grid)),
      )
      .map((p) => `${piece(p)} is off the grid`),
);
const off = kit.modes
    .flatMap((m) => m.pieces)
    .filter(
      (p) =>
        p.role !== "frame" &&
        ![p.x, p.y, p.x + p.w, p.y + p.h].every((v) => on(v, grid)),
    ).length,
  rest = kit.modes
    .flatMap((m) => m.pieces)
    .filter((p) => p.role !== "frame").length;

argued(
  "no mouths: Omi reads through its eyes, brows and props",
  ARGUED.mouths,
  (m) =>
    m.pieces
      .filter((p) => p.role === "mouth")
      .map((p) => `${piece(p)} is a mouth`),
);

// through every loop, a few hundred moments of it
rule(
  "stays inside the view: the frame and the face never leave it, at rest or in any loop (props may drift off)",
  kit.modes.flatMap((m) => {
    const loop = omi.loopSeconds(m.id),
      out = new Set();
    for (let k = 0; k <= 240; k++)
      for (const r of shown(m, (loop * k) / 240))
        if (r.role !== "extra" && !inside(r, kit.view))
          out.add(
            `${m.id}: a piece of the ${r.role === "frame" ? "frame" : "face"} (${r.role}) leaves the view`,
          );
    return [...out];
  }),
);
if (kit.gaze && kit.gaze.inside)
  argued(
    "the eyes are inside the inner square at rest, so a look keeps them there (gaze.inside)",
    ARGUED.eyes,
    (m) =>
      shown(m, 0)
        .filter(
          (r) => kit.gaze.roles.includes(r.role) && !inside(r, kit.gaze.inside),
        )
        .map(
          (r) =>
            `an eye at ${+r.x.toFixed(2)}, ${+r.y.toFixed(2)} (${+r.w.toFixed(2)} × ${+r.h.toFixed(2)}) is outside it`,
        ),
  );

rule(
  "bounds is the tightest box around each mode",
  kit.modes.flatMap((m) => {
    // a piece seen through the window only counts as far as the window shows it
    const box = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of m.pieces) {
      let [x, y, x2, y2] = [p.x, p.y, p.x + p.w, p.y + p.h];
      if (p.clip && m.clip) {
        [x, y, x2, y2] = [
          Math.max(x, m.clip.x),
          Math.max(y, m.clip.y),
          Math.min(x2, m.clip.x + m.clip.w),
          Math.min(y2, m.clip.y + m.clip.h),
        ];
        if (x2 - x <= 0.01 || y2 - y <= 0.01) continue;
      }
      box[0] = Math.min(box[0], x);
      box[1] = Math.min(box[1], y);
      box[2] = Math.max(box[2], x2);
      box[3] = Math.max(box[3], y2);
    }
    const tight = [box[0], box[1], box[2] - box[0], box[3] - box[1]];
    return tight.every((v, i) => Math.abs(v - m.bounds[i]) < 1e-9)
      ? []
      : [
          `${m.id}: bounds is ${m.bounds.join(", ")}, and its pieces fill ${tight.join(", ")}`,
        ];
  }),
);

console.log(
  `     (${rest - off} of ${rest} face and prop pieces sit on the ${grid}-unit grid too; they don't have to)`,
);
console.log(
  failed
    ? `FAIL: ${failed} of ${failed + passed} rules`
    : `ok: ${passed} rules, ${kit.modes.length} modes`,
);
process.exit(failed ? 1 : 0);
