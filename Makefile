.PHONY: dev ci

dev:
	pnpm -C web dev

ci:
	pnpm -C web install --frozen-lockfile
	pnpm -C web build
	cargo test --workspace --all-features
	pnpm -C web test
