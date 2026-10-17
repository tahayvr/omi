/* ---------- Omi on the page: the reference player, fed the Omi kit ----------
   The page shows exactly what an app gets: the kit built by kit.js, as
   JSON, played by player/omi.js. The hero and the Modes section are players
   on a canvas; stills and video frames (and so every export of them) are the
   player's rects, from playerRects(). If it looks right here, it looks right
   in any app that uses the kit.

   The one thing the player doesn't draw is a mode looping as CSS: the
   tiles, the single view and the animated SVG export, which have to run
   without a script. jig.html?check (check.js) holds those to the player. */
let pageKitCache = null,
  pageSampler = null;
// round-trip through JSON: the players get exactly what omi.json holds
const pageKit = () =>
  pageKitCache || (pageKitCache = JSON.parse(JSON.stringify(buildKit())));
// What a screen reader says for a design: the kit's label for it.
const labelOf = (d) =>
  (pageKit().modes.find((m) => m.id === d.id) || {}).label || "Omi, " + d.name;
/* What the player draws of a design, t seconds into its loops (0: at rest),
   body motion and all. A design the kit doesn't have (the anatomy's bare
   logo) is made into one on the spot. */
function playerRects(d, t, { body = true, rest = 1 } = {}) {
  if (!pageSampler) pageSampler = new Omi(null, pageKit(), { animate: false });
  pageSampler.bodyMotion = body;
  pageSampler.rest = rest;
  return pageSampler
    .modeRects(pageSampler.modes[d.id] || kitMode(d), t)
    .filter((r) => r.o > 0.001);
}
/* A video's length, in loops of the mode. One loop plays every piece's
   animation through once (the player's loopSeconds, with the rest scaled as
   picked, and the body's loop only when the body moves), then runs on to
   the first moment Omi is back where the video started: the bob down, no
   eye mid-blink. N loops run to the first such moment after N of those, so
   a video set to repeat ends on the frame it began on and jumps nowhere.
   Some modes have pieces on beats of their own (sleeping's z's drift on
   2.6 s, its bob on 2.8 s) and come back only after many passes; past
   LEN_MORE more seconds, a loop ends on the frame nearest the start, and
   meets is false. */
const LEN_STEP = 1 / 120,
  LEN_MORE = 12,
  lenCache = new Map();
function videoLoop(d, o = X) {
  const loops = Math.max(1, Math.round(+o.loops || 1)),
    speed = Math.max(0.05, o.speed || 1),
    rest = o.rest ?? 1,
    body = o.body !== false,
    key = [d.id, loops, rest, body].join(" ");
  if (!lenCache.has(key)) lenCache.set(key, findLoop(d, loops, rest, body));
  const L = lenCache.get(key);
  return { secs: L.t / speed, meets: L.meets };
}
const videoLength = (d, o) => videoLoop(d, o).secs;
function findLoop(d, loops, rest, body) {
  if (!pageSampler) playerRects(d, 0);
  const P = pageSampler,
    mode = P.modes[d.id] || kitMode(d);
  P.rest = rest;
  P.bodyMotion = body;
  P.modes["\0len"] = body ? mode : { ...mode, anim: undefined };
  const pass = P.loopSeconds("\0len");
  delete P.modes["\0len"];
  if (!pass) return { t: loops, meets: true }; // a still mode: a second a loop
  const start = P.modeRects(mode, 0),
    [, , bw, bh] = mode.bounds,
    eps = Math.max(bw, bh) / 20000,
    off = (t) => {
      let m = 0;
      P.modeRects(mode, t).forEach((r, i) => {
        const q = start[i];
        m = Math.max(
          m,
          Math.abs(r.x - q.x),
          Math.abs(r.y - q.y),
          Math.abs(r.w - q.w),
          Math.abs(r.h - q.h),
          Math.abs(r.o - q.o) * bw,
        );
      });
      return m;
    },
    // the first moment from `t0` on that Omi is back at the start
    back = (t0) => {
      const from = Math.ceil(t0 / LEN_STEP - 1e-6);
      let best = from,
        bestOff = Infinity;
      for (let i = from; i <= from + LEN_MORE / LEN_STEP; i++) {
        const m = off(i * LEN_STEP);
        if (m < eps) return { t: i * LEN_STEP, meets: true };
        if (m < bestOff) {
          best = i;
          bestOff = m;
        }
      }
      return { t: best * LEN_STEP, meets: false };
    };
  const one = back(pass);
  if (loops === 1) return one;
  return one.meets ? back(one.t * loops) : { t: one.t * loops, meets: false };
}
// what Length makes of a design (or of every design, with none)
function loopsNote(d, o) {
  if (!d)
    return "Each design plays its own loop that many times, and ends where it began.";
  const n = Math.max(1, Math.round(+o.loops || 1)),
    { secs, meets } = videoLoop(d, o),
    s = secs < 10 ? +secs.toFixed(2) : Math.round(secs * 10) / 10;
  return (
    `${n} ${n === 1 ? "loop" : "loops"} of ${d.name}: ${s} s.` +
    (meets
      ? ""
      : ` Its pieces keep beats of their own, so the end won\u2019t quite meet the start.`)
  );
}
// what the players should do under the current settings
function pagePlayerOpts() {
  const still = RM.matches && !S.force;
  return {
    speed: S.speed || 1,
    rest: S.rest ?? 1,
    animate: S.anim && !still,
    instant: still,
  };
}
/* A player on a canvas inside an .omi-stage. `margin` is the room around the
   logo inside the stage, in kit units; the canvas bleeds `bleed` units
   further on every side, so props like the z's can drift outside the stage.
   The body stays put (no bob, hop or shake), so every morph starts and ends
   at the same spot. */
function mountOmi(canvas, { margin = 70, bleed = 90, mode } = {}) {
  const side = 300 + 2 * margin;
  canvas.style.setProperty("--bleed", `${(bleed / side) * 100}%`);
  return new Omi(canvas, pageKit(), {
    view: [
      -margin - bleed,
      -margin - bleed,
      side + 2 * bleed,
      side + 2 * bleed,
    ],
    bodyMotion: false,
    mode,
    ...pagePlayerOpts(),
  });
}
// settings changed (speed, animate, reduce motion, theme)
function syncOmi(player) {
  const o = pagePlayerOpts();
  player.speed = o.speed;
  player.rest = o.rest;
  if (player.animate !== o.animate) player.animate = o.animate;
  player.draw(); // picks up a new theme color
}

/* ---------- the Modes section (home page) ----------
   One big Omi and a chip per mode: pick one and Omi morphs into it from
   wherever it is. It plays through every mode by itself, unless the viewer
   asks for less motion; picking a mode pauses it, and Play goes on from
   there. */
const modeIds = () => DESIGNS.map((d) => d.id);
let omi = null,
  playing = false,
  playTimer = 0;

function morphTo(id) {
  omi.set(id, { instant: pagePlayerOpts().instant });
  syncMorphUI();
}

/* How long a tour stays on a mode, in seconds: the morph into it, then
   whole loops of it, at least 2.4 s of them. A mode's loops start when its
   morph lands, so moving on after whole loops never cuts one short. */
function showFor(player, id) {
  const loop = player.loopSeconds(id),
    loops = loop > 0 ? loop * Math.ceil(2.4 / loop - 1e-9) : 2.4;
  return (
    (player.kit.morph.duration + player.kit.morph.stagger + loops) /
    Math.max(0.25, S.speed || 1)
  );
}
const dwell = (id) => showFor(omi, id);
function nextMode() {
  const ids = modeIds();
  morphTo(ids[(ids.indexOf(omi.mode) + 1) % ids.length]);
  playTimer = setTimeout(nextMode, dwell(omi.mode) * 1000);
}
function play() {
  if (playing) return;
  playing = true;
  playTimer = setTimeout(nextMode, dwell(omi.mode) * 1000);
  syncMorphUI();
}
function pause() {
  playing = false;
  clearTimeout(playTimer);
  syncMorphUI();
}

// The picker shows one group at a time, under a tab per group; idle opens
// the thinking tab rather than having one of its own.
const groupOf = (d) => (d.group === "Core" ? "Thinking" : d.group),
  TAB_NAME = { "System states": "System" },
  tabName = (g) => TAB_NAME[g] || g;
let shownGroup = "Thinking";
function showGroup(g) {
  shownGroup = g;
  document.querySelectorAll("#mpick .mtab").forEach((t) => {
    const on = t.dataset.group === g;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
  });
  document
    .querySelectorAll("#mpick .mpanel")
    .forEach((p) => (p.hidden = p.dataset.group !== g));
}

function syncMorphUI() {
  const id = omi ? omi.mode : "idle";
  document
    .querySelectorAll("#mpick .mthumb")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.id === id)),
    );
  const d = DESIGNS.find((x) => x.id === id);
  // while it plays, the tabs follow the mode on show
  if (d && playing && groupOf(d) !== shownGroup) showGroup(groupOf(d));
  // and where a tab's modes are a row that scrolls (phones), the row keeps
  // the mode on show in sight
  const on = document.querySelector(
      `#mpick .mpanel:not([hidden]) .mthumb[aria-pressed="true"]`,
    ),
    row = on && on.parentElement;
  if (row && row.scrollWidth > row.clientWidth)
    row.scrollTo({
      left: on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2,
      behavior: RM.matches ? "auto" : "smooth",
    });
  $("mname").textContent = d ? d.name : "";
  $("msays").textContent = omi ? omi.label(id) : "";
  const b = $("mplay");
  b.setAttribute("aria-pressed", String(playing));
  b.classList.toggle("on", playing);
  $("mplayText").textContent = playing ? "Pause" : "Play";
}

// a still of each mode, all in the kit's view so Omi is one size in all
let thumbsKey = "";
function drawThumbs() {
  const key = S.fg;
  if (key === thumbsKey) return;
  thumbsKey = key;
  document.querySelectorAll("#mpick .mthumb").forEach((b) => {
    const d = DESIGNS.find((x) => x.id === b.dataset.id);
    b.querySelector(".mart-s").innerHTML = svgFor(d, {
      color: S.fg,
      animated: false,
      vb: MORPH_VB,
    }).replace("<svg ", '<svg aria-hidden="true" ');
  });
}

function renderMorph() {
  const pick = $("mpick");
  if (!pick._built) {
    pick._built = true;
    const groups = [...new Set(DESIGNS.map(groupOf))];
    pick.innerHTML =
      `<div class="mtabs" role="tablist" aria-label="Kinds of mode">${groups
        .map(
          (g) =>
            `<button class="mtab" type="button" role="tab" id="mtab-${g.replace(/\W/g, "")}" data-group="${g}" aria-controls="mpanel-${g.replace(/\W/g, "")}" aria-selected="false">${tabName(g)}<span>${DESIGNS.filter((d) => groupOf(d) === g).length}</span></button>`,
        )
        .join("")}</div><div class="mpanels">` +
      groups
        .map(
          (g) =>
            `<div class="mpanel" role="tabpanel" id="mpanel-${g.replace(/\W/g, "")}" data-group="${g}" aria-labelledby="mtab-${g.replace(/\W/g, "")}">${DESIGNS.filter(
              (d) => groupOf(d) === g,
            )
              .map(
                (d) =>
                  `<button class="mthumb" type="button" data-id="${d.id}" aria-pressed="false"><span class="mart-s"></span><span class="mlabel">${d.name}</span></button>`,
              )
              .join("")}</div>`,
        )
        .join("") +
      "</div>";
    pick.addEventListener("click", (e) => {
      const t = e.target.closest(".mtab");
      if (t) return showGroup(t.dataset.group);
      const b = e.target.closest(".mthumb");
      if (!b) return;
      pause();
      morphTo(b.dataset.id);
    });
    // arrow keys move between the tabs, as a tab list does
    pick.querySelector(".mtabs").addEventListener("keydown", (e) => {
      const i = groups.indexOf(shownGroup),
        n = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!n) return;
      e.preventDefault();
      showGroup(groups[(i + n + groups.length) % groups.length]);
      pick.querySelector(`.mtab[data-group="${shownGroup}"]`).focus();
    });
    $("mplay").addEventListener("click", () => (playing ? pause() : play()));
    omi = mountOmi($("mcanvas"), { mode: "idle" });
    showGroup("Thinking");
    drawThumbs();
    syncMorphUI();
    if (!RM.matches) play();
    return;
  }
  drawThumbs();
  syncOmi(omi);
}
