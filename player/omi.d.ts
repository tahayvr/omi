/* Types for the Omi player (omi.js) and the Omi kit (omi.json).
   tools/build-kit.js copies this file into kit/ next to the player.

   omi.js is a CommonJS module (and a global `Omi` in a browser page):
     import Omi from "omi-kit";            // with esModuleInterop, or in ESM
     const Omi = require("omi-kit");
     import kit from "omi-kit/omi.json" with { type: "json" };
     const omi = new Omi(canvas, kit);
   The types for what it takes and gives are Omi.Kit, Omi.Rect, Omi.Options… */

declare namespace Omi {
  /** A filled rectangle in grid units, in drawing order. */
  interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
    /** Opacity, 0..1. */
    o: number;
    /** frame, eye, brow, mouth, tear or extra. */
    role: string;
  }

  /** A piece of a mode: one filled rectangle (see kit/README.md, Modes). */
  interface Piece {
    x: number;
    y: number;
    w: number;
    h: number;
    role: string;
    opacity?: number;
    anim?: string;
    delay?: number;
    duration?: number;
    clip?: boolean;
    mx?: number;
    my?: number;
    dx?: number;
    dy?: number;
  }

  /** One of Omi's looks. */
  interface Mode {
    id: string;
    name: string;
    /** What a screen reader says for the mode ("Omi is thinking"). */
    label?: string;
    kind?: "state" | "reaction";
    /** On a reaction: seconds to show it after its morph lands. */
    hold?: number;
    family?: string;
    easter?: boolean;
    group?: string;
    bounds: [number, number, number, number];
    anim?: string;
    clip?: { x: number; y: number; w: number; h: number; anim?: string };
    pieces: Piece[];
  }

  /** omi.json: every mode, animation and morph setting. */
  interface Kit {
    format: "omi-kit";
    version: 1;
    grid: number;
    view: [number, number, number, number];
    roles: string[];
    morph: {
      duration: number;
      stagger: number;
      ease: [number, number, number, number];
      center: [number, number];
      splitReach: number;
      rolePenalty: number;
    };
    gaze?: {
      reach: [number, number];
      duration: number;
      ease: [number, number, number, number];
      roles: string[];
      inside?: [number, number, number, number];
    };
    animations: Record<string, unknown>;
    modes: Mode[];
  }

  interface Options {
    /** Fill color; null follows the canvas's CSS `color`. */
    color?: string | null;
    /** Animation and morph speed, 1 = normal. */
    speed?: number;
    /** Scales the still time between passes of a loop: 1 as designed. */
    rest?: number;
    /** False shows each mode at rest, with no loops. */
    animate?: boolean;
    /** False leaves out whole-body moves (bob, hop, shake). */
    bodyMotion?: boolean;
    /** True (default): each logo cell a whole number of device pixels. */
    even?: boolean;
    /** The mode to start in (default "logo", the plain logo). */
    mode?: string;
    /** [x, y, w, h] to show, instead of the kit's view. */
    view?: [number, number, number, number];
    /** True (default): the canvas's aria-label follows the mode's label. */
    label?: boolean;
  }

  interface SetOptions {
    /** Jump instead of morphing. */
    instant?: boolean;
    /** When the change happened (Unix ms), for a shared Omi. */
    since?: number | null;
  }

  interface SettledEvent {
    type: "settled";
    target: Omi;
  }

  /** Something to draw on: a browser canvas, or null to fill rects() yourself. */
  type Canvas = HTMLCanvasElement | OffscreenCanvas | null;
}

declare class Omi {
  constructor(canvas: Omi.Canvas, kit: Omi.Kit, options?: Omi.Options);

  readonly kit: Omi.Kit;
  /** The mode Omi is in, or morphing to. */
  readonly mode: string;
  color: string | null;
  speed: number;
  rest: number;
  view: [number, number, number, number];
  even: boolean;
  animate: boolean;
  bodyMotion: boolean;
  /** True while the eyes are on their way to a new look. */
  readonly gazing: boolean;

  /** Change mode: morph there from what's on screen, or jump. */
  set(mode: string, options?: Omi.SetOptions): void;
  /** Turn the eyes, each axis -1..1 (x right, y down); (0, 0) ahead. */
  look(dx: number, dy: number): void;
  /** Where the eyes look now, each axis -1..1. */
  gaze(): [number, number];

  /** Seconds until every piece of a mode has played its loop once. */
  loopSeconds(mode: string): number;
  /** Seconds to show a reaction after its morph lands. */
  hold(mode: string): number;
  kind(mode: string): "state" | "reaction";
  /** What a screen reader says for a mode ("Omi is thinking"). */
  label(mode: string): string;

  /** Advance to this time (ms) and draw; call on every display frame. */
  frame(ms: number): void;
  /** What is on screen now, the gaze applied: fill these. */
  rects(): Omi.Rect[];
  /** A mode's rects t seconds into its loops (t = 0: at rest). */
  modeRects(mode: Omi.Mode, t: number): Omi.Rect[];
  restRects(mode: Omi.Mode): Omi.Rect[];
  /** Draw on the canvas now. */
  draw(): void;
  /** Stop drawing and let go of the canvas. */
  destroy(): void;

  on(type: "settled", fn: (event: Omi.SettledEvent) => void): this;
  off(type: "settled", fn: (event: Omi.SettledEvent) => void): this;
  addEventListener(
    type: "settled",
    fn: (event: Omi.SettledEvent) => void,
  ): this;
  removeEventListener(
    type: "settled",
    fn: (event: Omi.SettledEvent) => void,
  ): this;
}

export = Omi;
