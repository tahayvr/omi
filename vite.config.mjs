/* The dev server for the site (index.html, and the design jig, jig.html)
   and the web example.

     npm run dev              http://localhost:8000, or the next free port

   Vite serves the repo as it is: nothing is bundled, and the site is still
   published as plain files (tools/publish-site.js). What it adds is the
   reload: change any file here and the page reloads by itself.

   Only the pages go through Vite, which adds its reload script to them.
   Every other file is sent exactly as it is on disk: the jig's scripts are
   plain scripts, not modules Vite knows, and the page checks that the
   player it runs is the one in pack/ byte for byte, which a source map
   added by Vite would break. */
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";

const IGNORED = ["**/_site/**", "**/player/rust/target/**"];

const TYPES = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".md": "text/plain; charset=utf-8",
  ".toml": "text/plain; charset=utf-8",
  ".qml": "text/plain; charset=utf-8",
};

// the repo's files, other than its pages, as they are on disk
function raw(root) {
  return (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    let url, file;
    try {
      url = new URL(req.url, "http://localhost");
      file = path.join(root, decodeURIComponent(url.pathname));
    } catch (e) {
      return next();
    }
    // pages, and Vite's own client in node_modules, are Vite's to send
    if (
      !file.startsWith(root + path.sep) ||
      file.startsWith(path.join(root, "node_modules") + path.sep) ||
      path.extname(file) === ".html"
    )
      return next();
    fs.stat(file, (err, stat) => {
      // a folder's page loads its files by relative paths, which need the slash
      if (!err && stat.isDirectory() && !url.pathname.endsWith("/")) {
        res.writeHead(301, { Location: url.pathname + "/" + url.search });
        return res.end();
      }
      if (err || !stat.isFile()) return next();
      res.writeHead(200, {
        "Content-Type":
          TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
        "Content-Length": stat.size,
        "Cache-Control": "no-store",
      });
      if (req.method === "HEAD") return res.end();
      fs.createReadStream(file).pipe(res);
    });
  };
}

export default defineConfig({
  appType: "mpa", // an address with nothing there is a 404, not the jig
  server: {
    host: "localhost",
    port: 8000,
    watch: { ignored: IGNORED },
  },
  plugins: [
    {
      name: "omi-dev",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use(raw(server.config.root));
        // none of these files are modules Vite knows, so it wouldn't reload for them
        const reload = () => server.ws.send({ type: "full-reload" });
        for (const event of ["add", "change", "unlink"])
          server.watcher.on(event, reload);
      },
      hotUpdate() {
        return []; // the page reloads for every change, above
      },
    },
  ],
});
