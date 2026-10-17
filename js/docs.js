/* ---------- the docs page (docs.html) ----------
   The repo's own markdown, read as it is and drawn here with marked
   (js/vendor/marked.js): edit a .md file and this page shows the change,
   with nothing to build. docs.html?doc=<id> opens one; #<heading> goes to
   a section of it.

   Links in a doc are made to work from this page: one to another doc in
   DOCS opens it here, one to a page of the site goes there, and one to
   anything else in the repo (code, a folder) opens it on GitHub. Images are
   the site's own files, found from the doc's folder. */
const REPO = "https://github.com/tahayvr/omi";

// Every doc, by kind, in the order the page lists them. id is its address
// (docs.html?doc=id), file the markdown in the repo.
const DOCS = [
  {
    kind: "Start",
    docs: [
      { id: "overview", file: "README.md", title: "Overview" },
      { id: "apps", file: "examples/README.md", title: "Omi in your app" },
      { id: "omarchy", file: "docs/omarchy.md", title: "Omi in Omarchy" },
    ],
  },
  {
    kind: "Reference",
    docs: [
      { id: "kit", file: "kit/README.md", title: "The kit" },
      { id: "modes", file: "docs/modes.md", title: "Every mode" },
      { id: "protocol", file: "protocol/README.md", title: "State protocol" },
      { id: "service", file: "service/README.md", title: "State service" },
    ],
  },
  {
    kind: "Players",
    docs: [
      { id: "python", file: "player/python/README.md", title: "Python" },
      { id: "rust", file: "player/rust/README.md", title: "Rust" },
    ],
  },
  {
    kind: "Design",
    docs: [
      { id: "designing", file: "docs/designing.md", title: "Designing a mode" },
      { id: "ideas", file: "docs/ideas.md", title: "Ideas" },
    ],
  },
  {
    kind: "Project",
    docs: [{ id: "changelog", file: "CHANGELOG.md", title: "Changelog" }],
  },
];
const ALL = DOCS.flatMap((k) => k.docs);
const byFile = new Map(ALL.map((d) => [d.file, d]));
// the site's own pages: a link to one stays on the site
const PAGES = /^(index|jig|docs)\.html$|^examples\/web\/(index\.html)?$/;

const $d = (id) => document.getElementById(id);
const nav = $d("dnav"),
  article = $d("doc"),
  toc = $d("toc");

// the docs, a link each, under their kind
nav.innerHTML = DOCS.map(
  (k) =>
    `<div class="dkind"><h2>${k.kind}</h2>${k.docs
      .map(
        (d) =>
          `<a href="docs.html?doc=${d.id}" data-doc="${d.id}">${d.title}</a>`,
      )
      .join("")}</div>`,
).join("");

// a heading's id, the way GitHub makes them, so links to sections agree
const slug = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\- ]+/g, "")
    .replace(/ /g, "-");

// A path inside the repo, from one relative to a doc's file.
function resolve(from, href) {
  const parts = from.split("/").slice(0, -1);
  for (const p of href.split("/")) {
    if (p === "..") parts.pop();
    else if (p !== "." && p !== "") parts.push(p);
  }
  return parts.join("/") + (href.endsWith("/") ? "/" : "");
}

// What a link in a doc should point to, seen from this page.
function relink(doc, href) {
  if (/^([a-z]+:|#|\/\/)/i.test(href)) return href; // elsewhere, or this doc
  const [target, hash = ""] = href.split("#"),
    file = resolve(doc.file, target),
    other =
      byFile.get(file) || byFile.get(file.replace(/\/$/, "") + "/README.md");
  if (other) return `docs.html?doc=${other.id}${hash ? "#" + hash : ""}`;
  if (PAGES.test(file)) return file + (hash ? "#" + hash : "");
  const kind =
    file.endsWith("/") || !/\.[a-z0-9]+$/i.test(file) ? "tree" : "blob";
  return `${REPO}/${kind}/master/${file.replace(/\/$/, "")}${hash ? "#" + hash : ""}`;
}

let shown = null;
async function showDoc(id, { push = false, hash = location.hash } = {}) {
  const doc = ALL.find((d) => d.id === id) || ALL[0];
  if (push) history.pushState(null, "", `docs.html?doc=${doc.id}${hash || ""}`);
  for (const a of nav.querySelectorAll("a"))
    if (a.dataset.doc === doc.id) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  document.title = `${doc.title} — Omi docs`;
  if (shown !== doc.id) {
    shown = doc.id;
    article.innerHTML = `<p class="dnote">Loading…</p>`;
    let text;
    try {
      const res = await fetch(doc.file, { cache: "no-cache" });
      if (!res.ok) throw new Error(res.status);
      text = await res.text();
    } catch (e) {
      article.innerHTML = `<p class="dnote">Couldn't load ${doc.file}. <a href="${REPO}/blob/master/${doc.file}">Read it on GitHub</a>.</p>`;
      toc.innerHTML = "";
      return;
    }
    if (shown !== doc.id) return; // another doc was asked for meanwhile
    article.innerHTML = marked.parse(text);
    // ids for every heading, links that work from here, images from the doc's folder
    const seen = {};
    for (const h of article.querySelectorAll("h1, h2, h3, h4")) {
      let id = slug(h.textContent);
      if (seen[id] != null) id += "-" + ++seen[id];
      else seen[id] = 0;
      h.id = id;
    }
    for (const a of article.querySelectorAll("a[href]")) {
      const to = relink(doc, a.getAttribute("href"));
      a.setAttribute("href", to);
      if (/^https?:/.test(to)) {
        a.target = "_blank";
        a.rel = "noopener";
      }
    }
    for (const img of article.querySelectorAll("img[src]")) {
      const src = img.getAttribute("src");
      if (!/^([a-z]+:|\/\/)/i.test(src)) img.src = resolve(doc.file, src);
      img.loading = "lazy";
    }
    // GitHub's alerts (> [!NOTE]) as callouts
    for (const q of article.querySelectorAll("blockquote")) {
      const m = q.innerHTML.match(
        /^\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/,
      );
      if (m) {
        q.classList.add("alert", m[1].toLowerCase());
        q.innerHTML = q.innerHTML.replace(
          m[0],
          `<p><b>${m[1][0] + m[1].slice(1).toLowerCase()}</b> `,
        );
      }
    }
    // the doc's sections, for the side
    const hs = [...article.querySelectorAll("h2")];
    toc.innerHTML = hs.length
      ? `<h2>On this page</h2>` +
        hs.map((h) => `<a href="#${h.id}">${h.textContent}</a>`).join("")
      : "";
    toc.hidden = !hs.length;
    // the doc's source, to edit it
    article.insertAdjacentHTML(
      "beforeend",
      `<p class="dsource"><a href="${REPO}/blob/master/${doc.file}" target="_blank" rel="noopener">${doc.file} on GitHub</a></p>`,
    );
  }
  // to the section asked for, or the top
  const target =
    hash && document.getElementById(decodeURIComponent(hash.slice(1)));
  if (target) target.scrollIntoView();
  else $d("docs").scrollTop = 0;
}

// Following a link to another doc opens it here, without a reload.
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[href]");
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || !url.pathname.endsWith("/docs.html"))
    return;
  const id = url.searchParams.get("doc") || ALL[0].id;
  if (id === shown && url.hash) return; // a section of this doc: the browser does it
  e.preventDefault();
  showDoc(id, { push: true, hash: url.hash });
});
addEventListener("popstate", () =>
  showDoc(new URLSearchParams(location.search).get("doc")),
);
showDoc(new URLSearchParams(location.search).get("doc"));
