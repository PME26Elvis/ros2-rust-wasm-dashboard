# How to build & test (for Codex)

## Modes
- mock (default, no ROS required): use recorded frames or a pure Rust fake data generator
- ros2 (optional, for local demo): requires ROS 2 Jazzy + rclrs on a Linux/WSL machine

## Build steps (cloud-safe)
1) Run `scripts/setup.sh` to install toolchains (Rust/Node/wasm-pack); this is cacheable.
2) Web: `pnpm -C web build` (will be created by tasks)
3) Rust: `cargo test --workspace --all-features` (mock pipeline)
4) E2E (headless): `pnpm -C web test`

## Optional: try installing ROS 2 Jazzy
If sandbox is Ubuntu with apt available, try installing ROS 2 Jazzy base per official docs, then run a minimal rclrs publisher/subscriber demo.
If it fails, **fallback to mock pipeline** and attach full logs in the PR.

## Acceptance
- All tests green (mock)
- Produce `web/dist` artifact
- README updated (quickstart + GIF if UI changed)
