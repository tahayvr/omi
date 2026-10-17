/* ---------- the jig: every mode as a tile, to look at and export (jig.html) ----------
   Click a tile for the single view (viewer.js), the download button under it
   to export it (export-dialog.js); the Controls (controls.js) restyle the
   page and set the export options for "Export all". */
const grid = $("grid");
const RESET_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path><path d="M3 3v5h5"></path></svg>';
const hasOver = (id) =>
  !!(S.over || {})[id] && Object.keys(S.over[id]).length > 0;
function clearOver(id) {
  const o = { ...S.over };
  delete o[id];
  S = { ...S, over: o };
  persist();
  render();
}
const DL_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11"></path><path d="M7 10l5 5 5-5"></path><path d="M5 20h14"></path></svg>';

function render() {
  const vb = uniformBox();
  paintStage();
  grid.style.setProperty("--tile", S.tile + "px");
  const groups = [...new Set(DESIGNS.map((d) => d.group))];
  const E = (d) => eff(d.id);
  const tile = (d) => `
    <figure class="tile" role="listitem">
      <button class="open" data-id="${d.id}" aria-label="Open ${d.name}"><div class="art${E(d).bg !== S.bg ? " own" : ""}" data-sid="${d.id}"${E(d).bg !== S.bg ? ` style="background:${E(d).bg || "transparent"}"` : ""}>${svgFor(d, { color: E(d).fg, animated: E(d).anim, force: S.force, vb, label: labelOf(d) })}</div></button>
      <figcaption class="meta">
${S.names ? `<span class="name">${d.name}</span>` : ""}${hasOver(d.id) ? `<button class="reset" data-id="${d.id}" aria-label="Reset ${d.name} to global settings" title="Has its own settings. Reset to global">${RESET_ICON}</button>` : ""}
<button class="save" data-id="${d.id}" aria-label="Export ${d.name}" title="Export ${d.name}">${DL_ICON}</button>
      </figcaption>
    </figure>`;
  const shown = DESIGNS;
  const gridHTML =
    (shown.length
      ? ""
      : `<p style="padding:40px 0;color:var(--label)">Nothing here yet.</p>`) +
    groups
      .filter((g) => shown.some((d) => d.group === g))
      .map(
        (g) =>
          `<section class="group" aria-label="${g}">${g === "Core" ? "" : `<h2>${g}</h2>`}<div class="tiles" role="list">${shown
            .filter((d) => d.group === g)
            .map(tile)
            .join("")}</div></section>`,
      )
      .join("");
  if (gridHTML !== grid._html) {
    grid.innerHTML = gridHTML;
    grid._html = gridHTML;
  }
  syncControls();
  if (typeof rmSync === "function") rmSync();
  applySpeed();
}

grid.addEventListener("click", async (e) => {
  const o = e.target.closest(".open");
  if (o) {
    openView(o.dataset.id);
    return;
  }
  const r = e.target.closest(".reset");
  if (r) {
    clearOver(r.dataset.id);
    toast("Back to global settings");
    return;
  }
  const b = e.target.closest(".save");
  if (!b) return;
  openExport(DESIGNS.find((x) => x.id === b.dataset.id));
});
$("saveAll").addEventListener("click", async () => {
  const btn = $("saveAll");
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = "Building ZIP\u2026";
  try {
    const files = [];
    for (const [i, d] of DESIGNS.entries()) {
      if (["webm", "mp4"].includes(S.fmt))
        btn.textContent = `Recording ${i + 1} of ${DESIGNS.length}\u2026`;
      const blob = await build(d);
      files.push({
        name: fileName(d),
        data: new Uint8Array(await blob.arrayBuffer()),
      });
    }
    await save(
      `omi-${S.fmt === "svga" ? "svg-animated" : S.fmt}.zip`,
      zip(files),
    );
  } catch (err) {
    toast(err.message);
  } finally {
    btn.textContent = label;
    btn.disabled = false;
  }
});
$("copyAll").addEventListener("click", async () => {
  const sprite =
    '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n' +
    DESIGNS.map((d) => {
      const sh = shapes(d),
        vb = squareBox(sh.box, +S.pad);
      const inner = svgFor(d, {
        color: S.fg,
        bg: null,
        vb,
      })
        .replace(/^<svg[^>]*>/, "")
        .replace(/<\/svg>$/, "");
      return `  <symbol id="omi-${d.id}" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}">${inner}</symbol>`;
    }).join("\n") +
    "\n</svg>\n";
  try {
    await navigator.clipboard.writeText(sprite);
    toast('SVG sprite copied. Use <svg><use href="#omi-idle"/></svg>.');
  } catch (e) {
    toast("Clipboard access was blocked. Export as SVG instead.");
  }
});
