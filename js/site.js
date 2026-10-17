/* ---------- the home page: a showcase (index.html) ----------
   The hero morphs through a few featured modes, the anatomy shows what Omi is
   made of, the Modes section (morph.js) plays every mode, and the ASCII section
   shows Omi as text. Every mode, to look at and export, is in the jig. */
// the hero's tour: states and feelings, mixed so no two in a row look alike
const FEATURED = [
  "idle",
  "thinking",
  "love",
  "download",
  "wink",
  "working",
  "laughing",
  "typing",
  "confused",
  "listening",
  "sudo",
  "success",
  "sleeping",
  "angry",
  "warning",
  "peek",
  "party",
  "tiling",
  "mind-blown",
];
let heroId = "idle",
  heroAuto = true,
  heroTimer = null,
  heroOmi = null; // the hero's player: it morphs between featured modes
const byIdD = (id) => DESIGNS.find((d) => d.id === id);
const fig = (svg, title) =>
  `<figure class="fig">${svg}<figcaption><b>${title}</b></figcaption></figure>`;
let asciiKey = "";
function renderSite() {
  // hero: starts as the plain logo and morphs into each featured mode
  const hd = byIdD(heroId) || DESIGNS[0];
  if (!heroOmi) {
    heroOmi = mountOmi($("heroCanvas"), {
      margin: 36,
      bleed: 124,
      mode: "logo",
    });
    // the tour starts once there's a hero to time it by
    if (!RM.matches)
      heroTimer = setTimeout(heroNext, showFor(heroOmi, heroId) * 1000);
  } else syncOmi(heroOmi);
  const fg = eff(hd.id).fg;
  heroOmi.color = fg === S.fg ? null : fg; // null: the page's accent color
  if (heroOmi.mode !== hd.id)
    heroOmi.set(hd.id, { instant: pagePlayerOpts().instant });
  // anatomy: the three in one frame, sized to fit them all, so the logo is
  // the same size in each
  const logo = { id: "logo", name: "Logo", face: [], mood: "" },
    parts = [logo, byIdD("idle"), byIdD("working")],
    all = parts.map((d) => shapes(d).box),
    same = squareBox(
      {
        x: Math.min(...all.map((b) => b.x)),
        y: Math.min(...all.map((b) => b.y)),
        x2: Math.max(...all.map((b) => b.x2)),
        y2: Math.max(...all.map((b) => b.y2)),
      },
      0.12,
    ),
    look = (d, label, anim) =>
      svgFor(d, {
        color: S.fg,
        animated: anim,
        force: S.force,
        vb: same,
        label,
      });
  const anat =
    fig(look(logo, "The Omarchy logo", false), "Logo") +
    fig(look(parts[1], "Omi icon", false), "Face") +
    fig(look(parts[2], "Omi working", S.anim), "Animation");
  if ($("anat")._html !== anat) {
    $("anat").innerHTML = anat;
    $("anat")._html = anat;
  }
  if (typeof renderMorph === "function") renderMorph();
  // ascii (async, only when the inputs change)
  const key = S.fg + "|" + S.pad;
  if (key !== asciiKey) {
    asciiKey = key;
    (async () => {
      const out = [];
      for (const [id, cap] of [
        ["idle", "Idle"],
        ["wink", "Wink"],
        ["confused", "Confused"],
        ["success", "Success"],
        ["working", "Working"],
        ["laughing", "Laughing"],
        ["warning", "Warning"],
        ["sudo", "Sudo"],
        ["love", "Love"],
      ]) {
        const d = byIdD(id);
        if (!d) continue;
        X = { ...S, pad: "0.04" };
        try {
          out.push(
            `<figure><div class="scroll"><pre>${esc(await ascii(d))}</pre></div><figcaption>${cap}</figcaption></figure>`,
          );
        } catch (e) {}
      }
      $("asciis").innerHTML = out.join("");
    })();
  }
}
function setHero(id, manual) {
  heroId = id;
  if (manual) {
    heroAuto = false;
    clearTimeout(heroTimer);
  }
  renderSite();
  applySpeed();
}
// the next featured mode once this one has morphed in and played its loops
function heroNext() {
  if (!heroAuto) return;
  const i = FEATURED.indexOf(heroId);
  setHero(FEATURED[(i + 1) % FEATURED.length], false);
  heroTimer = setTimeout(heroNext, showFor(heroOmi, heroId) * 1000);
}

function render() {
  paintStage();
  renderSite();
  applySpeed();
}
