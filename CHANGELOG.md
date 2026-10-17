# Changelog

Every package of a release has the same version: `omi-kit` on npm and PyPI,
`omi` on crates.io, and the kit zip on GitHub. The kit's format version
(`"version"` in omi.json) is separate: it changes only when a player built
for the old format would misread the new one, and then the major version
changes with it.

## 1.0.0

The first release.

- **The kit:** 30 modes (states, reactions and extras), each with a
  screen-reader label, a kind and, for reactions, how long to hold them;
  animations with rests between passes; morphs from any mode to any other;
  a gaze that turns the eyes. Format version 1, described in full in the
  kit's README, with a JSON Schema and conformance data.
- **Players:** JavaScript (`omi-kit` on npm, with TypeScript types), Python
  (`omi-kit` on PyPI) and Rust (`omi` on crates.io). They draw every morph
  the same, rect for rect, and each package carries the kit it was built
  with: `Kit.bundled()` in Python and Rust, `omi-kit/omi.json` in npm.
- **Shared state:** a protocol and a reference service, so every app on a
  machine shows one Omi, in step.
