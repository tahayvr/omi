/* ---------- the jig's Controls: the settings panel (jig.html) ----------
   Theme, colors, display and export options. A change made with a single
   design open in the view applies to that design only (its override); any
   other change is global. Either way set() saves it and draws the page again. */
const OVK = [
  "bg",
  "fg",
  "anim",
  "body",
  "speed",
  "fmt",
  "size",
  "pad",
  "clear",
  "vlen",
  "ratio",
];

function set(patch) {
  if (inView()) {
    const id = DESIGNS[vi].id,
      o = {},
      g = {};
    for (const k in patch) (OVK.includes(k) ? o : g)[k] = patch[k];
    S = {
      ...S,
      ...g,
      over: {
        ...S.over,
        ...(Object.keys(o).length
          ? { [id]: { ...(S.over || {})[id], ...o } }
          : {}),
      },
    };
  } else S = { ...S, ...patch };
  persist();
  render();
  if (inView()) showView();
}

function syncControls() {
  const S = ctx();
  $("bgPick").value = S.bg || "#ffffff";
  $("bgHex").value = S.bg || "none";
  $("fgPick").value = S.fg;
  $("fgHex").value = S.fg;
  const ti = THEMES.findIndex(
    (t) => t.bg === (S.bg || "").toLowerCase() && t.fg === S.fg.toLowerCase(),
  );
  $("themeSel").value = ti < 0 ? "custom" : String(ti);
  $("anim").checked = S.anim;
  $("names").checked = S.names;
  $("tile").value = S.tile;
  $("fmt").value = S.fmt;
  $("vlen").value = S.vlen;
  $("ratio").value = S.ratio;

  $("speed").value = S.speed;
  $("speedOut").textContent = S.speed + "\u00d7";
  $("body").checked = S.body !== false;
  $("rest").value = S.rest ?? 1;
  $("restOut").textContent = (S.rest ?? 1) + "\u00d7";
  $("size").value = S.size;
  $("pad").value = S.pad;
  $("clear").checked = S.clear;
  // only the options that apply to the format
  const fr = fmtRules(S.fmt);
  $("ratioField").hidden = fr.noRatio;
  $("sizeField").hidden = !fr.raster;
  $("padField").hidden = fr.noPad;
  $("clearField").hidden = fr.noClear;
  $("lenField").hidden = !fr.video;
  $("fmtNote").textContent = FMT_NOTES[S.fmt] || "";
  $("fmt").querySelector("[value=mp4]").disabled = !MP4;
  $("side").hidden = !S.side;
  $("toggleSide").setAttribute("aria-expanded", String(S.side));
  document
    .querySelectorAll("#bgSw .sw")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(
          (b.dataset.c || null) === (S.bg ? S.bg.toLowerCase() : null) ||
            (!b.dataset.c && !S.bg),
        ),
      ),
    );
  // the any-color swatch is on when the color isn't one of the others
  $("bgCustom").classList.toggle(
    "on",
    !!S.bg && !BG_SW.includes(S.bg.toLowerCase()),
  );
  $("fgCustom").classList.toggle("on", !FG_SW.includes(S.fg.toLowerCase()));
  document
    .querySelectorAll("#fgSw .sw")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.c === S.fg.toLowerCase()),
      ),
    );
}

/* swatches + themes */
$("bgSw").innerHTML = BG_SW.map((c) =>
  c
    ? `<button class="sw" data-c="${c}" style="background:${c}" aria-label="Background ${c}"></button>`
    : `<button class="sw clear" data-c="" aria-label="Transparent background"></button>`,
).join("");
$("fgSw").innerHTML = FG_SW.map(
  (c) =>
    `<button class="sw" data-c="${c}" style="background:${c}" aria-label="Omi color ${c}"></button>`,
).join("");
$("themeSel").innerHTML =
  '<option value="custom">Custom</option>' +
  [
    ["Dark", false],
    ["Light", true],
  ]
    .map(
      ([g, l]) =>
        `<optgroup label="${g}">${THEMES.map((t, i) => [t, i])
          .filter(([t]) => !!t.light === l)
          .map(([t, i]) => `<option value="${i}">${t.name}</option>`)
          .join("")}</optgroup>`,
    )
    .join("");
$("bgSw").addEventListener("click", (e) => {
  const b = e.target.closest(".sw");
  if (b) set({ bg: b.dataset.c || null });
});
$("fgSw").addEventListener("click", (e) => {
  const b = e.target.closest(".sw");
  if (b) set({ fg: b.dataset.c });
});
$("themeSel").addEventListener("change", (e) => {
  const t = THEMES[e.target.value];
  if (t) set({ bg: t.bg, fg: t.fg });
});
const hexOk = (v) => /^#[0-9a-f]{6}$/i.test(v);
$("bgPick").addEventListener("input", (e) => set({ bg: e.target.value }));
$("fgPick").addEventListener("input", (e) => set({ fg: e.target.value }));
$("bgHex").addEventListener("change", (e) => {
  let v = e.target.value.trim();
  if (v && v[0] !== "#") v = "#" + v;
  if (hexOk(v)) set({ bg: v.toLowerCase() });
  else if (v === "#none" || v === "#") set({ bg: null });
  else syncControls();
});
$("fgHex").addEventListener("change", (e) => {
  let v = e.target.value.trim();
  if (v[0] !== "#") v = "#" + v;
  if (hexOk(v)) set({ fg: v.toLowerCase() });
  else syncControls();
});
["anim", "names", "body"].forEach((k) =>
  $(k).addEventListener("change", (e) => set({ [k]: e.target.checked })),
);
$("clear").addEventListener("change", (e) =>
  keepForFormat("clear", e.target.checked),
);
$("tile").addEventListener("input", (e) => set({ tile: +e.target.value }));
$("speed").addEventListener("input", (e) => set({ speed: +e.target.value }));
// the rests are in the loops' CSS, which is one for the page: the rest scale
// is global, never one design's own
$("rest").addEventListener("input", (e) => {
  S = { ...S, rest: +e.target.value };
  persist();
  render();
  if (inView()) showView();
});
// a format brings its own options; an option picked is kept for the format
$("fmt").addEventListener("change", (e) =>
  set({ fmt: e.target.value, ...fmtOpts(e.target.value) }),
);
const keepForFormat = (k, v) => {
  const fmt = ctx().fmt;
  set({
    [k]: v,
    fmtOpts: { ...S.fmtOpts, [fmt]: { ...(S.fmtOpts || {})[fmt], [k]: v } },
  });
};
["size", "pad", "vlen", "ratio"].forEach((k) =>
  $(k).addEventListener("change", (e) => keepForFormat(k, e.target.value)),
);
$("rmPlay").addEventListener("click", () => set({ force: !S.force }));
const rmSync = () => {
  const S = ctx();
  $("rmHint").hidden = !RM.matches || !S.anim;
  $("rmPlay").textContent = S.force
    ? "Respect reduce motion"
    : "Play animations anyway";
};
RM.addEventListener && RM.addEventListener("change", () => rmSync());
$("toggleSide").addEventListener("click", () => set({ side: !S.side }));
$("closeSide").addEventListener("click", () => set({ side: false }));
