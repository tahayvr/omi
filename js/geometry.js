/* ---------- geometry (20-unit grid of the Omarchy logo) ---------- */
const R = (x, y, w, h, c) => ({ x, y, w, h, c });
/* Every piece has a role, so a morph knows what may become what and an app
   knows what it is drawing:
     frame  the logo, including the mouths it makes and the lights that run
            around it
     eye    whatever sits where the eyes are (eyes, X's, hearts, shades)
     brow, mouth, tear
     extra  props around the face: thinking dots, z's, confetti, arrows
   Logo pieces default to frame and face pieces to eye (see the end of
   designs.js); as() labels the rest. */
const as = (role, rects) => rects.map((r) => ({ ...r, role }));
const LOGO = [
  [0, 0, 300, 20],
  [0, 20, 20, 260],
  [280, 20, 20, 260],
  [0, 280, 160, 20],
  [180, 280, 120, 20],
  [140, 20, 20, 20],
  [40, 40, 120, 20],
  [220, 40, 40, 20],
  [40, 60, 20, 180],
  [240, 60, 20, 180],
  [40, 240, 220, 20],
  [20, 140, 20, 20],
  [140, 260, 20, 20],
].map((a) => ({ ...R(...a), role: "frame" }));
const blk = (cx, cy, pts, c) =>
  pts.map(([dx, dy]) => R(cx + dx * 20, cy + dy * 20, 20, 20, c));
const cellsOf = (path, extra = () => ({})) =>
  path.map(([x, y], i) => ({ ...R(x, y, 20, 20), ...extra(i, x, y) }));
// a light running along a path: each cell lags the one before it
function chase(path, dur, tail, offset = 0) {
  const N = path.length,
    c = "t" + Math.round(tail * 100);
  return cellsOf(path, (i) => ({
    c,
    dur,
    dl: ((i / N) * dur + offset) % dur,
  }));
}
const Z = (x, y, s, dl = 0) => {
  const t = s / 4;
  return [
    R(x, y, s, t, "z"),
    R(x + s - 2 * t, y + t, t, t, "z"),
    R(x + t, y + s - 2 * t, t, t, "z"),
    R(x, y + s - t, s, t, "z"),
  ].map((r) => ({ ...r, role: "extra", ...(dl ? { dl } : {}) }));
};
const F = {
  idle: [R(100, 110, 20, 40, "eye"), R(180, 110, 20, 40, "eye")],
  // both thinkings rest with the eyes a cell up, in idle's columns
  thinking: [
    R(100, 90, 20, 40, "eye"),
    R(180, 90, 20, 40, "eye"),
    // at rest the middle dot is at its peak, the first just past it and the
    // last on its way up: all three lit, the wave going left to right
    ...as("extra", [
      { ...R(160, 40, 20, 20, "dot"), dl: 1.35 },
      R(180, 40, 20, 20, "dot"),
      { ...R(200, 40, 20, 20, "dot"), dl: 0.25 },
    ]),
  ],
  success: [
    ...blk(80, 130, [
      [0, 0],
      [1, -1],
      [2, 0],
    ]),
    ...blk(160, 130, [
      [0, 0],
      [1, -1],
      [2, 0],
    ]),
  ],
  sleeping: [
    // shut: half a cell tall, on the half-cell grid
    R(80, 140, 40, 10, "breathe"),
    R(160, 140, 40, 10, "breathe"),
    // two z's of 10-unit pixels, half a loop apart, rising off the corner
    ...Z(310, 10, 40),
    ...Z(330, -50, 40, 1.3),
  ],
  sudo: [
    R(80, 110, 60, 40, "shades"),
    R(140, 110, 20, 20, "shades"),
    R(160, 110, 60, 40, "shades"),
  ],
  typing: [
    ...blk(90, 100, [
      [0, 0],
      [1, 1],
      [0, 2],
    ]),
    R(180, 100, 20, 60, "cur"),
  ],
};
const ARROW = [
  R(185, 20, 10, 22, "arrow"),
  R(171, 36, 38, 8, "arrow"),
  R(179, 44, 22, 8, "arrow"),
  R(187, 52, 6, 6, "arrow"),
];
const BANG = [R(185, 22, 10, 22, "pulseop"), R(185, 48, 10, 10, "pulseop")];
const QMARK = [
  R(178, 22, 26, 7, "pulseop"),
  R(197, 22, 7, 18, "pulseop"),
  R(186, 33, 18, 7, "pulseop"),
  R(186, 33, 7, 12, "pulseop"),
  R(186, 51, 7, 7, "pulseop"),
];
Object.assign(F, {
  sideeye: [R(100, 90, 20, 40, "look"), R(180, 90, 20, 40, "look")],
  // working: the eyes ride the press, and sparks fly off both sides
  working: [
    R(100, 110, 20, 40, "press-eye"),
    R(180, 110, 20, 40, "press-eye"),
    ...as("extra", [
      R(-30, 240, 20, 20, "spark-l"),
      R(-20, 270, 10, 10, "spark-l"),
      R(310, 240, 20, 20, "spark-r"),
      R(310, 270, 10, 10, "spark-r"),
    ]),
  ],
  // warning: a big "!" held up beside the head, and the eyes on it
  warning: [
    R(120, 90, 20, 40, "eye"),
    R(200, 90, 20, 40, "eye"),
    ...as("extra", [
      R(310, -50, 40, 70, "placard"),
      R(310, 40, 40, 20, "placard"),
    ]),
  ],
  hollow: [
    R(100, 110, 20, 5),
    R(100, 145, 20, 5),
    R(100, 115, 5, 30),
    R(115, 115, 5, 30),
    R(180, 110, 20, 5),
    R(180, 145, 20, 5),
    R(180, 115, 5, 30),
    R(195, 115, 5, 30),
  ],
  lowbat: [R(100, 200, 20, 20), R(180, 200, 20, 20)],
  // listening: idle's eyes, and sound marks beside the head, (( Omi )),
  // that travel out a cell and fade, then come back (mx: which way)
  listening: [
    R(100, 110, 20, 40, "eye"),
    R(180, 110, 20, 40, "eye"),
    ...as("extra", [
      { ...R(-20, 120, 10, 60, "wave"), mx: -20 },
      { ...R(-40, 100, 10, 100, "wave2"), mx: -20 },
      { ...R(310, 120, 10, 60, "wave"), mx: 20 },
      { ...R(330, 100, 10, 100, "wave2"), mx: 20 },
    ]),
  ],
  // a question mark where the eyes were
  confused: as("extra", [
    ...chase(
      [
        [100, 100],
        [120, 80],
        [140, 80],
        [160, 80],
        [180, 100],
        [180, 120],
        [160, 140],
        [140, 140],
        [140, 160],
      ],
      1.8,
      0.6,
    ),
    R(140, 200, 20, 20, "pulseop"),
  ]),
  // wink: idle's left eye, the right one shut
  wink: [R(100, 110, 20, 40, "eye"), R(170, 130, 40, 10)],
});
/* snake: inner frame split into 20-unit cells, in path order from the top gap clockwise */
const INNER = new Set([
  "40,40,120,20",
  "220,40,40,20",
  "40,60,20,180",
  "240,60,20,180",
  "40,240,220,20",
]);
const LOGO_OUT = LOGO.filter((r) => !INNER.has([r.x, r.y, r.w, r.h].join()));
const SNAKE_PATH = [
  [220, 40],
  [240, 40],
  ...[60, 80, 100, 120, 140, 160, 180, 200, 220].map((y) => [240, y]),
  [240, 240],
  ...[220, 200, 180, 160, 140, 120, 100, 80, 60, 40].map((x) => [x, 240]),
  ...[220, 200, 180, 160, 140, 120, 100, 80, 60].map((y) => [40, y]),
  ...[40, 60, 80, 100, 120, 140].map((x) => [x, 40]),
];
// At rest the head is at SNAKE_HEAD on the path: turning the bottom-right
// corner, the body in one piece up the right side.
const SNAKE_N = SNAKE_PATH.length,
  SNAKE_DUR = 2.4,
  SNAKE_HEAD = 15;
const SNAKE = SNAKE_PATH.map(([x, y], i) => ({
  ...R(x, y, 20, 20, "sn"),
  dl: (((i - SNAKE_HEAD + SNAKE_N) % SNAKE_N) / SNAKE_N) * SNAKE_DUR,
}));

/* emotions: eyes only (plus brows and tears). The mouth, when there is one,
   is the inner frame's bottom; see mouth() in frames.js. Animated faces rest
   on the full expression, so stills and PNG exports read correctly. */
Object.assign(F, {
  laughing: [
    ...blk(90, 100, [
      [0, 0],
      [1, 1],
      [0, 2],
    ]),
    ...blk(170, 100, [
      [1, 0],
      [0, 1],
      [1, 2],
    ]),
  ],
  excited: [
    R(100, 110, 20, 40, "twinkle"),
    R(90, 120, 40, 20, "twinkle"),
    R(180, 110, 20, 40, "twinkle"),
    R(170, 120, 40, 20, "twinkle"),
  ],
  shy: [R(100, 110, 20, 40, "shy"), R(180, 110, 20, 40, "shy")],
  skeptical: [
    R(90, 125, 40, 10, "skq"),
    { ...R(170, 90, 40, 10, "skb"), role: "brow" },
    R(180, 110, 20, 40, "eye"),
  ],
  // worried brows, inner ends raised
  sad: [
    ...as("brow", [
      R(90, 110, 20, 10),
      R(110, 100, 20, 10),
      R(170, 100, 20, 10),
      R(190, 110, 20, 10),
    ]),
    R(100, 130, 20, 30, "eye"),
    R(180, 130, 20, 30, "eye"),
  ],
  // closed eyes tilted inward: outer ends low, inner ends high
  crying: [
    R(90, 140, 20, 10),
    R(110, 130, 20, 10),
    R(170, 130, 20, 10),
    R(190, 140, 20, 10),
    ...as("tear", [R(95, 160, 10, 10, "drop"), R(195, 160, 10, 10, "drop")]),
  ],
  angry: [
    ...as("brow", [
      R(80, 100, 20, 10, "furrow"),
      R(100, 110, 20, 10, "furrow"),
      R(200, 100, 20, 10, "furrow"),
      R(180, 110, 20, 10, "furrow"),
    ]),
    R(100, 130, 20, 30),
    R(180, 130, 20, 30),
  ],
});
