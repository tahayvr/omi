alias c := check
alias q := quick
alias d := dev

dev:
	pnpm dev

# Everything, the way it's checked before a release: formatting, lint, the
# kit, every player (JavaScript, Python, Rust), every morph in each, the
# site in Chrome, and the examples' own checks (bash, Qt). Needs Chrome,
# python3, cargo and Qt's qmltestrunner; Quickshell's check skips itself
# outside a Wayland session.
check: quick
	pnpm check:python
	pnpm check:rust
	pnpm check:morphs
	pnpm check:site
	pnpm check:bash
	pnpm check:qt
	pnpm check:quickshell

# What CI runs, and nothing to install but Node: formatting, lint, the kit,
# the reference player and the service.
quick:
	pnpm fmt
	pnpm lint
	pnpm check
