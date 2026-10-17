# Using Omi in your app

Each example uses only the published kit in [`../kit`](../kit): `omi.json`
(the data) and `omi.js` (the reference player). Copy those two files into your
project and start from the example closest to your environment.

| Example                         | Environment                                                      | How it draws                                                                                                                              |
| ------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [omarchy](omarchy/)             | Omarchy shell plugins (Quickshell)                               | The player runs in QML's JavaScript engine; `Rectangle`s snapped to device pixels draw its rects, in the theme's accent                   |
| [web](web/index.html)           | Web pages, Electron                                              | The player draws on a `<canvas>` by itself                                                                                                |
| [qml](qml/Omi.qml)              | Qt Quick apps (Qt 6.4+)                                          | The same item as the Omarchy one (Rectangles snapped to device pixels, `even`, `look`, `react()`), reading the kit with XMLHttpRequest    |
| [terminal](terminal/omi-tty.js) | Any terminal (Node)                                              | Rects become half-block characters, in the Omarchy theme's accent or the terminal's own colors                                            |
| [bash](bash/omi.sh)             | Any terminal, with only bash, jq and awk                         | Its own player in awk ([omi.awk](bash/omi.awk)), drawn the same way; [omi.bashrc](bash/omi.bashrc) makes the shared Omi follow your shell |
| [python](python/omi_window.py)  | Desktop apps in Python (Tk, standard library only)               | The Python player ([`player/python`](../player/python)); rects become Tk canvas rectangles, faded ones mixed into the background          |
| [rust](rust/src/main.rs)        | Desktop apps in Rust ([minifb](https://crates.io/crates/minifb)) | The Rust player ([`player/rust`](../player/rust)); rects are filled pixel by pixel into a buffer the window shows                         |

The examples are showcases too. In each, Omi enters as the plain logo and
comes to life, its eyes follow the pointer, a click or Space plays a
reaction, and ← → step through the modes.

- **Web:** Omi follows what you do on the page. It types along in a chat
  box, thinks when you send, and answers with a reaction that fits what you
  said. It shows which way a download or an upload goes, and is sad when
  you cancel one. It reacts to what the browser tells the page: the tab out
  of sight, you away, no network, a low battery, a copy. Small Omis in
  buttons say how their work went. Swatches and a color picker show it
  takes any one color, and the page has a light and a dark theme and a
  snippet to start from. With reduced motion on, Omi holds still.
- **Qt:** the swatches show it takes any one color.
- **Terminal:** it also runs a command with Omi beside it.
- **Python** and **Rust:** desktop windows with the same keys as the
  terminal (`c` color, `b` whole-body motion, `t` a tour). The Python one
  follows the shared Omi with `--follow`.

## The pattern

Every example does the same three things, and so would a player in another
language:

1. **Load the kit** and create a player: `new Omi(canvas, kit, options)`.
   Without a browser canvas, pass `null` and a `color`.
2. **Tell it what Omi is doing**: `omi.set("thinking")`. It morphs there from
   wherever Omi is, even mid-morph. `{ instant: true }` jumps instead.
3. **Draw every frame.** In a browser the player does this itself. Anywhere
   else, call `omi.frame(Date.now())` once per display frame, then fill the
   rectangles in `omi.rects()`: each has `x, y, w, h` in kit units and an
   opacity `o`. Map the kit's `view` square to your drawing area.

`omi.on("settled", fn)` tells you when a morph has landed.

To show the same Omi as every other app on the machine, follow the shared
state instead of calling `set` yourself: see the
[Omi state protocol](../protocol/README.md). The terminal example does it with
`--follow`.

## Running them

- **Omarchy:** `examples/omarchy/install.sh` installs the example as the
  shell plugin `omi.example`, with the kit copied in. Then
  `omarchy-shell shell summon omi.example` opens it (← → step through the
  modes), and `omarchy-shell shell call omi.example set thinking` or
  `… react success` drives it from a script. `install.sh --remove` takes it
  out. [docs/omarchy.md](../docs/omarchy.md) covers building Omi into your
  own plugin.
- **Web:** `npm run dev` in the repo and open
  http://localhost:8000/examples/web/.
- **QML:** `QML_XHR_ALLOW_FILE_READ=1 qml examples/qml/main.qml`. The
  environment variable lets QML read the kit from disk; in an app, ship the
  kit in your resources instead. Inside the Omarchy shell, use the Omarchy
  example: it reads the kit with Quickshell's `FileView`, which needs no
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

- **Bash:** `examples/bash/omi.sh` is Omi in a terminal with no Node: a
  player written in awk (`omi.awk`) that reads the kit through jq. Live,
  it tours the modes, its eyes follow the mouse, a click or Space plays a
  reaction, ← → step through the modes, `b` turns on whole-body motion, `t`
  stops or starts the tour, `q` quits. `--once warning` prints a still and
  `--say "Hello"` puts text beside it; `--size`, `--fg`, `--bg` and
  `--bounce` are as in the Node one. It plays every animation exactly
  (`npm run check:bash` holds it to the conformance data) but pairs
  pieces in a morph more simply than the reference player, which the kit
  allows. Bash 4 or later keeps exact time; macOS's bash 3.2 counts each
  frame as 1/30 s.

  `source examples/bash/omi.bashrc` in your `~/.bashrc` makes the shared
  Omi follow your shell: a command that runs over 2 seconds makes it think,
  and when it ends Omi is happy or sad for a moment. `omi party` sets it by
  hand, and `OMI_GREET="Hi"` greets you with Omi as the shell starts. It
  needs the Omi service and socat or nc.

- **Python:** `python3 examples/python/omi_window.py` (`--follow` for the
  shared Omi, `--fg` / `--bg` for colors). It needs Python 3.9+ with Tk
  8.6 or later: on Linux that's the `tk` package, and on macOS a Python
  from python.org, Homebrew or uv (the system's `/usr/bin/python3` has Tk
  8.5, which locks up). It imports the player from `player/python`; in an
  app, install that package instead.
- **Rust:** `cargo run --release` in `examples/rust`. The crate depends on
  the player in `player/rust` by path, and on `minifb` for the window.

## Another language

A player is small: work out a mode's rects at time t, plan and play morphs,
fill rects. [`../kit/README.md`](../kit/README.md) describes every rule, and
[`../kit/conformance.json`](../kit/conformance.json) lists what a correct
player draws; [`../tools/check-player.js`](../tools/check-player.js) shows how
to check yours against it. [`../player/rust`](../player/rust) and
[`../player/python`](../player/python) are two written that way: a crate
and a package to use from a Rust or a Python app, and proof that the README
is enough. [`../tools/check-morphs.js`](../tools/check-morphs.js) holds both
to the reference player on every morph there is, and can do the same for
yours: it writes the reference player's frames to a file for your player to
replay.
