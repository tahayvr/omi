/* ---------- the home page: a showcase (index.html) ----------
   The hero morphs through a few featured modes, the anatomy shows what Omi is
   made of, the Morph section (morph.js) plays any pair, and the terminal
   shows Omi as text. Every mode, to look at and export, is in the jig. */
const FEATURED = [
  "idle",
  "wink",
  "thinking",
  "typing",
  "listening",
  "party",
  "sleeping",
  "sudo",
  "mind-blown",
];
let heroId = "idle",
  heroAuto = true,
  heroTimer = null,
  heroOmi = null; // the hero's player: it morphs between featured modes
const byIdD = (id) => DESIGNS.find((d) => d.id === id);
const fig = (svg, title, sub) =>
  `<figure class="fig">${svg}<figcaption><b>${title}</b>${sub ? `<span>${sub}</span>` : ""}</figcaption></figure>`;
let asciiKey = "";
function renderSite() {
  const box = (d) => squareBox(shapes(d).box, 0.12);
  const art = (d, label, anim = S.anim) =>
    svgFor(d, {
      color: S.fg,
      animated: anim,
      force: S.force,
      vb: box(d),
      label,
    });
  // hero: starts as the plain logo and morphs into each featured mode
  const hd = byIdD(heroId) || DESIGNS[0];
  if (!heroOmi)
    heroOmi = mountOmi($("heroCanvas"), {
      margin: 36,
      bleed: 124,
      mode: "logo",
    });
  else syncOmi(heroOmi);
  const fg = eff(hd.id).fg;
  heroOmi.color = fg === S.fg ? null : fg; // null: the page's accent color
  if (heroOmi.mode !== hd.id)
    heroOmi.set(hd.id, { instant: pagePlayerOpts().instant });
  $("heroName").textContent = hd.name; // the canvas's own label is the player's
  // anatomy
  const logo = { id: "logo", name: "Logo", face: [], mood: "" };
  const anat =
    fig(art(logo, "The Omarchy logo", false), "The logo", "unchanged") +
    fig(
      art(byIdD("idle"), "Omi icon", false),
      "The face",
      "eyes in the inner square",
    ) +
    fig(
      art(byIdD("working"), "Omi working"),
      "The frames",
      "parts of the logo animate with the eyes",
    );
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
    clearInterval(heroTimer);
  }
  renderSite();
  applySpeed();
}
if (!RM.matches)
  heroTimer = setInterval(() => {
    if (!heroAuto) return;
    const i = FEATURED.indexOf(heroId);
    setHero(FEATURED[(i + 1) % FEATURED.length], false);
  }, 3600);

function render() {
  paintStage();
  $("modeCount").textContent = DESIGNS.length;
  renderSite();
  applySpeed();
}
