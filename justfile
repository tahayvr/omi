alias c := check
alias d := dev

dev:
	pnpm dev

check:
	pnpm fmt
	pnpm lint
	pnpm check
