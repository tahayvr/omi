# Using Omi in your app

Each example uses only the published pack in [`../pack`](../pack): `omi.json`
(the data) and `omi.js` (the reference player). Copy those two files into your
project and start from the example closest to your environment.

| Example                         | Environment                        | How it draws                                                                                                                            |
| ------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [omarchy](omarchy/)             | Omarchy shell plugins (Quickshell) | The player runs in QML's JavaScript engine; `Rectangle`s snapped to device pixels draw its rects, in the theme's accent                 |
| [web](web/index.html)           | Web pages, Electron                | The player draws on a `<canvas>` by itself                                                                                              |
| [qml](qml/Omi.qml)              | Qt Quick apps (Qt 6.4+)            | The same item as the Omarchy one (Rectangles snapped to device pixels, `even`, `look`, `react()`), reading the pack with XMLHttpRequest |
| [terminal](terminal/omi-tty.js) | Any terminal (Node)                | Rects become half-block characters, in the Omarchy theme's accent or the terminal's own colors                                          |

The web and Qt examples are small showcases: Omi enters as the plain logo
and comes to life, its eyes follow the pointer, a click or Space plays a
reaction, ← → step through the modes, and the swatches show it takes any one
color. The web page follows the system's light or dark setting and, with
reduced motion on, holds still. The terminal one is a showcase too, and
runs a command with Omi beside it.

## The pattern

Every example does the same three things, and so would a player in another
language:

1. **Load the pack** and create a player: `new Omi(canvas, pack, options)`.
   Without a browser canvas, pass `null` and a `color`.
2. **Tell it what Omi is doing**: `omi.set("thinking")`. It morphs there from
   wherever Omi is, even mid-morph. `{ instant: true }` jumps instead.
3. **Draw every frame.** In a browser the player does this itself. Anywhere
   else, call `omi.frame(Date.now())` once per display frame, then fill the
   rectangles in `omi.rects()`: each has `x, y, w, h` in pack units and an
   opacity `o`. Map the pack's `view` square to your drawing area.

`omi.on("settled", fn)` tells you when a morph has landed.

To show the same Omi as every other app on the machine, follow the shared
state instead of calling `set` yourself: see the
[Omi state protocol](../protocol/README.md). The terminal example does it with
`--follow`.

## Running them

- **Omarchy:** `examples/omarchy/install.sh` installs the example as the
  shell plugin `omi.example`, with the pack copied in. Then
  `omarchy-shell shell summon omi.example` opens it (← → step through the
  modes), and `omarchy-shell shell call omi.example set thinking` or
  `… react success` drives it from a script. `install.sh --remove` takes it
  out. [docs/omarchy.md](../docs/omarchy.md) covers building Omi into your
  own plugin.
- **Web:** `npm run dev` in the repo and open
  http://localhost:8000/examples/web/.
- **QML:** `QML_XHR_ALLOW_FILE_READ=1 qml examples/qml/main.qml`. The
  environment variable lets QML read the pack from disk; in an app, ship the
  pack in your resources instead. Inside the Omarchy shell, use the Omarchy
  example: it reads the pack with Quickshell's `FileView`, which needs no
  environment variable.
- **Terminal:** `node examples/terminal/omi-tty.js` shows Omi live: it
  tours every mode, its eyes follow the mouse, a click or Space plays a
  reaction, ← → step through the modes (↑ ↓ a group at a time), `c` changes
  the color, `b` turns on whole-body motion, `t` stops or starts the tour,
  and left alone off the tour it falls asleep.
  `node examples/terminal/omi-tty.js idle thinking` keeps to the modes you
  name.
  - `node examples/terminal/omi-tty.js -- npm test` runs a command with Omi
    beside it, thinking while it runs (`--busy working` picks another mode)
    with the command's last lines next to it, then happy or sad. The block
    stays in the scrollback, a failed command's whole output is printed
    under it, and the exit code is the command's.
  - `--once warning` prints one still, and `--say "Hello"` puts text beside
    it: a greeting for a shell's start.
  - `--follow` shows the shared Omi (start `node service/omi-service.js`
    first, and change it with `node service/omictl.js set thinking`).

  It sizes Omi to a multiple of 22 pixels so it stays crisp, and refits when
  the window is resized. It draws in the Omarchy theme's accent, and
  recolors when the theme changes; outside Omarchy, in the terminal's own
  colors, which it asks the terminal for so faded pixels blend into the
  real background. Empty pixels show the terminal's background (no box),
  and only rows that change are redrawn. `--look 0,-1` turns the eyes,
  `--fg` / `--bg` pick colors. Whole-body motion is off at first, since at
  terminal sizes it stutters a pixel at a time.

## Another language

A player is small: work out a mode's rects at time t, plan and play morphs,
fill rects. [`../pack/README.md`](../pack/README.md) describes every rule, and
[`../pack/conformance.json`](../pack/conformance.json) lists what a correct
player draws; [`../tools/check-player.js`](../tools/check-player.js) shows how
to check yours against it. [`../player/rust`](../player/rust) and
[`../player/python`](../player/python) are two written that way: a crate
and a package to use from a Rust or a Python app, and proof that the README
is enough. [`../tools/check-morphs.js`](../tools/check-morphs.js) holds both
to the reference player on every morph there is, and can do the same for
yours: it writes the reference player's frames to a file for your player to
replay.
