//! Omi in a desktop window, with the Rust player (`player/rust`): every
//! frame, the player's rects are filled pixel by pixel into a buffer that
//! `minifb` shows. No toolkit, no GPU: a picture of how little a host needs.
//!
//!     cargo run --release                     (in examples/rust)
//!     cargo run --release -- --fg '#9ece6a' --bg '#1a1b26'
//!
//! The eyes follow the mouse, a click on Omi or Space plays a reaction,
//! ← → step through the modes, c changes the color, b turns whole-body
//! motion off and on, t starts or stops a tour of every mode, q or Esc
//! quits. The title says what Omi is doing (the mode's label, what a screen
//! reader would say); the marks under Omi are the modes, the one showing in
//! Omi's color. Colors default to the Omarchy theme's accent and background.

use minifb::{Key, KeyRepeat, MouseButton, MouseMode, Window, WindowOptions};
use omi::{Kind, Kit, Player};
use std::time::Instant;

/// Room around the kit's view, in grid units, for props that go past it
/// (the z's, the confetti, the download arrow).
const BLEED: f64 = 90.0;
/// Pixels under Omi for the row of modes.
const STRIP: usize = 40;
/// The colors c steps through, after the theme's accent.
const SWATCHES: [u32; 5] = [0x7aa2f7, 0x9ece6a, 0xf7768e, 0xe0af68, 0xbb9af7];

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    let arg = |name: &str| {
        args.iter()
            .position(|a| a == name)
            .and_then(|i| args.get(i + 1))
            .and_then(|v| hex(v))
    };
    let accent = arg("--fg").or_else(|| themed("accent")).unwrap_or(0x7aa2f7);
    let bg = arg("--bg")
        .or_else(|| themed("background"))
        .unwrap_or(0x1a1b26);

    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../kit/omi.json");
    let kit = Kit::parse(&std::fs::read_to_string(path)?)?;
    let mut app = App::new(&kit, accent, bg);

    let mut window = Window::new(
        "Omi",
        520,
        600,
        WindowOptions {
            resize: true,
            ..WindowOptions::default()
        },
    )?;
    window.set_target_fps(60);
    let mut buffer: Vec<u32> = Vec::new();
    let mut was_down = false;

    while window.is_open() && !window.is_key_down(Key::Escape) {
        let (w, h) = window.get_size();
        let now = app.clock.elapsed().as_secs_f64();

        // input: keys, the pointer, a click
        for key in window.get_keys_pressed(KeyRepeat::No) {
            match key {
                Key::Q => return Ok(()),
                Key::Right => app.step(1),
                Key::Left => app.step(-1),
                Key::Space | Key::Enter => app.poke(now),
                Key::C => app.swatch = (app.swatch + 1) % (SWATCHES.len() + 1),
                Key::B => {
                    let on = !app.omi.body_motion();
                    app.omi.set_body_motion(on);
                }
                Key::T => {
                    app.touring = !app.touring;
                    app.tour_next = None;
                }
                _ => {}
            }
        }
        let stage = Stage::new(&kit, w, h);
        if let Some((mx, my)) = window.get_mouse_pos(MouseMode::Discard) {
            app.look_at(&stage, mx as f64, my as f64, now);
            let down = window.get_mouse_down(MouseButton::Left);
            if down && !was_down && stage.contains(mx as f64, my as f64) {
                app.poke(now);
            }
            was_down = down;
        } else {
            app.omi.look(0.0, 0.0);
        }

        app.update(now);
        app.omi.frame(now * 1000.0);

        buffer.resize(w * h, 0);
        app.draw(&mut buffer, w, h, &stage);
        window.set_title(&app.title());
        window.update_with_buffer(&buffer, w, h)?;
    }
    Ok(())
}

/// Where Omi goes in a window of w × h pixels: one logo cell a whole number
/// of pixels (see "Drawing Omi crisp" in the kit's README), with the view
/// and its bleed inside, centered above the strip of modes.
struct Stage {
    scale: f64,
    ox: f64,
    oy: f64,
    cx: f64,
    cy: f64,
    side: f64,
}

impl Stage {
    fn new(kit: &Kit, w: usize, h: usize) -> Stage {
        let [vx, vy, vw, vh] = kit.view;
        let side = (w.saturating_sub(16))
            .min(h.saturating_sub(STRIP + 16))
            .max(22) as f64;
        let cells = (side / (vw + 2.0 * BLEED) * kit.grid).floor().max(1.0);
        let scale = cells / kit.grid;
        let (cx, cy) = (w as f64 / 2.0, (h - STRIP.min(h)) as f64 / 2.0);
        Stage {
            scale,
            ox: cx - (vx + vw / 2.0) * scale,
            oy: cy - (vy + vh / 2.0) * scale,
            cx,
            cy,
            side: vw * scale,
        }
    }
    fn contains(&self, x: f64, y: f64) -> bool {
        (x - self.cx).abs() < self.side / 2.0 && (y - self.cy).abs() < self.side / 2.0
    }
}

struct App {
    omi: Player,
    names: Vec<(String, String, String)>, // id, name, group
    reactions: Vec<String>,
    base: String,
    reaction_until: Option<f64>,
    pokes: usize,
    touring: bool,
    tour_next: Option<f64>,
    look_until: Option<f64>,
    started: bool,
    clock: Instant,
    accent: u32,
    bg: u32,
    swatch: usize,
}

impl App {
    fn new(kit: &Kit, accent: u32, bg: u32) -> App {
        let omi = Player::new(kit);
        let names = kit
            .modes
            .iter()
            .filter(|m| m.id != "logo")
            .map(|m| {
                (
                    m.id.clone(),
                    m.name.clone().unwrap_or_else(|| m.id.clone()),
                    m.group.clone().unwrap_or_default(),
                )
            })
            .collect();
        let reactions = kit
            .modes
            .iter()
            .filter(|m| omi.kind(&m.id) == Kind::Reaction)
            .map(|m| m.id.clone())
            .collect();
        App {
            omi,
            names,
            reactions,
            base: "idle".into(),
            reaction_until: None,
            pokes: 0,
            touring: false,
            tour_next: None,
            look_until: None,
            started: false,
            clock: Instant::now(),
            accent,
            bg,
            swatch: 0,
        }
    }

    fn color(&self) -> u32 {
        match self.swatch {
            0 => self.accent,
            i => SWATCHES[i - 1],
        }
    }

    fn show(&mut self, id: &str) {
        let _ = self.omi.set(id);
    }

    fn step(&mut self, by: isize) {
        self.touring = false;
        self.pick(by);
    }

    fn pick(&mut self, by: isize) {
        let n = self.names.len() as isize;
        let i = self
            .names
            .iter()
            .position(|m| m.0 == self.base)
            .unwrap_or(0) as isize;
        self.base = self.names[((i + by) % n + n) as usize % n as usize]
            .0
            .clone();
        self.reaction_until = None;
        let base = self.base.clone();
        self.show(&base);
    }

    /// The reactions in turn, each for its hold after its morph lands.
    fn poke(&mut self, now: f64) {
        if self.reactions.is_empty() {
            return;
        }
        let id = self.reactions[self.pokes % self.reactions.len()].clone();
        self.pokes += 1;
        self.show(&id);
        self.reaction_until = Some(now + self.omi.hold(&id) + self.omi.morph_seconds());
    }

    fn look_at(&mut self, stage: &Stage, x: f64, y: f64, now: f64) {
        let reach = (stage.side * 1.2).max(200.0); // full tilt this far away
        let clamp = |v: f64| v.clamp(-1.0, 1.0);
        self.omi
            .look(clamp((x - stage.cx) / reach), clamp((y - stage.cy) / reach));
        self.look_until = Some(now + 2.5);
    }

    /// The plain logo first, then Omi comes to life; reactions end; the tour
    /// moves on once a mode has played its loop.
    fn update(&mut self, now: f64) {
        if !self.started && now > 0.6 {
            self.started = true;
            let base = self.base.clone();
            self.show(&base);
        }
        if self.reaction_until.is_some_and(|t| now >= t) {
            self.reaction_until = None;
            let base = self.base.clone();
            self.show(&base);
        } else if self.touring && self.reaction_until.is_none() && self.omi.settled() {
            match self.tour_next {
                None => self.tour_next = Some(now + self.omi.loop_seconds(&self.base).max(2.5)),
                Some(t) if now >= t => {
                    self.tour_next = None;
                    self.pick(1);
                }
                _ => {}
            }
        }
        if self.look_until.is_some_and(|t| now >= t) {
            self.look_until = None;
            self.omi.look(0.0, 0.0);
        }
    }

    fn title(&self) -> String {
        let id = self.omi.mode();
        let name = self
            .omi
            .kit()
            .mode(id)
            .and_then(|m| m.name.clone())
            .unwrap_or_else(|| id.to_string());
        format!("Omi · {name} — {}", self.omi.label(id))
    }

    fn draw(&self, buf: &mut [u32], w: usize, h: usize, st: &Stage) {
        buf.fill(self.bg);
        let fg = self.color();
        for r in self.omi.rects() {
            if r.opacity <= 0.001 {
                continue;
            }
            // snap the edges, not the size: neighbours meet exactly
            let x0 = (r.x * st.scale + st.ox).round();
            let y0 = (r.y * st.scale + st.oy).round();
            let x1 = ((r.x + r.w) * st.scale + st.ox).round();
            let y1 = ((r.y + r.h) * st.scale + st.oy).round();
            fill(buf, w, h, x0, y0, x1, y1, fg, r.opacity.min(1.0));
        }
        // the modes, a mark each and a gap between groups
        let (mark, gap) = (6.0, 3.0);
        let mut groups = 0;
        for i in 1..self.names.len() {
            if self.names[i].2 != self.names[i - 1].2 {
                groups += 1;
            }
        }
        let width = self.names.len() as f64 * (mark + gap) + groups as f64 * 8.0 - gap;
        let mut x = (w as f64 - width) / 2.0;
        let y = h as f64 - STRIP as f64 / 2.0 - mark / 2.0;
        let showing = self.omi.mode();
        for (i, (id, _, group)) in self.names.iter().enumerate() {
            if i > 0 && *group != self.names[i - 1].2 {
                x += 8.0;
            }
            let on = id == showing;
            let (c, a) = if on { (fg, 1.0) } else { (fg, 0.25) };
            fill(
                buf,
                w,
                h,
                x.round(),
                y.round(),
                (x + mark).round(),
                (y + mark).round(),
                c,
                a,
            );
            x += mark + gap;
        }
    }
}

/// Fills a rect of whole pixels with c at opacity a, over what's there.
#[allow(clippy::too_many_arguments)]
fn fill(buf: &mut [u32], w: usize, h: usize, x0: f64, y0: f64, x1: f64, y1: f64, c: u32, a: f64) {
    let clip = |v: f64, max: usize| v.max(0.0).min(max as f64) as usize;
    let (x0, x1, y0, y1) = (clip(x0, w), clip(x1, w), clip(y0, h), clip(y1, h));
    for y in y0..y1 {
        for p in &mut buf[y * w + x0..y * w + x1] {
            *p = if a >= 0.999 { c } else { blend(c, *p, a) };
        }
    }
}

fn blend(fg: u32, bg: u32, a: f64) -> u32 {
    let ch = |c: u32, s: u32| ((c >> s) & 0xff) as f64;
    [16, 8, 0].iter().fold(0, |out, &s| {
        out | (((ch(bg, s) + (ch(fg, s) - ch(bg, s)) * a).round() as u32) << s)
    })
}

fn hex(v: &str) -> Option<u32> {
    let v = v.strip_prefix('#')?;
    (v.len() == 6)
        .then(|| u32::from_str_radix(v, 16).ok())
        .flatten()
}

/// A color from the Omarchy theme, if this is Omarchy.
fn themed(key: &str) -> Option<u32> {
    let home = std::env::var("HOME").ok()?;
    let toml = std::fs::read_to_string(format!(
        "{home}/.local/state/omarchy/current/theme/colors.toml"
    ))
    .ok()?;
    toml.lines().find_map(|line| {
        let (k, v) = line.split_once('=')?;
        (k.trim() == key).then(|| hex(v.trim().trim_matches('"')))?
    })
}
