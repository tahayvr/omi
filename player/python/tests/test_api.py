"""The parts of the player that conformance.json has no data for.

These hold the player to rules of the pack README and the Omi state
protocol that the conformance data doesn't exercise: the clocks, mode
changes, the gaze meeting a morph, and changes with `since`.

What a mode looks like, how long its loops are and how long a morph takes
are the pack's to say, so every number here that depends on a design is
worked out from omi.json, by the README's rules: a mode can be redrawn
without touching these tests.
"""

import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from omi import Pack, PackError, Player, Rect, UnknownMode  # noqa: E402

PACK = os.path.join(HERE, "..", "..", "..", "pack", "omi.json")


def setUpModule():
    global pack, RAW, MODES, LAND
    pack = Pack.load(PACK)
    with open(PACK, encoding="utf-8") as f:
        RAW = json.load(f)
    MODES = {m["id"]: m for m in RAW["modes"]}
    # how long a morph takes to land, in ms: duration + stagger
    LAND = (RAW["morph"]["duration"] + RAW["morph"]["stagger"]) * 1000.0


def loop_seconds(mode):
    # "the longest of (duration + delay) over its pieces, its body `anim`
    # and its window's, where duration is the piece's own if it sets one"
    anims = RAW["animations"]
    times = [
        p.get("duration", anims[p["anim"]]["duration"]) + p.get("delay", 0)
        for p in mode["pieces"]
        if p.get("anim")
    ]
    for anim in (mode.get("anim"), (mode.get("clip") or {}).get("anim")):
        if anim:
            times.append(anims[anim]["duration"])
    return max(times, default=0)


def body_mode():
    # a mode whose whole body moves, and the first moment it is off its rest
    anims = RAW["animations"]
    for mode in RAW["modes"]:
        anim = anims.get(mode.get("anim") or "")
        if anim and anim.get("body"):
            for at, key in anim["keys"]:
                if key.get("tx", 0) or key.get("ty", 0):
                    return mode["id"], at * anim["duration"]
    raise AssertionError("no mode in the pack moves its whole body")


def gaze_move(rects, gx, gy):
    # how far a look moves the gazing rects: reach, then held inside `inside`
    gaze = RAW["gaze"]
    move = [gx * gaze["reach"][0], gy * gaze["reach"][1]]
    inside = gaze.get("inside")
    if inside:
        eyes = [r for r in rects if r.role in gaze["roles"]]
        for axis, (pos, size) in enumerate(((0, 2), (1, 3))):
            lo, hi = inside[pos], inside[pos] + inside[size]
            fit = [r for r in eyes if r[pos] >= lo and r[pos] + r[size] <= hi]
            if not fit:
                continue
            most = min(hi - (r[pos] + r[size]) for r in fit)
            least = max(lo - r[pos] for r in fit)
            move[axis] = 0 if least > most else min(max(move[axis], least), most)
    return move


def run_to(player, clock, target):
    while clock < target:
        clock = min(clock + 100.0, target)
        player.frame(clock)
    return clock


def ink(rects):
    # How much is drawn: cutting rects into cells doesn't change it, and
    # rounding them to 1/1024 for a morph changes it by less than INK.
    return sum(r.w * r.h * r.opacity for r in rects)


INK = 1.0


class Loading(unittest.TestCase):
    def test_pack(self):
        self.assertEqual(pack.version, 1)
        self.assertEqual(pack.grid, RAW["grid"])
        self.assertEqual(pack.view, tuple(RAW["view"]))
        self.assertEqual(list(pack.mode_ids), list(MODES))
        self.assertTrue(pack.has("mark"))
        self.assertFalse(pack.has("thinkng"))

    def test_not_a_pack(self):
        for text in ("", "[]", '{"format": "something-else"}',
                     '{"format": "omi-pack", "version": 2}'):
            with self.assertRaises(PackError):
                Pack.parse(text)
        self.assertTrue(issubclass(PackError, ValueError))

    def test_unknown_mode(self):
        with self.assertRaises(UnknownMode) as raised:
            Player(pack, mode="thinkng")
        self.assertEqual(str(raised.exception), 'no mode "thinkng"')
        player = Player(pack)
        with self.assertRaises(KeyError):
            player.set("thinkng")
        with self.assertRaises(UnknownMode):
            player.mode_rects("thinkng", 0)
        # The failed change left the player as it was.
        self.assertEqual(player.mode, "mark")
        self.assertTrue(player.settled)

    def test_rects(self):
        rects = Player(pack, mode="idle").rects()
        pieces = MODES["idle"]["pieces"]
        self.assertEqual([r.role for r in rects], [p["role"] for p in pieces])
        self.assertIsInstance(rects[0], Rect)
        # A piece that doesn't move is drawn where the pack puts it.
        for r, p in zip(rects, pieces):
            if not p.get("anim"):
                self.assertEqual(
                    r,
                    Rect(p["x"], p["y"], p["w"], p["h"], p.get("opacity", 1), p["role"]),
                )
        with self.assertRaises(AttributeError):
            rects[0].x = 1


class WhatAModeIsFor(unittest.TestCase):
    def test_loop_seconds(self):
        player = Player(pack)
        self.assertEqual(player.loop_seconds("mark"), 0)
        for id, mode in MODES.items():
            with self.subTest(mode=id):
                self.assertAlmostEqual(player.loop_seconds(id), loop_seconds(mode))

    def test_hold_and_kind(self):
        player = Player(pack)
        for id, mode in MODES.items():
            with self.subTest(mode=id):
                self.assertEqual(player.kind(id), mode["kind"])
                # Its own hold, or else its loop time kept between 1.2 and 2.5 s.
                hold = mode.get("hold")
                if hold is None:
                    hold = min(max(loop_seconds(mode), 1.2), 2.5)
                self.assertAlmostEqual(player.hold(id), hold)


class Labels(unittest.TestCase):
    def test_what_a_screen_reader_says(self):
        player = Player(pack)
        for id, mode in MODES.items():
            self.assertTrue(player.label(id))
            self.assertEqual(player.label(id), mode["label"])
        self.assertRaises(UnknownMode, player.label, "thinkng")


class Time(unittest.TestCase):
    def test_first_frame_advances_nothing(self):
        player = Player(pack, mode="idle")
        player.frame(123456.0)
        self.assertEqual(player.rects(), player.mode_rects("idle", 0))

    def test_dt_is_kept_between_0_and_a_tenth(self):
        player = Player(pack, mode="idle")
        player.frame(0.0)
        player.frame(5000.0)   # a pause: counts as 0.1 s
        self.assertEqual(player.rects(), player.mode_rects("idle", 0.1))
        player.frame(1000.0)   # the clock restarted: counts as nothing
        self.assertEqual(player.rects(), player.mode_rects("idle", 0.1))
        player.frame(1050.0)
        self.assertEqual(player.rects(), player.mode_rects("idle", 0.1 + 0.05))

    def test_speed(self):
        player = Player(pack, mode="idle", speed=2.0)
        player.frame(0.0)
        player.frame(100.0)
        self.assertEqual(player.rects(), player.mode_rects("idle", 0.2))

    def test_speed_is_never_less_than_a_twentieth(self):
        player = Player(pack, mode="idle", speed=0.0)
        player.frame(0.0)
        player.frame(100.0)
        self.assertEqual(player.rects(), player.mode_rects("idle", 0.1 * 0.05))

    def test_turning_animate_off_goes_back_to_rest(self):
        player = Player(pack, mode="idle")
        player.frame(0.0)
        run_to(player, 0.0, 900.0)
        self.assertNotEqual(player.rects(), player.mode_rects("idle", 0))
        player.animate = False
        self.assertEqual(player.rects(), player.mode_rects("idle", 0))
        # and back on, the loops start over
        player.animate = True
        player.frame(950.0)
        self.assertEqual(player.rects(), player.mode_rects("idle", 0.05))

    def test_animate_off(self):
        player = Player(pack, mode="idle", animate=False)
        player.frame(0.0)
        run_to(player, 0.0, 900.0)
        self.assertEqual(player.rects(), player.mode_rects("idle", 0))
        # A morph still plays, and lands on the new mode at rest.
        player.set("thinking")
        run_to(player, 900.0, 1300.0)
        self.assertTrue(player.morphing)
        run_to(player, 1300.0, 3000.0)
        self.assertTrue(player.settled)
        self.assertEqual(player.rects(), player.mode_rects("thinking", 0))

    def test_body_motion_off(self):
        mode, at = body_mode()
        ms = at * 1000.0
        rest = Player(pack, mode=mode).mode_rects(mode, 0)
        still = Player(pack, mode=mode, body_motion=False)
        still.frame(0.0)
        run_to(still, 0.0, ms)
        moving = Player(pack, mode=mode)
        moving.frame(0.0)
        run_to(moving, 0.0, ms)
        # The whole body has moved off its rest, unless body motion is off;
        # what is left is the pieces' own loops.
        for a, b in zip(moving.rects(), moving.mode_rects(mode, at)):
            for x, y in zip(a[:5], b[:5]):
                self.assertAlmostEqual(x, y, places=6)
        self.assertNotEqual(
            [(r.x, r.y) for r in moving.rects()], [(r.x, r.y) for r in still.rects()]
        )
        for a, b in zip(still.rects(), rest):
            if a.role == "frame":
                self.assertEqual(a, b)


class Changes(unittest.TestCase):
    def test_same_mode_does_nothing(self):
        player = Player(pack, mode="idle")
        player.frame(0.0)
        run_to(player, 0.0, 500.0)
        before = player.rects()
        player.set("idle")
        player.set("idle", instant=True)
        self.assertTrue(player.settled)
        self.assertEqual(player.rects(), before)

    def test_instant(self):
        player = Player(pack, mode="idle")
        player.frame(0.0)
        run_to(player, 0.0, 500.0)
        player.set("error", instant=True)
        self.assertTrue(player.settled)
        self.assertEqual(player.mode, "error")
        self.assertEqual(player.rects(), player.mode_rects("error", 0))

    def test_morph_starts_from_what_is_on_screen(self):
        player = Player(pack, mode="idle")
        player.frame(0.0)
        run_to(player, 0.0, 900.0)
        before = player.rects()
        player.set("thinking")
        self.assertTrue(player.morphing)
        self.assertEqual(player.mode, "thinking")
        # At 0 the morph is the old picture, cut into cells.
        self.assertAlmostEqual(ink(player.rects()), ink(before), delta=INK)
        self.assertGreater(len(player.rects()), len(before))

    def test_change_in_the_middle_of_a_morph(self):
        player = Player(pack, mode="idle")
        player.frame(0.0)
        player.set("error")
        run_to(player, 0.0, 300.0)
        middle = player.rects()
        player.set("sleeping")
        self.assertAlmostEqual(ink(player.rects()), ink(middle), delta=INK)
        run_to(player, 300.0, 300.0 + LAND)
        self.assertTrue(player.settled)
        self.assertEqual(player.rects(), player.mode_rects("sleeping", 0))

    def test_landing_and_on_settled(self):
        landed = []
        player = Player(pack, mode="idle", on_settled=landed.append)
        player.frame(0.0)
        player.set("thinking")
        run_to(player, 0.0, LAND - 40.0)
        self.assertEqual(landed, [])
        self.assertTrue(player.morphing)
        self.assertFalse(player.settled)
        # The morph lands at duration + stagger, on the first frame that
        # gets there. That frame shows the new mode at rest: the 0.06 s it
        # overshot by are dropped.
        player.frame(LAND + 60.0)
        self.assertEqual(landed, ["thinking"])
        self.assertTrue(player.settled)
        self.assertEqual(player.rects(), player.mode_rects("thinking", 0))
        player.frame(LAND + 110.0)
        self.assertEqual(player.rects(), player.mode_rects("thinking", 0.05))
        run_to(player, LAND + 110.0, LAND + 1200.0)
        self.assertEqual(landed, ["thinking"])

    def test_a_jump_settles_too(self):
        landed = []
        player = Player(pack, mode="idle", on_settled=landed.append)
        player.frame(0.0)
        player.set("error", instant=True)
        self.assertEqual(landed, ["error"])

    def test_nothing_on_screen_is_a_jump(self):
        # With nothing drawn there is nothing to morph from.
        player = Player(pack, mode="idle")
        player.frame(0.0)
        player._base = []
        player.set("thinking")
        self.assertTrue(player.settled)
        self.assertEqual(player.rects(), player.mode_rects("thinking", 0))

    def test_the_mode_a_morph_is_heading_for(self):
        # In the middle of a morph, a change to its own mode is a change
        # like any other: a new morph, from what is on screen.
        player = Player(pack, mode="idle")
        player.frame(0.0)
        player.set("error")
        run_to(player, 0.0, 300.0)
        player.set("error")
        run_to(player, 300.0, 300.0 + LAND - 40.0)
        self.assertTrue(player.morphing)
        run_to(player, 300.0 + LAND - 40.0, 300.0 + LAND + 60.0)
        self.assertTrue(player.settled)


class Gaze(unittest.TestCase):
    def test_look(self):
        player = Player(pack, mode="idle", animate=False)
        player.frame(0.0)
        self.assertEqual(player.gaze(), (0.0, 0.0))
        self.assertFalse(player.gazing)
        player.look(5, -0.5)   # each axis is kept in -1..1
        self.assertTrue(player.gazing)
        self.assertEqual(player.gaze(), (0.0, 0.0))
        run_to(player, 0.0, 100.0)
        x, y = player.gaze()
        self.assertTrue(0 < x < 1 and -0.5 < y < 0)
        run_to(player, 100.0, 100.0 + RAW["gaze"]["duration"] * 1000.0)
        self.assertFalse(player.gazing)
        self.assertEqual(player.gaze(), (1.0, -0.5))
        # Every gazing rect moved by reach, held inside the inner square.
        rest = player.mode_rects("idle", 0)
        dx, dy = gaze_move(rest, 1.0, -0.5)
        for r, at_rest in zip(player.rects(), rest):
            if r.role in RAW["gaze"]["roles"]:
                self.assertAlmostEqual(r.x, at_rest.x + dx)
                self.assertAlmostEqual(r.y, at_rest.y + dy)
            else:
                self.assertEqual(r, at_rest)
        # Asking for the direction already set does nothing.
        player.look(1, -0.5)
        self.assertFalse(player.gazing)

    def test_a_new_look_starts_from_where_the_eyes_are(self):
        player = Player(pack, mode="idle", animate=False)
        player.frame(0.0)
        player.look(1, 0)
        run_to(player, 0.0, 175.0)
        half = player.gaze()
        player.look(0, 0)
        player.frame(175.0)
        self.assertEqual(player.gaze(), half)
        run_to(player, 175.0, 600.0)
        self.assertEqual(player.gaze(), (0.0, 0.0))

    def test_a_morph_takes_its_source_before_the_gaze(self):
        player = Player(pack, mode="idle", animate=False)
        player.frame(0.0)
        player.look(1, 0)
        run_to(player, 0.0, 500.0)
        before = [r for r in player.rects() if r.role == "eye"]
        # A mode change doesn't interrupt the look, and the look is not
        # applied twice: the eyes start the morph where they are.
        player.set("sleeping")
        after = [r for r in player.rects() if r.role == "eye"]
        self.assertEqual(after, before)
        self.assertEqual(player.gaze(), (1.0, 0.0))

    def test_eyes_stay_inside(self):
        # In every mode, a full look each way keeps the eyes that start
        # inside the inner square inside it (wide eyes get less reach).
        inside = RAW["gaze"].get("inside")
        if not inside:
            self.skipTest("the pack has no inner square for the gaze")
        lo_x, lo_y = inside[0], inside[1]
        hi_x, hi_y = inside[0] + inside[2], inside[1] + inside[3]
        roles = RAW["gaze"]["roles"]
        for id in MODES:
            rest = Player(pack, mode=id).mode_rects(id, 0)
            fits = [
                (lo_x <= r.x and r.x + r.w <= hi_x, lo_y <= r.y and r.y + r.h <= hi_y)
                for r in rest
            ]
            for gx, gy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                with self.subTest(mode=id, look=(gx, gy)):
                    player = Player(pack, mode=id, animate=False)
                    player.frame(0.0)
                    player.look(gx, gy)
                    run_to(player, 0.0, RAW["gaze"]["duration"] * 1000.0 + 100.0)
                    for r, (fit_x, fit_y) in zip(player.rects(), fits):
                        if r.role not in roles:
                            continue
                        if fit_x:
                            self.assertTrue(lo_x - 1e-6 <= r.x and r.x + r.w <= hi_x + 1e-6)
                        if fit_y:
                            self.assertTrue(lo_y - 1e-6 <= r.y and r.y + r.h <= hi_y + 1e-6)


class Since(unittest.TestCase):
    """Changes that happened at a Unix time: the Omi state protocol."""

    NOW = 1767225600000.0

    def assertSameRects(self, got, want):
        self.assertEqual(len(got), len(want))
        for a, b in zip(got, want):
            self.assertEqual(a.role, b.role)
            for x, y in zip(a[:5], b[:5]):
                self.assertAlmostEqual(x, y, places=6)

    def test_a_morph_part_of_the_way_along(self):
        # One app watched the change happen.
        watching = Player(pack, mode="idle", animate=False)
        watching.frame(self.NOW)
        watching.set("thinking", since=self.NOW)
        run_to(watching, self.NOW, self.NOW + 300.0)
        # Another hears of it 0.29 s late.
        late = Player(pack, mode="idle", animate=False)
        late.frame(self.NOW + 290.0)
        late.set("thinking", since=self.NOW)
        late.frame(self.NOW + 300.0)
        self.assertTrue(late.morphing)
        self.assertSameRects(late.rects(), watching.rects())
        # From then on they stay together, and land together.
        run_to(watching, self.NOW + 300.0, self.NOW + LAND)
        run_to(late, self.NOW + 300.0, self.NOW + LAND)
        self.assertTrue(watching.settled and late.settled)
        self.assertSameRects(late.rects(), watching.rects())

    def test_a_morph_that_has_landed(self):
        landed = []
        player = Player(pack, mode="idle", on_settled=landed.append)
        player.frame(self.NOW)
        player.set("thinking", since=self.NOW - 5000.0)
        self.assertEqual(landed, [])
        player.frame(self.NOW + 16.0)
        # Its loops are that much past the landing.
        self.assertTrue(player.settled)
        self.assertEqual(landed, ["thinking"])
        self.assertSameRects(
            player.rects(), player.mode_rects("thinking", 5.016 - LAND / 1000.0)
        )

    def test_before_the_first_frame(self):
        player = Player(pack, mode="mark")
        player.set("idle", since=self.NOW - 400.0)
        player.frame(self.NOW)
        other = Player(pack, mode="mark")
        other.frame(self.NOW - 400.0)
        other.set("idle")
        run_to(other, self.NOW - 400.0, self.NOW)
        self.assertSameRects(player.rects(), other.rects())

    def test_instant(self):
        player = Player(pack, mode="mark")
        player.frame(self.NOW)
        player.set("idle", instant=True, since=self.NOW - 2500.0)
        player.frame(self.NOW + 100.0)
        # Its loops have been running for now - since.
        self.assertSameRects(player.rects(), player.mode_rects("idle", 2.6))

    def test_it_follows_the_clock_on_every_frame(self):
        # An app that stalls is back in step on its next frame: a frame
        # counts for 0.1 s at most, but a shared change is worked out from
        # the clock.
        player = Player(pack, mode="mark")
        player.frame(self.NOW)
        player.set("idle", instant=True, since=self.NOW)
        player.frame(self.NOW + 100.0)
        player.frame(self.NOW + 3100.0)
        self.assertSameRects(player.rects(), player.mode_rects("idle", 3.1))
        # A change of the player's own runs on its frames again.
        player.set("thinking", instant=True)
        player.frame(self.NOW + 9100.0)
        self.assertSameRects(player.rects(), player.mode_rects("thinking", 0.1))

    def test_a_time_still_to_come(self):
        # A clock a little behind the service's: the change starts now.
        player = Player(pack, mode="mark")
        player.frame(self.NOW)
        player.set("idle", since=self.NOW + 50.0)
        player.frame(self.NOW + 16.0)
        other = Player(pack, mode="mark")
        other.frame(self.NOW)
        other.set("idle")
        self.assertSameRects(player.rects(), other.rects())


if __name__ == "__main__":
    unittest.main(verbosity=2)
