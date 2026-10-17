#!/usr/bin/env python3
"""Omi in a desktop window, with the Python player (player/python) and Tk:
nothing but the standard library (Python 3.9+, Tk 8.6+).

    python3 examples/python/omi_window.py              Omi, live
    python3 examples/python/omi_window.py --follow     the shared Omi
        (start service/omi-service.js, change it with service/omictl.js:
        every app showing it moves together)

The eyes follow the mouse, a click on Omi or Space plays a reaction, ← →
step through the modes, c changes the color, b turns whole-body motion off
and on, t starts or stops a tour of every mode, q or Esc quits.

    --fg '#9ece6a'   Omi's color; default: the Omarchy theme's accent
    --bg '#1a1b26'   the window's; default: the Omarchy theme's background

Tk can't fill a rectangle part-way transparent, so a faded rect is filled
with Omi's color mixed into the background: the same thing on a plain
background, which this is.
"""

import argparse
import json
import os
import queue
import re
import socket
import sys
import tempfile
import threading
import time
import tkinter as tk
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
# the player, straight from the repo; in your app, `pip install` it instead
sys.path.insert(0, str(ROOT / "player" / "python"))
from omi import Pack, Player  # noqa: E402

# ------------------------------------------------------------------ colors
THEME = Path.home() / ".local/state/omarchy/current/theme/colors.toml"
SWATCHES = [None, "#7aa2f7", "#9ece6a", "#f7768e", "#e0af68", "#bb9af7"]


def themed(key):
    """A color from the Omarchy theme, if this is Omarchy."""
    try:
        m = re.search(
            rf'^\s*{key}\s*=\s*"(#[0-9a-fA-F]{{6}})"', THEME.read_text(), re.M
        )
        return m.group(1) if m else None
    except OSError:
        return None


def mix(fg, bg, a):
    """fg over bg at opacity a, as #rrggbb."""
    f = [int(fg[i : i + 2], 16) for i in (1, 3, 5)]
    b = [int(bg[i : i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(y + (x - y) * a):02x}" for x, y in zip(f, b))


def readable(bg):
    """Text that reads on bg: light on dark, dark on light."""
    r, g, b = (int(bg[i : i + 2], 16) for i in (1, 3, 5))
    return "#c0caf5" if r * 0.3 + g * 0.59 + b * 0.11 < 128 else "#1f2335"


# ------------------------------------------------------------------ the window
class OmiWindow:
    # room around the pack's view, in grid units, for props that go past it
    # (the z's, the confetti, the download arrow)
    BLEED = 90
    TEXT = 96  # pixels under Omi for its name, what it's doing and the keys

    def __init__(self, root, pack, fg, bg, follow):
        self.root, self.pack = root, pack
        self.fg_default, self.bg = fg, bg
        self.text = readable(bg)
        self.swatch = 0
        self.fg = fg
        self.following = follow
        self.error = None
        self.omi = Player(pack, body_motion=True)
        self.reactions = [m for m in pack.mode_ids if pack.mode(m).kind == "reaction"]
        self.picks = [m for m in pack.mode_ids if m != "logo"]
        self.base = "idle"  # the mode picked
        self.reaction_until = 0.0
        self.pokes = 0
        self.touring = False
        self.tour_next = 0.0
        self.rest_at = 0.0

        root.title("Omi")
        root.configure(bg=bg)
        root.minsize(260, 320)
        self.canvas = tk.Canvas(root, bg=bg, highlightthickness=0, width=520, height=620)
        self.canvas.pack(fill="both", expand=True)
        self.items = []  # rectangles, reused frame to frame
        self.name = self.canvas.create_text(0, 0, fill=self.fg, font=("TkFixedFont", 16, "bold"))
        self.label = self.canvas.create_text(0, 0, fill=self.text, font=("TkFixedFont", 11))
        self.keys = self.canvas.create_text(
            0, 0, fill=mix(self.text, bg, 0.6), font=("TkFixedFont", 10),
            text="following the shared Omi · c color · q quit" if follow
            else "← → modes · space react · c color · b bounce · t tour · q quit",
        )

        root.bind("<Motion>", self.on_motion)
        root.bind("<Leave>", lambda e: self.omi.look(0, 0))
        self.canvas.bind("<Button-1>", self.on_click)
        root.bind("<Key>", self.on_key)

        self.states = queue.Queue()
        if follow:
            threading.Thread(target=self.follow, daemon=True).start()
        else:
            # the plain logo first, then Omi comes to life
            root.after(600, lambda: self.show(self.base))
        self.tick()

    # ---------------------------------------------------- what Omi is doing
    def show(self, mode):
        self.omi.set(mode)
        self.root.title(f"Omi · {self.pack.mode(mode).name}")

    def pick(self, mode):
        self.base = mode
        self.reaction_until = 0
        self.show(mode)

    def step(self, by):
        i = self.picks.index(self.base) if self.base in self.picks else 0
        self.pick(self.picks[(i + by) % len(self.picks)])

    def poke(self):
        """The reactions in turn, each for its hold after its morph lands."""
        if self.following or not self.reactions:
            return
        mode = self.reactions[self.pokes % len(self.reactions)]
        self.pokes += 1
        self.show(mode)
        self.reaction_until = time.time() + self.omi.hold(mode) + self.pack.morph.duration + self.pack.morph.stagger

    # ---------------------------------------------------- input
    def on_motion(self, e):
        cx, cy, side = self.stage()
        reach = max(side * 1.2, 200)  # full tilt this far from Omi's center
        dx, dy = (e.x - cx) / reach, (e.y - cy) / reach
        self.omi.look(max(-1, min(1, dx)), max(-1, min(1, dy)))
        self.rest_at = time.time() + 2.5

    def on_click(self, e):
        cx, cy, side = self.stage()
        if abs(e.x - cx) < side / 2 and abs(e.y - cy) < side / 2:
            self.poke()

    def on_key(self, e):
        k = e.keysym
        if k in ("q", "Escape"):
            self.root.destroy()
        elif k == "c":
            self.swatch = (self.swatch + 1) % len(SWATCHES)
            self.fg = SWATCHES[self.swatch] or self.fg_default
        elif self.following:
            return
        elif k == "Right":
            self.touring = False
            self.step(1)
        elif k == "Left":
            self.touring = False
            self.step(-1)
        elif k in ("space", "Return"):
            self.poke()
        elif k == "b":
            self.omi.body_motion = not self.omi.body_motion
        elif k == "t":
            self.touring = not self.touring
            self.tour_next = 0

    # ---------------------------------------------------- the shared Omi
    def follow(self):
        """Read the service's states (one JSON object a line) on a thread;
        the window applies them on its own thread, in tick()."""
        path = os.environ.get("OMI_SOCKET") or (
            os.path.join(os.environ["XDG_RUNTIME_DIR"], "omi.sock")
            if os.environ.get("XDG_RUNTIME_DIR")
            else os.path.join(tempfile.gettempdir(), f"omi-{os.getuid()}.sock")
        )
        try:
            s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            s.connect(path)
            s.sendall(b'{"type":"hello","name":"omi-window.py"}\n')
            for line in s.makefile("r", encoding="utf-8"):
                msg = json.loads(line)
                if msg.get("type") == "state":
                    self.states.put(msg)
        except OSError as e:
            self.states.put({"type": "error", "message": f"Can't reach the Omi service ({e})."})

    # ---------------------------------------------------- drawing
    def stage(self):
        """Omi's center and the side of its square, in window pixels."""
        w, h = self.canvas.winfo_width(), self.canvas.winfo_height()
        side = max(40, min(w - 24, h - self.TEXT - 24))
        return w / 2, (h - self.TEXT) / 2 + 6, side

    def tick(self):
        now = time.time()
        while not self.states.empty():
            st = self.states.get()
            if st["type"] == "error":
                self.error = st["message"]
            elif self.pack.has(st["mode"]):
                # the change as it happened at `since`: every app shows the
                # same frame
                self.omi.set(st["mode"], instant=st.get("instant", False), since=st["since"])
                self.root.title(f"Omi · {self.pack.mode(st['mode']).name}")
        if not self.following:
            if self.reaction_until and now >= self.reaction_until:
                self.reaction_until = 0
                self.show(self.base)
            elif self.touring and not self.reaction_until and self.omi.settled:
                if not self.tour_next:
                    self.tour_next = now + max(2.5, self.omi.loop_seconds(self.omi.mode))
                elif now >= self.tour_next:
                    self.tour_next = 0
                    self.step(1)
        if self.rest_at and now >= self.rest_at:
            self.rest_at = 0
            self.omi.look(0, 0)

        self.omi.frame(now * 1000)
        self.draw()
        self.root.after(16, self.tick)

    def draw(self):
        c, pack = self.canvas, self.pack
        cx, cy, side = self.stage()
        vx, vy, vw, vh = pack.view
        # crisp: one logo cell a whole number of pixels (see "Drawing Omi
        # crisp" in the pack's README), with the view and its bleed inside
        s = max(1, int(side / (vw + 2 * self.BLEED) * pack.grid)) / pack.grid
        ox, oy = cx - (vx + vw / 2) * s, cy - (vy + vh / 2) * s
        rects = [r for r in self.omi.rects() if r.opacity > 0.001]
        while len(self.items) < len(rects):
            self.items.append(c.create_rectangle(0, 0, 0, 0, width=0))
        for item, r in zip(self.items, rects):
            # snap the edges, not the size: neighbours meet exactly
            x0, y0 = round(r.x * s + ox), round(r.y * s + oy)
            x1, y1 = round((r.x + r.w) * s + ox), round((r.y + r.h) * s + oy)
            color = self.fg if r.opacity >= 0.999 else mix(self.fg, self.bg, min(1, r.opacity))
            c.coords(item, x0, y0, x1, y1)
            c.itemconfigure(item, fill=color, state="normal")
        for item in self.items[len(rects):]:
            c.itemconfigure(item, state="hidden")
        # text under Omi
        h = c.winfo_height()
        mode = pack.mode(self.omi.mode)
        c.coords(self.name, cx, h - self.TEXT + 24)
        c.itemconfigure(self.name, text=mode.name, fill=self.fg)
        c.coords(self.label, cx, h - self.TEXT + 50)
        c.itemconfigure(self.label, text=self.error or self.omi.label(self.omi.mode))
        c.coords(self.keys, cx, h - 20)
        for t in (self.name, self.label, self.keys):
            c.tag_raise(t)


def main():
    ap = argparse.ArgumentParser(description="Omi in a desktop window, with the Python player.")
    ap.add_argument("--follow", action="store_true", help="show the shared Omi")
    ap.add_argument("--fg", help="Omi's color, #rrggbb")
    ap.add_argument("--bg", help="the background, #rrggbb")
    ap.add_argument("--pack", default=str(ROOT / "pack" / "omi.json"))
    a = ap.parse_args()
    hexok = lambda v: v if v and re.fullmatch(r"#[0-9a-fA-F]{6}", v) else None
    fg = hexok(a.fg) or themed("accent") or "#7aa2f7"
    bg = hexok(a.bg) or themed("background") or "#1a1b26"
    if tk.TkVersion < 8.6:
        # macOS's own /usr/bin/python3 has Tk 8.5, which locks up here
        sys.exit(
            f"omi_window.py needs Tk 8.6 or later; this Python has {tk.TkVersion}. "
            "On macOS, use a Python from python.org, Homebrew or uv."
        )
    root = tk.Tk()
    OmiWindow(root, Pack.load(a.pack), fg, bg, a.follow)
    root.mainloop()


if __name__ == "__main__":
    main()
