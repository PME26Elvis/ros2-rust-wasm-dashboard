# ros2-rust-wasm-dashboard

## Quickstart (mock)

```bash
bash scripts/setup.sh
cp .env.example .env
pnpm -C web install
make ci
```

## 本機 demo

平台：Ubuntu 24.04 + ROS 2 Jazzy + Rust stable

安裝步驟：
1. 設定 locale、匯入 GPG key 並加入 ROS 2 軟體源。
2. `sudo apt update && sudo apt install ros-jazzy-ros-base`
3. `source /opt/ros/jazzy/setup.bash`

執行 demo：

```bash
export RMW_IMPLEMENTATION=rmw_cyclonedds_cpp
cargo run -p ros2_demo --bin minimal_pub    # 自動結束
# 另開終端執行：
cargo run -p ros2_demo --bin minimal_sub    # 收到 ≥10 則後自動結束
```

## Architecture

![architecture](docs/architecture.png)

## Performance

_TODO: add JSON vs MsgPack results_

## GIF Recording

Use a tool like `peek` or `asciinema` to record the dashboard.
