/* ---------- frame effects: whole frame parts animate with the eyes ---------- */
const OUTER_RECTS = LOGO.slice(0, 5),
  INNER_RECTS = LOGO.filter((r) => INNER.has([r.x, r.y, r.w, r.h].join()));
const MISC = LOGO.filter(
  (r) => !OUTER_RECTS.includes(r) && !INNER_RECTS.includes(r),
);
const range = (a, b, s = 20) => {
  const o = [];
  for (let v = a; s > 0 ? v <= b : v >= b; v += s) o.push(v);
  return o;
};
const OUT_PATH = [
  ...range(0, 280).map((x) => [x, 0]),
  ...range(20, 280).map((y) => [280, y]),
  ...range(260, 180, -20).map((x) => [x, 280]),
  ...range(140, 20, -20).map((x) => [x, 280]),
  ...range(280, 20, -20).map((y) => [0, y]),
];
const tint = (rects, c) => rects.map((r) => ({ ...r, c }));
/* transfer: the logo rests whole, then a pass: a short dark gap runs along
   the frame, one cell after another, and when it gets to the end the arrow
   is painted, row by row from the frame out (it erased itself as the gap
   set off). Every piece plays its animation late by its place in line
   ("pass" the frame's dip, "paint" the arrow's, see motion.js), and the
   rest between passes is those animations' rest, which apps can scale. */
const PASS_DT = 0.04,
  PAINT_DT = 0.08;
function flow(paths, arrow = []) {
  const out = [];
  paths.forEach((p) =>
    p.forEach(([x, y], k) =>
      out.push({ ...R(x, y, 20, 20, "pass"), dl: k * PASS_DT }),
    ),
  );
  // the arrow's own timing (painted as the gap arrives) is in "paint"
  arrow.forEach(([x, y, w, h], k) =>
    out.push({ ...R(x, y, w, h, "paint"), dl: k * PAINT_DT }),
  );
  return out;
}
const UP_L = [
  ...range(140, 20, -20).map((x) => [x, 280]),
  [0, 280],
  ...range(260, 20, -20).map((y) => [0, y]),
  [0, 0],
  ...range(20, 140).map((x) => [x, 0]),
];
const UP_R = [
  ...range(180, 260).map((x) => [x, 280]),
  [280, 280],
  ...range(260, 20, -20).map((y) => [280, y]),
  [280, 0],
  ...range(260, 160, -20).map((x) => [x, 0]),
];
const DN_L = UP_L.slice().reverse(),
  DN_R = UP_R.slice().reverse();
// which way a piece of the logo moves out: away from the middle, by `step`
function outward(r, step) {
  const dir = (v) => (Math.abs(v) < 40 ? 0 : Math.sign(v) * step);
  return { dx: dir(r.x + r.w / 2 - 150), dy: dir(r.y + r.h / 2 - 150) };
}
function sides(dir) {
  const col = (x, from, to) =>
    (dir > 0 ? range(from, to) : range(to, from, -20)).map((y) => [x, y]);
  const outer = flow([col(0, 0, 280), col(280, 0, 280)]),
    inner = flow([col(40, 60, 220), col(240, 60, 220)]).map((r) => ({
      ...r,
      dl: r.dl + 4 * PASS_DT,
    }));
  return [
    ...MISC,
    ...cellsOf(range(20, 260).map((x) => [x, 0])),
    ...cellsOf([...range(20, 140), ...range(180, 260)].map((x) => [x, 280])),
    ...outer,
    ...cellsOf([
      ...range(40, 140).map((x) => [x, 40]),
      [220, 40],
      [240, 40],
      ...range(40, 240).map((x) => [x, 240]),
    ]),
    ...inner,
  ];
}
const FRAMES = {
  download: [
    ...MISC,
    ...INNER_RECTS,
    ...flow(
      [DN_L, DN_R],
      [
        [140, 300, 20, 20],
        [100, 320, 100, 20],
        [120, 340, 60, 20],
        [140, 360, 20, 20],
      ],
    ),
  ],
  upload: [
    ...MISC,
    ...INNER_RECTS,
    ...flow(
      [UP_L, UP_R],
      [
        [140, -20, 20, 20],
        [100, -40, 100, 20],
        [120, -60, 60, 20],
        [140, -80, 20, 20],
      ],
    ),
  ],
  // the press: the inner square stamps down
  working: [...OUTER_RECTS, ...MISC, ...tint(INNER_RECTS, "press")],
  // the burst: every piece out a step from the middle (the inner square's
  // half as far, so it never meets the frame) and back
  success: LOGO.map((r) => ({
    ...r,
    c: "burst",
    ...outward(r, INNER_RECTS.includes(r) ? 10 : 20),
  })),
  // the variations: the gap climbs (or drops down) the frame's four sides,
  // the inner ones a little behind the outer ones
  "upload-rising": sides(-1),
  "download-falling": sides(1),
  "low-battery": [
    ...MISC.map((r) => (r.y >= 260 ? r : { ...r, o: 0.2 })),
    ...INNER_RECTS,
    ...cellsOf(OUT_PATH, (i, x, y) =>
      // the battery's last bit pulses, slowly
      y >= 260 ? (y === 260 ? { c: "pulseop", dur: 2.4 } : {}) : { o: 0.2 },
    ),
  ],
  sleeping: [
    ...tint(MISC, "breathe"),
    ...tint(INNER_RECTS, "breathe"),
    ...tint(OUTER_RECTS, "breathe"),
  ],
  typing: [
    ...MISC,
    ...INNER_RECTS,
    ...cellsOf([
      ...range(0, 280).map((x) => [x, 0]),
      ...range(20, 260).map((y) => [280, y]),
      ...range(20, 260).map((y) => [0, y]),
    ]),
    ...chase(
      [...range(0, 140), ...range(180, 280)].map((x) => [x, 280]),
      1.6,
      0.3,
    ),
  ],
  surprised: [
    ...tint(MISC, "pop"),
    ...INNER_RECTS,
    ...tint(OUTER_RECTS, "pop"),
  ],
};

/* mouths: the inner frame's bottom becomes the mouth. Same geometry: the
   inner frame is split into segments and everything but the head and the
   mouth dims. The head (top bar, and both walls down through the left dip,
   to y 160) always stays lit. Mouths reach no higher than y 180, leaving one
   dim cell between head and mouth.
   left / right: lit [y0, y1, class?] spans of the side walls (180–240)
   bottom: lit [x0, x1, class?] spans of the bottom bar (40–260) */
const DIM = 0.2;
function mouth({ left = [], right = [], bottom = [], dimDip = false } = {}) {
  // dimDip dims the bottom dip too (the stub under the inner frame at y 260)
  const misc = dimDip
    ? MISC.map((r) => (r.y === 260 ? { ...r, o: DIM } : r))
    : MISC;
  const out = [...OUTER_RECTS, ...misc, R(40, 40, 120, 20), R(220, 40, 40, 20)];
  // walk a span, emitting lit pieces where listed and dim pieces between
  const run = (from, to, lit, mk) => {
    let at = from;
    [...lit]
      .sort((p, q) => p[0] - q[0])
      .forEach(([a, b, c]) => {
        if (a > at) out.push({ ...mk(at, a), o: DIM });
        out.push({ ...mk(a, b), ...(c ? { c } : {}) });
        at = b;
      });
    if (at < to) out.push({ ...mk(at, to), o: DIM });
  };
  const HEAD = [60, 160];
  run(60, 240, [HEAD, ...left], (a, b) => R(40, a, 20, b - a));
  run(60, 240, [HEAD, ...right], (a, b) => R(240, a, 20, b - a));
  run(40, 260, bottom, (a, b) => R(a, 240, b - a, 20));
  return out;
}
const both = (segs) => ({ left: segs, right: segs });
Object.assign(FRAMES, {
  happy: mouth({
    ...both([[180, 240]]),
    bottom: [[40, 260]],
  }),
  laughing: mouth({
    ...both([
      [180, 200, "ha"],
      [200, 240],
    ]),
    bottom: [[40, 260]],
  }),
  shy: mouth({ dimDip: true }),
  skeptical: mouth({
    right: [[200, 240, "skm"]],
    bottom: [[140, 260, "skm"]],
  }),
  bored: mouth({ bottom: [[100, 180]] }),
  scared: mouth({ bottom: [[110, 190, "flash"]] }),
  angry: mouth({ bottom: [[40, 260]] }),
});
