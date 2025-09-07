#!/usr/bin/env bash
set -euo pipefail

# toolchains
if command -v mise >/dev/null 2>&1; then
  mise use -g node@20 || true
  mise use -g rust@stable || true
fi

corepack enable || true
npm i -g pnpm wasm-pack || true

# create dirs if not exists
mkdir -p web crates/shared crates/bridge crates/fake_robot_state fixtures

# install web deps if package.json exists later
if [ -f web/package.json ]; then
  pnpm -C web install --frozen-lockfile || true
fi

# (Optional) best-effort: try apt-based setup if available
if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update -y || true
  # You MAY add ROS Jazzy apt sources here in a later PR.
  # Keep mock pipeline as default to ensure CI is cloud-safe.
fi
