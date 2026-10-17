"""Loading the Omi kit: omi.json as plain Python types.

Nothing here works out a frame. This module only reads the data and checks
that it is a kit this player understands (format version 1).
"""

import json
from typing import Dict, NamedTuple, Optional, Tuple, Union

__all__ = [
    "Animation",
    "Clip",
    "GazeSettings",
    "Mode",
    "MorphSettings",
    "Kit",
    "KitError",
    "Piece",
    "Rect",
    "UnknownMode",
]

# The roles whose cells never pair with a frame cell in a morph.
FACE_ROLES = frozenset(("eye", "brow", "mouth", "tear"))

# A value in a key: a number, or [name, factor] (the piece's own number
# `name` times `factor`).
Value = Union[float, Tuple[str, float]]


class KitError(ValueError):
    """The text is not an Omi kit this player can read."""


class UnknownMode(KeyError):
    """The kit has no mode with that id."""

    def __init__(self, mode):
        KeyError.__init__(self, mode)
        self.mode = mode

    def __str__(self):
        return 'no mode "%s"' % (self.mode,)


class Rect(NamedTuple):
    """One rectangle to fill, in grid units."""

    x: float
    y: float
    w: float
    h: float
    opacity: float
    role: str


class Animation(NamedTuple):
    """A loop: a duration in seconds, an ease and keys.

    `ease` is a cubic-bezier (x1, y1, x2, y2), or None for "steps".
    `keys` is a tuple of (progress, {name: value}).
    """

    name: str
    duration: float
    rest: float
    ease: Optional[Tuple[float, float, float, float]]
    keys: Tuple[Tuple[float, Dict[str, Value]], ...]
    body: bool


class Piece(NamedTuple):
    """One filled rectangle of a mode, at rest."""

    x: float
    y: float
    w: float
    h: float
    role: str
    opacity: float
    anim: Optional[str]
    delay: float
    duration: Optional[float]
    clip: bool
    numbers: Dict[str, float]


class Clip(NamedTuple):
    """A mode's window: pieces with `clip` are only seen inside it."""

    x: float
    y: float
    w: float
    h: float
    anim: Optional[str]


class Mode(NamedTuple):
    """A mode: its pieces and what it is for."""

    id: str
    name: str
    label: str
    kind: str
    hold: Optional[float]
    family: Optional[str]
    easter: bool
    group: Optional[str]
    bounds: Tuple[float, float, float, float]
    anim: Optional[str]
    clip: Optional[Clip]
    pieces: Tuple[Piece, ...]


class MorphSettings(NamedTuple):
    duration: float
    stagger: float
    ease: Optional[Tuple[float, float, float, float]]
    center: Tuple[float, float]
    split_reach: float
    role_penalty: float


class GazeSettings(NamedTuple):
    reach: Tuple[float, float]
    duration: float
    ease: Optional[Tuple[float, float, float, float]]
    roles: Tuple[str, ...]
    inside: Optional[Tuple[float, float, float, float]]


def _number(value, what):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise KitError("%s must be a number, got %r" % (what, value))
    return float(value)


def _numbers(value, count, what):
    if not isinstance(value, (list, tuple)) or len(value) != count:
        raise KitError("%s must be a list of %d numbers" % (what, count))
    return tuple(_number(v, what) for v in value)


def _ease(value, what):
    if value == "steps":
        return None
    return _numbers(value, 4, what + " (a cubic-bezier or \"steps\")")


def _animation(name, data):
    what = 'animation "%s"' % name
    if not isinstance(data, dict):
        raise KitError("%s must be an object" % what)
    keys = []
    for key in data.get("keys", ()):
        if not isinstance(key, (list, tuple)) or len(key) != 2 or not isinstance(key[1], dict):
            raise KitError("%s: a key must be [progress, values]" % what)
        values = {}
        for prop, value in key[1].items():
            if isinstance(value, (list, tuple)):
                if len(value) != 2 or not isinstance(value[0], str):
                    raise KitError("%s: %s must be a number or [name, factor]" % (what, prop))
                values[prop] = (value[0], _number(value[1], what + " " + prop))
            else:
                values[prop] = _number(value, what + " " + prop)
        keys.append((_number(key[0], what + " key progress"), values))
    keys.sort(key=lambda k: k[0])
    duration = _number(data.get("duration"), what + " duration")
    if duration <= 0:
        raise KitError("%s: duration must be above 0" % what)
    rest = _number(data.get("rest", 0), what + " rest")
    if rest < 0:
        raise KitError("%s: rest must be 0 or more" % what)
    return Animation(
        name=name,
        duration=duration,
        rest=rest,
        ease=_ease(data.get("ease", [0, 0, 1, 1]), what + " ease"),
        keys=tuple(keys),
        body=bool(data.get("body", False)),
    )


_PIECE_KEYS = frozenset(
    ("x", "y", "w", "h", "role", "opacity", "anim", "delay", "duration", "clip")
)


def _piece(data, what, animations):
    if not isinstance(data, dict):
        raise KitError("%s must be an object" % what)
    anim = data.get("anim")
    if anim is not None and anim not in animations:
        raise KitError('%s plays "%s", which is not in animations' % (what, anim))
    duration = data.get("duration")
    if duration is not None:
        duration = _number(duration, what + " duration")
        if duration <= 0:
            raise KitError("%s: duration must be above 0" % what)
    # Any other number on a piece is one an animation may read by name
    # (mx, my, dx, dy).
    numbers = {}
    for key, value in data.items():
        if key not in _PIECE_KEYS and isinstance(value, (int, float)) and not isinstance(value, bool):
            numbers[key] = float(value)
    return Piece(
        x=_number(data.get("x"), what + " x"),
        y=_number(data.get("y"), what + " y"),
        w=_number(data.get("w"), what + " w"),
        h=_number(data.get("h"), what + " h"),
        role=str(data.get("role", "extra")),
        opacity=_number(data.get("opacity", 1), what + " opacity"),
        anim=anim,
        delay=_number(data.get("delay", 0), what + " delay"),
        duration=duration,
        clip=bool(data.get("clip", False)),
        numbers=numbers,
    )


def _mode(data, animations):
    if not isinstance(data, dict) or not isinstance(data.get("id"), str):
        raise KitError("a mode must be an object with an id")
    mode_id = data["id"]
    what = 'mode "%s"' % mode_id
    anim = data.get("anim")
    if anim is not None and anim not in animations:
        raise KitError('%s plays "%s", which is not in animations' % (what, anim))
    clip = data.get("clip")
    if clip is not None:
        if not isinstance(clip, dict):
            raise KitError("%s: clip must be an object" % what)
        clip_anim = clip.get("anim")
        if clip_anim is not None and clip_anim not in animations:
            raise KitError('%s: its window plays "%s", which is not in animations' % (what, clip_anim))
        clip = Clip(
            x=_number(clip.get("x"), what + " clip x"),
            y=_number(clip.get("y"), what + " clip y"),
            w=_number(clip.get("w"), what + " clip w"),
            h=_number(clip.get("h"), what + " clip h"),
            anim=clip_anim,
        )
    pieces = data.get("pieces")
    if not isinstance(pieces, list):
        raise KitError("%s: pieces must be a list" % what)
    pieces = tuple(
        _piece(piece, "%s piece %d" % (what, index), animations)
        for index, piece in enumerate(pieces)
    )
    if "bounds" in data:
        bounds = _numbers(data["bounds"], 4, what + " bounds")
    else:
        bounds = _bounds(pieces)
    hold = data.get("hold")
    return Mode(
        id=mode_id,
        name=str(data.get("name", mode_id)),
        # What a screen reader says: the label, or the name in a kit
        # without labels.
        label=str(data.get("label") or data.get("name", mode_id)),
        kind=str(data.get("kind", "state")),
        hold=None if hold is None else _number(hold, what + " hold"),
        family=data.get("family"),
        easter=bool(data.get("easter", False)),
        group=data.get("group"),
        bounds=bounds,
        anim=anim,
        clip=clip,
        pieces=pieces,
    )


def _bounds(pieces):
    # The tightest box around the pieces, for a mode that doesn't give one.
    if not pieces:
        return (0.0, 0.0, 0.0, 0.0)
    x0 = min(p.x for p in pieces)
    y0 = min(p.y for p in pieces)
    x1 = max(p.x + p.w for p in pieces)
    y1 = max(p.y + p.h for p in pieces)
    return (x0, y0, x1 - x0, y1 - y0)


class Kit:
    """Everything in omi.json.

    `grid` is the size of one logo cell and `view` the square (x, y, w, h)
    to map onto the drawing area. `modes` maps a mode id to its `Mode`, in
    the kit's order, and `animations` an animation's name to its
    `Animation`. `morph` holds the morph settings and `gaze` the gaze
    settings (None for a kit without gaze).

    `Kit.bundled()` is the kit that ships in this package. Make one from
    elsewhere with `Kit.load(path)` or `Kit.parse(text)`; `Kit(data)`
    takes the JSON already parsed. Those three raise `KitError` for
    anything that is not a version 1 kit.
    """

    def __init__(self, data):
        if not isinstance(data, dict):
            raise KitError("an Omi kit is a JSON object")
        if data.get("format", "omi-kit") != "omi-kit":
            raise KitError('not an Omi kit: format is %r' % (data.get("format"),))
        if data.get("version", 1) != 1:
            raise KitError(
                "this player reads kit version 1, not %r" % (data.get("version"),)
            )
        self.version = 1
        self.grid = _number(data.get("grid"), "grid")
        if self.grid <= 0:
            raise KitError("grid must be above 0")
        self.view = _numbers(data.get("view"), 4, "view")
        self.roles = tuple(data.get("roles", ()))

        animations = data.get("animations", {})
        if not isinstance(animations, dict):
            raise KitError("animations must be an object")
        self.animations = {}  # type: Dict[str, Animation]
        for name, anim in animations.items():
            self.animations[name] = _animation(name, anim)

        modes = data.get("modes")
        if not isinstance(modes, list):
            raise KitError("modes must be a list")
        self.modes = {}  # type: Dict[str, Mode]
        for mode in modes:
            mode = _mode(mode, self.animations)
            self.modes[mode.id] = mode

        morph = data.get("morph")
        if not isinstance(morph, dict):
            raise KitError("morph must be an object")
        self.morph = MorphSettings(
            duration=_number(morph.get("duration"), "morph duration"),
            stagger=_number(morph.get("stagger"), "morph stagger"),
            ease=_ease(morph.get("ease", [0, 0, 1, 1]), "morph ease"),
            center=_numbers(morph.get("center"), 2, "morph center"),
            split_reach=_number(morph.get("splitReach"), "morph splitReach"),
            role_penalty=_number(morph.get("rolePenalty"), "morph rolePenalty"),
        )
        if self.morph.duration <= 0:
            raise KitError("morph duration must be above 0")

        gaze = data.get("gaze")
        self.gaze = None  # type: Optional[GazeSettings]
        if gaze is not None:
            if not isinstance(gaze, dict):
                raise KitError("gaze must be an object")
            inside = gaze.get("inside")
            self.gaze = GazeSettings(
                reach=_numbers(gaze.get("reach"), 2, "gaze reach"),
                duration=_number(gaze.get("duration"), "gaze duration"),
                ease=_ease(gaze.get("ease", [0, 0, 1, 1]), "gaze ease"),
                roles=tuple(gaze.get("roles", ())),
                inside=None if inside is None else _numbers(inside, 4, "gaze inside"),
            )

    @classmethod
    def parse(cls, text):
        """Read a kit from the text of omi.json.

        Raises `KitError` (a `ValueError`) if it is not valid JSON or not
        a version 1 kit.
        """
        try:
            data = json.loads(text)
        except ValueError as error:
            raise KitError("omi.json is not valid JSON: %s" % error) from None
        return cls(data)

    @classmethod
    def load(cls, path):
        """Read a kit from the file omi.json at `path`."""
        with open(path, "r", encoding="utf-8") as file:
            return cls.parse(file.read())

    @classmethod
    def bundled(cls):
        """The kit that ships in this package: omi.json from the same
        omi-kit release as the player, so the two always agree."""
        from importlib.resources import files

        return cls.parse(files("omi").joinpath("omi.json").read_text(encoding="utf-8"))

    @property
    def mode_ids(self):
        """Every mode's id, in the kit's order."""
        return list(self.modes)

    def has(self, mode):
        """Whether the kit has a mode with this id."""
        return mode in self.modes

    def mode(self, mode):
        """The `Mode` with this id. Raises `UnknownMode` if there is none."""
        try:
            return self.modes[mode]
        except (KeyError, TypeError):
            raise UnknownMode(mode)

    def __repr__(self):
        return "<Kit version %d, %d modes, %d animations>" % (
            self.version,
            len(self.modes),
            len(self.animations),
        )
