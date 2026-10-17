/* ---------- motion: every animation, as data ----------
   One definition per animation. The pack's animations are this table
   (pack.js), and the player plays them: stills, video frames, the hero and
   the Morph section are all the player's. The one other reader is the CSS at
   the end of this file, for modes that loop without a script (the tiles, the
   animated SVG export); index.html?check holds it to the player.

   An animation loops every `rest` + `dur` seconds: it holds still for
   `rest` (0 if it has none), then plays its keys over `dur`. Apps can scale
   the rest (the player's `rest`: 0 back to back, 2 twice as long), so a
   pause between passes belongs in `rest`, not in the keys. A loop with a
   rest ends where it starts, and its pieces don't set their own `dur`.
   `keys` are [progress 0..1, values]:
     tx, ty   move, in grid units
     sx, sy   scale, about the piece's own center
     op       opacity
   As in CSS, moves and scales form one channel and opacity another. A key
   that sets any of tx/ty/sx/sy pins all four (unset ones at rest), and a
   channel with no key at 0 or 1 rests there. So a key that holds still
   mid-loop has to say so, e.g. [0.86, { tx: 0 }].
   A value can be [name, k]: that piece's own number times k (confetti's
   flight, the heart's spread). `ease` applies to every segment: a CSS name,
   a cubic-bezier [x1, y1, x2, y2], or "steps" (hold until the next key).

   Pieces opt in by name (r.c = "eye") and may carry their own `dur` and a
   lag `dl` (seconds behind the loop, to stagger a row of pieces). `body`
   animations move the whole of Omi (d.mood); everything else moves one piece.

   The rule that makes modes morph cleanly: a mode at rest IS frame 0 of its
   loops. Stills, the morph's landing pose and the loop's first
   frame are one and the same, so handing over from a morph to the loop, or
   from a still to the animation, never jumps. Loops whose natural start
   isn't a good still are started further in (START, below). */
const fade = (tail, floor) => ({
  dur: 1.6,
  ease: "linear",
  keys: [
    [0, { op: 1 }],
    [tail, { op: floor }],
    [1, { op: floor }],
  ],
});
// emotion loops pin every channel at every key
const emo = (dur, keys) => ({
  dur,
  ease: "ease-in-out",
  keys: keys.map(([p, v]) => [p, { tx: 0, ty: 0, sx: 1, sy: 1, op: 1, ...v }]),
});
const ANIM = {
  /* whole body (d.mood) */
  "m-bob": {
    body: true,
    dur: 2.8,
    ease: "ease-in-out",
    keys: [
      [0, { ty: 0 }],
      [0.5, { ty: -10 }],
      [1, { ty: 0 }],
    ],
  },
  "m-slow": {
    body: true,
    dur: 5,
    ease: "ease-in-out",
    keys: [
      [0, { ty: 0 }],
      [0.5, { ty: -10 }],
      [1, { ty: 0 }],
    ],
  },
  "m-happy": {
    body: true,
    dur: 1.6,
    ease: "ease-in-out",
    keys: [
      [0, { ty: 0 }],
      [0.2, { ty: -30 }],
      [0.4, { ty: 0 }],
      [0.5, { ty: -12 }],
      [0.6, { ty: 0 }],
      [1, { ty: 0 }],
    ],
  },
  // the logo rising over its ledge (peek's clipped layer, see d.clip)
  peek: {
    dur: 4.5,
    ease: "ease-in-out",
    keys: [
      [0, { ty: 180 }],
      [0.25, { ty: 0 }],
      [0.75, { ty: 0 }],
      [1, { ty: 180 }],
    ],
  },
  // peek's eyes, in step with the window (which rests risen): up, they look
  // around, a little to the right, then further to the left, and back to
  // the middle before the logo sinks
  "peek-look": {
    dur: 4.5,
    ease: "ease-in-out",
    keys: [
      [0, { tx: 0 }],
      [0.05, { tx: 0 }],
      [0.11, { tx: 10 }],
      [0.18, { tx: 10 }],
      [0.26, { tx: -20 }],
      [0.36, { tx: -20 }],
      [0.44, { tx: 0 }],
      [1, { tx: 0 }],
    ],
  },

  /* eyes and face */
  eye: {
    // blink: open for the rest, then shut and open again
    rest: 3.6,
    dur: 0.4,
    ease: "ease",
    keys: [
      [0, { sy: 1 }],
      [0.4, { sy: 0.1 }],
      [1, { sy: 1 }],
    ],
  },
  cur: {
    // cursor
    dur: 1.05,
    ease: "steps",
    keys: [
      [0, { op: 1 }],
      [0.5, { op: 0 }],
      [1, { op: 0 }],
    ],
  },
  dot: {
    // thinking dots; pieces stagger with dl
    dur: 1.6,
    ease: "ease",
    keys: [
      [0, { op: 0.25 }],
      [0.3, { op: 1 }],
      [1, { op: 0.25 }],
    ],
  },
  look: {
    // the eyes sway a cell right, a cell left and back, resting in the
    // middle: a sine in 16 steps, since an ease on keys at the middle would
    // stop the eyes there on every pass
    dur: 6,
    ease: "linear",
    keys: Array.from({ length: 17 }, (_, i) => [
      i / 16,
      { tx: +(20 * Math.sin((i / 8) * Math.PI)).toFixed(3) },
    ]),
  },
  // listening: the inner sound marks travel out and fade, then come back in
  // place; the outer ones a beat later
  wave: {
    rest: 0.8,
    dur: 1.2,
    ease: "ease-in-out",
    vars: ["mx"],
    keys: [
      [0, { tx: 0, op: 1 }],
      [0.45, { tx: ["mx", 1], op: 0 }],
      [0.5, { tx: 0, op: 0 }],
      [0.85, { tx: 0, op: 1 }],
      [1, { tx: 0, op: 1 }],
    ],
  },
  wave2: {
    rest: 0.8,
    dur: 1.2,
    ease: "ease-in-out",
    vars: ["mx"],
    keys: [
      [0, { tx: 0, op: 1 }],
      [0.15, { tx: 0, op: 1 }],
      [0.6, { tx: ["mx", 1], op: 0 }],
      [0.65, { tx: 0, op: 0 }],
      [0.95, { tx: 0, op: 1 }],
      [1, { tx: 0, op: 1 }],
    ],
  },
  z: {
    // sleeping z's drift up; pieces stagger with dl
    dur: 2.6,
    ease: "ease-out",
    keys: [
      [0, { op: 0, tx: 0, ty: 0 }],
      [0.3, { op: 1 }],
      [1, { op: 0, tx: 10, ty: -24 }],
    ],
  },
  drop: {
    // tears: from the cheek they fall and fade out at the bottom, then,
    // unseen, start again at the top and fade in on the way to the cheek
    dur: 1.2,
    ease: "ease-in-out",
    keys: [
      [0, { ty: 0, op: 1 }],
      [0.45, { ty: 10, op: 1 }],
      [0.7, { ty: 20, op: 0 }],
      [0.7001, { ty: -10, op: 0 }],
      [1, { ty: 0, op: 1 }],
    ],
  },
  shades: {
    // on, then they fade out where they are and, unseen, go back up to
    // drop down again
    dur: 3.6,
    ease: [0.2, 0.8, 0.2, 1],
    keys: [
      [0, { ty: 0, op: 1 }],
      [0.7, { ty: 0, op: 1 }],
      [0.82, { ty: 0, op: 0 }],
      [0.8201, { ty: -140, op: 0 }],
      [1, { ty: 0, op: 1 }],
    ],
  },

  /* emotions */
  // laughing: the mouth opens and closes, ha-ha
  ha: emo(0.7, [
    [0, { op: 1 }],
    [0.5, { op: 0.2 }],
    [1, { op: 1 }],
  ]),
  // excited: star eyes twinkle
  twinkle: emo(0.9, [
    [0, {}],
    [0.5, { sx: 1.3, sy: 1.3 }],
    [1, {}],
  ]),
  // shy: holds your gaze, glances down (lids drop), drifts away, sneaks a
  // quick peek back up, darts off again, then slowly comes back
  shy: emo(6, [
    [0, {}],
    [0.08, {}],
    [0.16, { ty: 40, sy: 0.75 }],
    [0.26, { ty: 40, sy: 0.75 }],
    [0.34, { tx: 20, ty: 50, sy: 0.7 }],
    [0.46, { tx: 20, ty: 50, sy: 0.7 }],
    [0.51, { tx: 10, ty: 20, sy: 0.9 }],
    [0.56, { tx: 10, ty: 20, sy: 0.9 }],
    [0.6, { tx: 20, ty: 50, sy: 0.7 }],
    [0.78, { tx: 20, ty: 50, sy: 0.7 }],
    [0.94, {}],
    [1, {}],
  ]),
  // skeptical: starts neutral, then one eye squints, a brow lifts, a smirk
  skq: emo(5, [
    [0, { sx: 0.5, sy: 4 }],
    [0.2, { sx: 0.5, sy: 4 }],
    [0.35, {}],
    [0.85, {}],
    [1, { sx: 0.5, sy: 4 }],
  ]),
  skb: emo(5, [
    [0, { op: 0, ty: 10 }],
    [0.2, { op: 0, ty: 10 }],
    [0.35, {}],
    [0.85, {}],
    [1, { op: 0, ty: 10 }],
  ]),
  // angry: brows press down
  furrow: emo(2, [
    [0, {}],
    [0.4, { ty: 6 }],
    [0.6, { ty: 6 }],
    [1, {}],
  ]),
  // love: each heart pixel spreads from the heart's center (dx, dy) as it
  // beats, so the whole heart scales about its middle
  hb: {
    dur: 1.2,
    ease: "ease-in-out",
    vars: ["dx", "dy"],
    keys: [
      [0, { sx: 1, sy: 1 }],
      [0.1, { tx: ["dx", 0.35], ty: ["dy", 0.35], sx: 1.35, sy: 1.35 }],
      [0.2, { sx: 1, sy: 1 }],
      [0.3, { tx: ["dx", 0.2], ty: ["dy", 0.2], sx: 1.2, sy: 1.2 }],
      [0.4, { sx: 1, sy: 1 }],
      [1, { sx: 1, sy: 1 }],
    ],
  },

  /* frame */
  // chase: a lit cell fading to a floor; pieces carry their own dur and dl
  t40: fade(0.4, 0.2),
  t60: fade(0.6, 0.2),
  // transfer (frames.js flow()): a pass is 1.6 s, the frame's cells each
  // dipping in turn, then the logo rests whole for 1.2 s
  pass: {
    rest: 1.2,
    dur: 1.6,
    ease: "linear",
    keys: [
      [0, { op: 1 }],
      [0.0525, { op: 0.2 }],
      [0.1225, { op: 0.2 }],
      [0.175, { op: 1 }],
      [1, { op: 1 }],
    ],
  },
  // the arrow, in the same pass: gone as the gap sets off, painted again
  // 1.2 s in, as the gap gets to the end of the frame
  paint: {
    rest: 1.2,
    dur: 1.6,
    ease: "linear",
    keys: [
      [0, { op: 1 }],
      [0.02, { op: 0 }],
      [0.75, { op: 0 }],
      [0.78, { op: 1 }],
      [1, { op: 1 }],
    ],
  },
  // working (frames.js): the inner square lifts a cell, holds, and slams
  // back down
  press: {
    rest: 0.5,
    dur: 1,
    ease: "ease-in-out",
    keys: [
      [0, { ty: 0 }],
      [0.45, { ty: -20 }],
      [0.6, { ty: -20 }],
      [0.68, { ty: 0 }],
      [1, { ty: 0 }],
    ],
  },
  // the eyes ride with it, and squint on the impact
  "press-eye": {
    rest: 0.5,
    dur: 1,
    ease: "ease-in-out",
    keys: [
      [0, { ty: 0, sy: 1 }],
      [0.45, { ty: -20, sy: 1 }],
      [0.6, { ty: -20, sy: 1 }],
      [0.68, { ty: 0, sy: 0.5 }],
      [0.85, { ty: 0, sy: 1 }],
      [1, { ty: 0, sy: 1 }],
    ],
  },
  // sparks off both sides at the impact
  "spark-l": {
    rest: 0.5,
    dur: 1,
    ease: "ease-out",
    keys: [
      [0, { tx: 0, ty: 0, op: 0 }],
      [0.67, { tx: 0, ty: 0, op: 0 }],
      [0.69, { op: 1 }],
      [0.92, { tx: -30, ty: -30, op: 0 }],
      [1, { tx: 0, ty: 0, op: 0 }],
    ],
  },
  "spark-r": {
    rest: 0.5,
    dur: 1,
    ease: "ease-out",
    keys: [
      [0, { tx: 0, ty: 0, op: 0 }],
      [0.67, { tx: 0, ty: 0, op: 0 }],
      [0.69, { op: 1 }],
      [0.92, { tx: 30, ty: -30, op: 0 }],
      [1, { tx: 0, ty: 0, op: 0 }],
    ],
  },
  // warning: the sign beside the head sways, slowly: a sine in 16 steps, so
  // it doesn't stop as it passes the middle
  placard: {
    dur: 3,
    ease: "linear",
    keys: Array.from({ length: 17 }, (_, i) => [
      i / 16,
      { tx: +(8 * Math.sin((i / 8) * Math.PI)).toFixed(3) },
    ]),
  },
  // success (frames.js): every piece of the logo out a step, a beat, and
  // snapped back; each piece says which way, in dx and dy
  burst: {
    dur: 1.6,
    ease: "ease-in-out",
    vars: ["dx", "dy"],
    keys: [
      [0, { tx: 0, ty: 0 }],
      [0.16, { tx: ["dx", 1], ty: ["dy", 1] }],
      [0.4, { tx: ["dx", 1], ty: ["dy", 1] }],
      [0.48, { tx: 0, ty: 0 }],
      [1, { tx: 0, ty: 0 }],
    ],
  },
  sn: {
    // snake; cells stagger with dl
    dur: 2.4,
    ease: "linear",
    keys: [
      [0, { op: 1 }],
      [0.216, { op: 0.15 }],
      [1, { op: 0.15 }],
    ],
  },
  breathe: {
    dur: 4,
    ease: "ease-in-out",
    keys: [
      [0, { op: 0.35 }],
      [0.5, { op: 1 }],
      [1, { op: 0.35 }],
    ],
  },
  pop: {
    dur: 1.6,
    ease: "ease-in-out",
    keys: [
      [0, { op: 0.35 }],
      [0.2, { op: 1 }],
      [0.6, { op: 0.35 }],
      [1, { op: 0.35 }],
    ],
  },
  pulseop: {
    dur: 1.2,
    ease: "ease-in-out",
    keys: [
      [0, { op: 1 }],
      [0.5, { op: 0.35 }],
      [1, { op: 1 }],
    ],
  },

  /* extras */
  conf: {
    // confetti flies out to its own (mx, my)
    dur: 1.6,
    ease: [0.2, 0.7, 0.3, 1],
    vars: ["mx", "my"],
    keys: [
      [0, { tx: 0, ty: 0, op: 1 }],
      [1, { tx: ["mx", 1], ty: ["my", 1], op: 0 }],
    ],
  },
  tile: {
    dur: 3,
    ease: "ease-in-out",
    keys: [
      [0, { op: 0 }],
      [0.05, { op: 0 }],
      [0.12, { op: 1 }],
      [0.85, { op: 1 }],
      [0.95, { op: 0 }],
      [1, { op: 0 }],
    ],
  },
  // mind blown: the top of the head blows off, hangs, falls back down
  // and bounces once
  lid: {
    dur: 2.4,
    ease: "ease-out",
    keys: [
      [0, { ty: 0 }],
      [0.15, { ty: 0 }],
      [0.22, { ty: -60 }],
      [0.55, { ty: -66 }],
      [0.68, { ty: 0 }],
      [0.73, { ty: -12 }],
      [0.78, { ty: 0 }],
      [1, { ty: 0 }],
    ],
  },
  // chunks burst out of the head with it and fade (mx, my: where to)
  debris: {
    dur: 2.4,
    ease: "ease-out",
    vars: ["mx", "my"],
    keys: [
      [0, { tx: 0, ty: 0, op: 0 }],
      [0.15, { tx: 0, ty: 0, op: 0 }],
      [0.16, { op: 1 }],
      [0.45, { tx: ["mx", 1], ty: ["my", 1], op: 0 }],
      [1, { tx: 0, ty: 0, op: 0 }],
    ],
  },
  // the wide eyes snap down to pupils at the boom, then open wide again
  shock: {
    dur: 2.4,
    ease: "ease-in-out",
    keys: [
      [0, { sx: 1, sy: 1 }],
      [0.15, { sx: 1, sy: 1 }],
      [0.18, { sx: 0.5, sy: 0.5 }],
      [0.7, { sx: 0.5, sy: 0.5 }],
      [0.82, { sx: 1, sy: 1 }],
      [1, { sx: 1, sy: 1 }],
    ],
  },
};

/* ---------- evaluating an animation at time t ---------- */
const MOVE = ["tx", "ty", "sx", "sy"],
  REST = { tx: 0, ty: 0, sx: 1, sy: 1, op: 1 };
const EASES = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};
function bezier([x1, y1, x2, y2]) {
  const at = (a, b, t) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (p) => {
    if (p <= 0 || p >= 1) return p;
    let lo = 0,
      hi = 1,
      t = p;
    for (let i = 0; i < 24; i++) {
      t = (lo + hi) / 2;
      if (at(x1, x2, t) < p) lo = t;
      else hi = t;
    }
    return at(y1, y2, t);
  };
}
// The keys of one channel, with rest ends where the loop doesn't set them.
function channel(a, props) {
  const ks = a.keys.filter(([, v]) => props.some((q) => q in v));
  if (!ks.length) return null;
  if (ks[0][0] > 0) ks.unshift([0, {}]);
  if (ks[ks.length - 1][0] < 1) ks.push([1, {}]);
  return ks;
}
function prep(a) {
  a.fn =
    a.ease === "steps"
      ? (p) => (p >= 1 ? 1 : 0)
      : bezier(Array.isArray(a.ease) ? a.ease : EASES[a.ease]);
  a.move = channel(a, MOVE);
  a.fade = channel(a, ["op"]);
  return a;
}
const keyVal = (v, q, r) =>
  v == null ? REST[q] : Array.isArray(v) ? (r[v[0]] || 0) * v[1] : v;
// An animation at progress p (0..1). Only rotate() below asks: what a piece
// looks like at a time is the player's to say.
function sample(a, p, r = {}) {
  const out = { ...REST };
  for (const [ks, props] of [
    [a.move, MOVE],
    [a.fade, ["op"]],
  ]) {
    if (!ks) continue;
    let i = 1;
    while (i < ks.length - 1 && p > ks[i][0]) i++;
    const [p0, v0] = ks[i - 1],
      [p1, v1] = ks[i],
      k = p1 === p0 ? 1 : a.fn((p - p0) / (p1 - p0));
    props.forEach((q) => {
      const A = keyVal(v0[q], q, r),
        B = keyVal(v1[q], q, r);
      out[q] = A + (B - A) * k;
    });
  }
  return out;
}
/* Start a loop `by` of the way in. The keys keep their timing, they just
   begin elsewhere, so pick a point where every channel has a key (or holds
   still) and the curve is unchanged. */
function rotate(a, by) {
  // a loop that ends somewhere other than where it starts jumps at the end;
  // started elsewhere, that jump would become a slide between the two ends
  if (JSON.stringify(sample(a, 0)) !== JSON.stringify(sample(a, 1)))
    throw new Error(
      "START can't rotate a loop whose ends differ: key it from its rest instead",
    );
  const wrap = (p) => +((((p - by) % 1) + 1) % 1).toFixed(6),
    qs = [...new Set([0, 1, ...a.keys.map(([p]) => wrap(p))])].sort(
      (x, y) => x - y,
    ),
    keyed = (ks, p) =>
      ks &&
      ks.some(([kp]) => Math.abs(kp - p) < 1e-6 || Math.abs(kp - p - 1) < 1e-6);
  return {
    ...a,
    keys: qs.map((q) => {
      const p = q === 1 ? by : (q + by) % 1,
        s = sample(a, p),
        v = {},
        edge = q === 0 || q === 1;
      if (a.move && (edge || keyed(a.move, p)))
        MOVE.forEach((k) => (v[k] = s[k]));
      if (a.fade && (edge || keyed(a.fade, p))) v.op = s.op;
      return [q, v];
    }),
  };
}
Object.values(ANIM).forEach(prep);
// where each loop starts, so its first frame is the pose it rests in
const START = {
  peek: 0.25, // risen, looking over the ledge
  skq: 0.4, // the full skeptical look (the eye and the brow move together)
  skb: 0.4,
  tile: 0.12, // window drawn
  dot: 0.3, // lit
  pop: 0.2, // bright
  breathe: 0.5,
};
for (const [k, by] of Object.entries(START))
  ANIM[k] = prep(rotate(ANIM[k], by));
/* ---------- the same table, as CSS ---------- */
const easeCSS = (e) =>
  e === "steps"
    ? "steps(1)"
    : Array.isArray(e)
      ? `cubic-bezier(${e.join(",")})`
      : e;
function animCSS(name, a) {
  const num = (v) =>
    Array.isArray(v)
      ? `calc(var(--${v[0]}) * ${v[1]}px)`
      : `${+v.toFixed(4)}px`;
  // the rest comes first: the keys play over the end of the cycle, and the
  // first key holds until then
  const rest = a.rest || 0,
    cycle = rest + a.dur,
    at = (p) => +(((rest + p * a.dur) / cycle) * 100).toFixed(4);
  const style = (v) => {
    const d = [];
    if (MOVE.some((q) => q in v))
      d.push(
        `transform:translate(${num(v.tx ?? 0)},${num(v.ty ?? 0)}) scale(${v.sx ?? 1},${v.sy ?? 1})`,
      );
    if ("op" in v) d.push(`opacity:${v.op}`);
    return d.join(";");
  };
  const frames =
    (rest ? `0%{${style(a.keys[0][1])}}` : "") +
    a.keys.map(([p, v]) => `${at(p)}%{${style(v)}}`).join("");
  return `@keyframes omi-${name}{${frames}}\n.omi-a .${name}{animation:omi-${name} ${+cycle.toFixed(6)}s ${easeCSS(a.ease)} infinite}`;
}
// A piece's own timing and vars, as an inline style.
function pieceStyle(r) {
  const a = r.c && ANIM[r.c];
  if (!a) return "";
  const dur = r.dur || a.dur,
    cycle = dur + (a.rest || 0),
    s = [];
  if (dur !== a.dur) s.push(`animation-duration:${cycle}s`);
  // run dl seconds behind the loop, as the player does: a negative delay,
  // so it is already mid-loop on the first frame instead of waiting. To the
  // microsecond, since a millisecond off shows in a fast fade.
  if (r.dl) s.push(`animation-delay:${+((r.dl % cycle) - cycle).toFixed(6)}s`);
  (a.vars || []).forEach((v) => s.push(`--${v}:${r[v]}`));
  return s.join(";");
}
