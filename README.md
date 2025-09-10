# ROS2 Rust WASM Dashboard

A lightweight monitoring dashboard for **ROS 2** built with **Rust (rclrs)**, a WebSocket bridge, and a minimal **Lit + Vite** frontend.  
It provides real‑time topic visualization (logs + KPIs), a robot map with a 30s trail, QoS info, and Prometheus metrics.

---

## Features
- 🔌 **ROS 2 → Rust WebSocket bridge**
- 📈 **Realtime KPIs:** messages received, msgs/s, bitrate, P95 latency (computed client‑side)
- 🗺️ **Robot map:** 30‑second trajectory of a built‑in fake robot publisher
- 📜 **Live logs** with filter, CSV export, auto‑reconnect & ring buffer
- ⚙️ **QoS panel** (Reliable/Volatile/KeepLast)
- 📊 **/metrics** endpoint (Prometheus exposition format)

---

## Quickstart

### Prerequisites
- **ROS 2 Humble** (Ubuntu 22.04) installed and sourced
- **Rust** (stable) and **cargo**
- **Node 20+** and **pnpm 9+** (`corepack enable && corepack prepare pnpm@9 --activate`)

### Run the bridge
```bash
source /opt/ros/humble/setup.bash
cd crates/ros2_ws_bridge
cargo run --release
```

### Run the fake robot (publisher)
```bash
source /opt/ros/humble/setup.bash
cd crates/ros2_demo
cargo run --release --bin fake_robot
```

### Start the web UI
```bash
pnpm -C web install
pnpm -C web dev
# open http://localhost:5173
```

### (Optional) Prometheus
Add a scrape job:
```yaml
scrape_configs:
  - job_name: 'ros2_ws_bridge'
    static_configs:
      - targets: ['localhost:8787']
```
Query examples: `msgs_total`, `bytes_total`, `throughput_msgs_per_sec`.

---

## WebSocket payloads

**Message log**
```json
{ "type":"msg", "topic":"chatter", "seq":42, "ts":1700000000.1, "recv_ts":1700000000.2, "size_bytes":18, "data":"hello from rclrs |42|1700000000200" }
```

**Robot pose**
```json
{ "type":"robot", "seq":128, "x":1.23, "y":-0.45, "theta":0.78, "ts":1700000001.0, "recv_ts":1700000001.0 }
```

---

## Screenshots
![Dashboard](docs/dashboard.png)
![Prometheus](docs/prometheus.png)

---

## License
MIT