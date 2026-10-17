# Designing a mode

How a mode goes from an idea to the kit that every app draws. The jig
(`jig.html`) is where Omi is designed, and the kit is what comes out of
it: apps never read the jig's code.

## The rules Omi is drawn by

- **Omi is the Omarchy logo.** The frame is the logo's own rectangles
  (`LOGO` in `js/geometry.js`), and a mode adds a face inside it, props
  around it, or bends the frame itself. Nothing is ever drawn that isn't a
  filled, axis-aligned rectangle.
- **One color.** Omi takes the host's accent, whatever it is. Meaning comes
  from shape and motion, never from a second color. Opacity is allowed
  (dim z's, fading dots), and a host that can't blend treats 0.5 or more as
  on.
- **The grid.** The logo is a 300 × 300 square of 20-unit cells. Eyes are
  one cell wide and two tall at rest, at (100, 110) and (180, 110). Keep
  pieces on the grid where you can: cells that sit on the grid are what
  the morph pairs between modes, so a mode drawn on it morphs cleanly. The
  frame always sits on the cells, and every piece on whole units.
- **No mouths.** Omi reads through its eyes, brows and props. The one
  mouth that existed (sudo's) was removed; laughing shapes the frame
  instead. A new mode with a mouth is a design decision to argue
  for, not a default.
- **Stays inside the view.** The kit's `view` is the logo with 70 units of
  room on every side; props live there, and may drift off its edge (z's,
  confetti). The frame and the face never leave it. The eyes start inside
  the inner square, and stay there when they look around (`gaze.inside`).
- **Never guilt the user.** Modes exist for what the system is doing and
  for what just happened, not for scolding. Sad and crying are for things
  that were lost, never for a cancel, a skip or a wrong key.
- **Calm by default.** A loop is something the eye can rest on: a slow
  bob, a blink every few seconds, dots in sequence. Reactions can be quick,
  states must not be. Whole-body motion (bobs, hops, shakes) is a
  separate layer that small hosts turn off, so a mode must still read with
  it off.
- **At rest is frame 0.** A mode's still, its morph landing pose and the
  first frame of its loops are one and the same, so a loop whose natural
  start isn't a good still is rotated to one that is (`START` in
  `js/motion.js`).

`node tools/check-kit.js` (part of `npm run check`) holds the kit to the
ones a program can check: the grid, no mouths, the view and the inner
square, along with the kit's own shape (`kit/omi.schema.json`: every mode
has a kind and a label, every reaction a hold) and that it hangs together
(no animation or role named that isn't there). A mode that breaks a rule on
purpose is argued for in that file, in `ARGUED`, with the reason in a line:
`peek`'s eyes are below the logo.

## Where things are

| What                                                 | Where                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| The modes: faces, props, which loop each piece plays | `js/designs.js` (`DESIGNS`, grouped; faces in `F`, props and eggs beside it)          |
| The pieces' building blocks and the logo             | `js/geometry.js` (`R`, `LOGO`, `F`, `ARROW`, `QMARK`…)                                |
| Frame effects: bars that flow, grow or tile          | `js/frames.js`                                                                        |
| Every animation, as keyframes                        | `js/motion.js` (`ANIM`)                                                               |
| What a mode is for: kind, hold, family, easter       | `js/kit.js` (`REACTIONS`, `FAMILIES`, `EASTER`)                                       |
| What a screen reader says for each mode              | `js/kit.js` (`LABELS`)                                                                |
| The kit's shape, as a JSON Schema                    | `js/kit.js` (`KIT_SCHEMA`), written to `kit/omi.schema.json`                          |
| The kit and its spec                                 | `js/kit.js` (`buildKit`, `KIT_README`), written to `kit/` by `tools/build-kit.js`     |
| The gallery                                          | `docs/2-reference/2-every-mode.md` and `docs/modes/`, written by `tools/modes-doc.js` |

## Making one

1. **Start from an idea with a sketch.** Say what the mode is for (a state
   or a reaction, and when an app would show it), which pieces it adds or
   changes, and how they move.
2. **Draw the pieces.** In `js/designs.js`, add an entry to `DESIGNS` in
   the right group: `{ id, name, face, mood }`, where `face` is a list of
   rects (`R(x, y, w, h, anim)`, role set with `as("extra", …)` or the
   `role` field; eyes are `"eye"`, brows `"brow"`, props `"extra"`), and
   `mood` a whole-body animation or `""`. Replace the frame with `logo`
   only when the frame itself is part of the expression. Reuse the faces
   in `F` and the shapes in `js/geometry.js` where you can: Omi's
   consistency comes from the same eye in every mode.
3. **Give it motion.** Pick an existing animation by name, or add one to
   `ANIM` in `js/motion.js`: a duration, an ease and keyframes of `tx`,
   `ty`, `sx`, `sy`, `op`. A piece can lag its loop with `dl` to stagger a
   row. A pause between passes (the wait between blinks) goes in `rest`,
   not in the keys: the loop holds still for it, at its pose at rest,
   before every pass, and apps can scale it (`rest` in the players). A row
   of pieces in step shares the one rest, so make `dur` cover the whole
   row. Check it at rest: if frame 0 isn't the pose you want to morph into,
   add the loop to `START` with how far in to begin.
4. **Say what it's for.** In `js/kit.js`, add a reaction's hold to
   `REACTIONS`, or leave it a state; put it in a family in `FAMILIES` if it
   means the same thing as another mode; mark a joke in `EASTER`. Give it
   a label in `LABELS`: what a screen reader says for it ("Omi is
   thinking"), the same words as any mode it is a variation of. The kit
   won't build without one.
5. **Look at it in the jig.** `npm run dev` and open
   http://localhost:8000/jig.html: every design looping, each one bigger in
   its single view. The home page (http://localhost:8000) plays every mode in
   its Modes section, and its ASCII section shows Omi at half-block size.
   Check it at the small end too: 44 device pixels across is where props
   must still read.
6. **Build the kit.** `node tools/build-kit.js` writes `kit/omi.json`,
   `kit/README.md`, `kit/conformance.json` and `kit/omi.js` (a copy of
   `player/omi.js`, so the kit ships with its player: edit the source,
   never the copy). Then `node tools/modes-doc.js` for the gallery.
   `npm run build` does both.
7. **Run every check.** `npm run check`: that the kit and the gallery
   are built from what's committed, that the kit keeps the rules above
   (`tools/check-kit.js`), the reference player and the service.
   `npm run check:site`: the jig itself, in Chrome (see below).
   `npm run check:rust` and `npm run check:python`: the other two
   players. `npm run check:morphs`: both of them against the reference
   player on every morph. `npm run check:qt` and `npm run check:bash`:
   the Qt item and the bash player, from the examples.
   In an Omarchy session, `npm run check:quickshell`: the player inside
   the shell itself. A new mode is only data,
   so all of them should pass unchanged; if a player fails, the mode uses
   something the spec doesn't cover, and the spec needs the rule before
   the kit does.
8. **Commit `kit/` and `docs/` with the source.** Apps copy the kit, so
   a mode that isn't in `kit/` doesn't exist to them. `pnpm fmt` first, so the code reads the way
   the rest does, and `pnpm lint` (both need `pnpm install` once).

## What the jig shows is what apps get

The site (the home page and the jig) doesn't have a way of its own to draw
Omi. Each page builds the kit from its sources as it loads and hands it to
the reference player, the same two things an app copies out of `kit/`:

- The home page's hero and Modes section are players on a canvas.
- Stills and video frames, and so every picture or video exported from the
  jig, are the player's rects (`playerRects` in `js/morph.js`).
- A mode looping in a tile, in the single view or in an exported animated
  SVG has to run without a script, so there the browser's CSS plays the
  animations (the end of `js/motion.js`). That is the one other reader of
  them.

`npm run check:site` holds this together. It opens the jig in Chrome
without a window with `?check` on the address, and the page (`js/check.js`)
checks that the kit it builds is the one in `kit/`, file for file, that the
player it runs is the kit's, and that every mode as CSS is, at several
moments, what the player draws. Open `http://localhost:8000/jig.html?check`
to see the same report on the page.

The site, https://tahayvr.github.io/omi/, is these pages, published on
every push to `master` by `.github/workflows/publish.yml`, and only when
`npm run check` passes. `tools/publish-site.js` puts it together, with the
commit on the address of every script and stylesheet, so a browser never
runs files of two builds together. The site check needs a browser, so it
isn't part of that: run `npm run check:site` before pushing a change to the
jig, and `node tools/check-site.js https://tahayvr.github.io/omi/`
(or `?check` on the jig's address) asks the same of what is live.

A change to the format itself (a new field a player must understand, a
rule that changes what a correct player draws) is a different thing from
a new mode: it needs the spec in `KIT_README` updated first, all three
players brought along, conformance rebuilt, and a `KIT_VERSION` bump when an
older player would misread the new kit.
