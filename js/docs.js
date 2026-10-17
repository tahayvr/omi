/* ---------- the docs page (docs.html) ----------
   The repo's own markdown, read as it is and drawn here with marked
   (js/vendor/marked.js): edit a .md file and this page shows the change.
   What the page lists is docs/index.json, made from the folders in docs/
   by tools/docs-index.js: a numbered folder is a section, a numbered file
   in it a page. docs.html?doc=<id> opens one; #<heading> goes to a section
   of it.

   Links in a doc are made to work from this page: one to another doc opens
   it here, one to a page of the site goes there, and one to anything else
   in the repo (code, a folder) opens it on GitHub. Images are the site's
   own files, found from the doc's folder. */
const REPO = "https://github.com/tahayvr/omi";

// The sections and their pages, once docs/index.json is in: each page's
// id (its address), title, file in docs/ and source (the file shown,
// which is the page's own file unless it names one that ships elsewhere).
let DOCS = [],
  ALL = [],
  bySource = new Map();
// the site's own pages: a link to one stays on the site
const PAGES = /^(index|jig|docs)\.html$|^examples\/web\/(index\.html)?$/;

const $d = (id) => document.getElementById(id);
const nav = $d("dnav"),
  article = $d("doc"),
  toc = $d("toc");

// the docs, a link each, under their section
function listDocs() {
  nav.innerHTML = DOCS.map(
    (k) =>
      `<div class="dkind"><h2>${k.section}</h2>${k.pages
        .map(
          (d) =>
            `<a href="docs.html?doc=${d.id}" data-doc="${d.id}">${d.title}</a>`,
        )
        .join("")}</div>`,
  ).join("");
}

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
    file = resolve(doc.source, target),
    other =
      bySource.get(file) ||
      bySource.get(file.replace(/\/$/, "") + "/README.md");
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
      const res = await fetch(doc.source, { cache: "no-cache" });
      if (!res.ok) throw new Error(res.status);
      text = await res.text();
    } catch (e) {
      article.innerHTML = `<p class="dnote">Couldn't load ${doc.source}. <a href="${REPO}/blob/master/${doc.source}">Read it on GitHub</a>.</p>`;
      toc.innerHTML = "";
      return;
    }
    if (shown !== doc.id) return; // another doc was asked for meanwhile
    article.innerHTML = marked.parse(
      text.replace(/^<!--\s*docs:[^>]*-->\s*/, ""),
    );
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
      if (!/^([a-z]+:|\/\/)/i.test(src)) img.src = resolve(doc.source, src);
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
      `<p class="dsource"><a href="${REPO}/blob/master/${doc.source}" target="_blank" rel="noopener">${doc.source} on GitHub</a></p>`,
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
fetch("docs/index.json", { cache: "no-cache" })
  .then((r) => r.json())
  .then((index) => {
    DOCS = index;
    ALL = index.flatMap((k) => k.pages);
    // a link to a page's file, or to the file it shows, opens the page
    for (const d of ALL) bySource.set(d.source, d).set(d.file, d);
    listDocs();
    showDoc(new URLSearchParams(location.search).get("doc"));
  })
  .catch(() => {
    article.innerHTML = `<p class="dnote">Couldn't load the list of docs (docs/index.json).</p>`;
  });
