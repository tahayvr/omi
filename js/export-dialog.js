/* ---------- export dialog (per-mode download button) ---------- */
const xdlg = $("xdlg");
const XKEYS = ["fmt", "ratio", "size", "pad", "vlen"];
let xd = null;

// Reuse the Controls panel's option lists so the two never drift apart.
XKEYS.forEach((k) => ($("x" + k).innerHTML = $(k).innerHTML));

// only the options that apply to the format
function xsync() {
  const fr = fmtRules($("xfmt").value);
  $("xratio").closest(".field").hidden = fr.noRatio;
  $("xsize").closest(".field").hidden = !fr.raster;
  $("xpad").closest(".field").hidden = fr.noPad;
  $("xclear").closest(".switch").hidden = fr.noClear;
  $("xlenField").hidden = !fr.video;
}
// a format brings its own options, as in the Controls
function xload(fmt, from) {
  const o = fmtOpts(fmt, from);
  ["ratio", "size", "pad", "vlen"].forEach((k) => {
    if (o[k] != null) $("x" + k).value = o[k];
  });
  if (o.clear != null) $("xclear").checked = o.clear;
  xsync();
}

function openExport(d) {
  xd = d;
  const E = eff(d.id);
  XKEYS.forEach((k) => ($("x" + k).value = E[k]));
  $("xfmt").querySelector("[value=mp4]").disabled = !MP4;
  $("xclear").checked = E.clear;
  $("xname").textContent = d.name;
  const xa = $("xart");
  xa.style.background = E.bg || "transparent";
  xa.innerHTML = svgFor(d, {
    color: E.fg,
    bg: null,
    animated: false,
    vb: squareBox(shapes(d).box, 0.1),
    label: labelOf(d),
  });
  xsync();
  xdlg.returnValue = "";
  xdlg.showModal();
}

$("xfmt").addEventListener("change", () =>
  xload($("xfmt").value, xd ? eff(xd.id) : S),
);

xdlg.addEventListener("close", async () => {
  if (xdlg.returnValue !== "export" || !xd) return;
  const d = xd;
  xd = null;
  // Remember the choices (also updates the Controls panel), and keep them
  // for the format.
  const patch = { clear: $("xclear").checked };
  XKEYS.forEach((k) => (patch[k] = $("x" + k).value));
  const kept = {};
  FMT_KEYS.forEach((k) => (kept[k] = patch[k]));
  patch.fmtOpts = { ...S.fmtOpts, [patch.fmt]: kept };
  set(patch);
  // A mode with its own export settings would otherwise ignore the choice.
  if ((S.over || {})[d.id]) {
    S = { ...S, over: { ...S.over, [d.id]: { ...S.over[d.id], ...patch } } };
    persist();
  }
  const video = fmtRules(patch.fmt).video;
  if (video) toast("Recording " + d.name + "…");
  try {
    const blob = await build(d);
    await save(fileName(d), blob);
  } catch (err) {
    toast(err.message);
  }
});
