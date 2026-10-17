/* ---------- Omi on the page: the reference player, fed the Omi pack ----------
   The page shows exactly what an app gets: the pack built by pack.js, as
   JSON, played by player/omi.js. The hero and the Modes section are players
   on a canvas; stills and video frames (and so every export of them) are the
   player's rects, from playerRects(). If it looks right here, it looks right
   in any app that uses the pack.

   The one thing the player doesn't draw is a mode looping as CSS: the
   tiles, the single view and the animated SVG export, which have to run
   without a script. jig.html?check (check.js) holds those to the player. */
let pagePackCache = null,
  pageSampler = null;
// round-trip through JSON: the players get exactly what omi.json holds
const pagePack = () =>
  pagePackCache || (pagePackCache = JSON.parse(JSON.stringify(buildPack())));
// What a screen reader says for a design: the pack's label for it.
const labelOf = (d) =>
  (pagePack().modes.find((m) => m.id === d.id) || {}).label || "Omi, " + d.name;
/* What the player draws of a design, t seconds into its loops (0: at rest),
   body motion and all. A design the pack doesn't have (the anatomy's bare
   logo) is packed on the spot. */
function playerRects(d, t) {
  if (!pageSampler) pageSampler = new Omi(null, pagePack(), { animate: false });
  return pageSampler
    .modeRects(pageSampler.modes[d.id] || packMode(d), t)
    .filter((r) => r.o > 0.001);
}
// what the players should do under the current settings
function pagePlayerOpts() {
  const still = RM.matches && !S.force;
  return { speed: S.speed || 1, animate: S.anim && !still, instant: still };
}
/* A player on a canvas inside an .omi-stage. `margin` is the room around the
   logo inside the stage, in pack units; the canvas bleeds `bleed` units
   further on every side, so props like the z's can drift outside the stage.
   The body stays put (no bob, hop or shake), so every morph starts and ends
   at the same spot. */
function mountOmi(canvas, { margin = 70, bleed = 90, mode } = {}) {
  const side = 300 + 2 * margin;
  canvas.style.setProperty("--bleed", `${(bleed / side) * 100}%`);
  return new Omi(canvas, pagePack(), {
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

// how long to stay on a mode: long enough to play its loop once, and the
// morph into it, but no hurry and no dawdling
const dwell = (id) =>
  (Math.min(4.8, Math.max(2.4, omi.loopSeconds(id))) +
    omi.pack.morph.duration +
    omi.pack.morph.stagger) /
  Math.max(0.25, S.speed || 1);
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

// a still of each mode, all in the pack's view so Omi is one size in all
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
