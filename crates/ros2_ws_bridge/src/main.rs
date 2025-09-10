use std::{
    collections::VecDeque,
    net::SocketAddr,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use axum::{
    extract::{Query, State, WebSocketUpgrade, ws::{Message, WebSocket}},
    http::{HeaderMap, HeaderValue, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use parking_lot::RwLock;
use serde::Serialize;
use tokio::sync::broadcast;
use tokio::time::interval;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::{error, info};

// ROS
use rclrs::{Context, CreateBasicExecutor};
use rclrs::vendor::example_interfaces;

#[derive(Clone)]
struct AppState {
    tx: broadcast::Sender<String>,
    stats: Arc<Stats>,
    token: Option<String>,
}

struct Stats {
    msgs_total: AtomicU64,
    bytes_total: AtomicU64,
    ws_clients: AtomicU64,
    window: RwLock<VecDeque<(u64, u64)>>,
    sec_acc: AtomicU64,
}

impl Stats {
    fn new() -> Self {
        Self {
            msgs_total: AtomicU64::new(0),
            bytes_total: AtomicU64::new(0),
            ws_clients: AtomicU64::new(0),
            window: RwLock::new(VecDeque::with_capacity(32)),
            sec_acc: AtomicU64::new(0),
        }
    }
}

#[derive(Serialize)]
struct MsgDto<'a> {
    #[serde(rename = "type")]
    kind: &'a str,    // "msg"
    topic: &'a str,   // "/chatter"
    seq: u64,
    ts: f64,
    recv_ts: f64,
    size_bytes: usize,
    data: &'a str,
}

#[derive(Serialize)]
struct RobotDto {
    #[serde(rename = "type")]
    kind: &'static str, // "robot"
    seq: u64,
    x: f64,
    y: f64,
    theta: f64,
    ts: f64,
    recv_ts: f64,
}

#[derive(Serialize)]
struct StatusDto {
    #[serde(rename = "type")]
    kind: &'static str,
    connected: bool,
}

#[derive(Serialize)]
struct QosDto {
    reliability: &'static str,
    durability:  &'static str,
    history:     &'static str,
    depth:       u32,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter("info")
        .with_target(false)
        .compact()
        .init();

    let (tx, _rx) = broadcast::channel::<String>(1024);
    let stats = Arc::new(Stats::new());

    let token = std::env::var("BRIDGE_TOKEN").ok();
    let allowed_origins_env = std::env::var("ALLOWED_ORIGINS").unwrap_or_else(|_| "http://localhost:5173".to_string());
    let allowed_origins: Vec<HeaderValue> = allowed_origins_env
        .split(',')
        .filter_map(|s| HeaderValue::from_str(s.trim()).ok())
        .collect();

    start_ros_subscriptions(tx.clone(), stats.clone());

    {
        let stats = stats.clone();
        tokio::spawn(async move {
            let mut ticker = interval(Duration::from_secs(1));
            loop {
                ticker.tick().await;
                let now = now_sec();
                let cnt = stats.sec_acc.swap(0, Ordering::Relaxed);
                let mut w = stats.window.write();
                w.push_back((now as u64, cnt));
                while w.len() > 30 {
                    w.pop_front();
                }
            }
        });
    }

    let state = AppState { tx, stats, token };
    let cors = if allowed_origins.is_empty() {
        CorsLayer::very_permissive()
    } else {
        let mut layer = CorsLayer::new()
            .allow_methods([Method::GET])
            .allow_headers(Any);
        let mut origins = Vec::new();
        for hv in allowed_origins {
            origins.push(hv);
        }
        layer = layer.allow_origin(origins);
        layer
    };

    let app = Router::new()
        .route("/healthz", get(healthz))
        .route("/metrics", get(metrics))
        .route("/qos", get(qos))
        .route("/ws/chatter", get(ws_chatter))
        .with_state(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = "0.0.0.0:8787".parse().unwrap();
    info!("bridge listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app.into_make_service())
        .with_graceful_shutdown(shutdown_signal())
        .await
        .unwrap();
}

async fn healthz() -> Response { "ok".into_response() }

async fn qos() -> Response {
    let dto = QosDto { reliability: "Reliable", durability: "Volatile", history: "KeepLast", depth: 10 };
    (StatusCode::OK, [("Content-Type", "application/json")], serde_json::to_string(&dto).unwrap()).into_response()
}

async fn metrics(State(state): State<AppState>) -> Response {
    let total = state.stats.msgs_total.load(Ordering::Relaxed);
    let bytes = state.stats.bytes_total.load(Ordering::Relaxed);
    let clients = state.stats.ws_clients.load(Ordering::Relaxed);
    let throughput = {
        let w = state.stats.window.read();
        let sum: u64 = w.iter().map(|(_, c)| *c).sum();
        (sum as f64) / (w.len().max(1) as f64)
    };
    let body = format!(
        concat!(
            "# HELP msgs_total Total messages received.\n",
            "# TYPE msgs_total counter\n",
            "msgs_total {}\n",
            "# HELP bytes_total Total bytes received.\n",
            "# TYPE bytes_total counter\n",
            "bytes_total {}\n",
            "# HELP ws_clients Number of connected WS clients.\n",
            "# TYPE ws_clients gauge\n",
            "ws_clients {}\n",
            "# HELP throughput_msgs_per_sec Average messages per second (last 30s).\n",
            "# TYPE throughput_msgs_per_sec gauge\n",
            "throughput_msgs_per_sec {:.3}\n"
        ),
        total, bytes, clients, throughput
    );
    (StatusCode::OK, [("Content-Type", "text/plain; version=0.0.4")], body).into_response()
}

#[derive(Debug)]
struct AuthError;

fn check_auth(headers: &HeaderMap, query: &Query<std::collections::HashMap<String, String>>, token: &Option<String>) -> Result<(), AuthError> {
    if let Some(expected) = token {
        if let Some(q) = query.0.get("token") {
            if q == expected { return Ok(()); }
        }
        if let Some(hv) = headers.get("authorization") {
            if let Ok(s) = hv.to_str() {
                if let Some(bearer) = s.strip_prefix("Bearer ") {
                    if bearer == expected { return Ok(()); }
                }
            }
        }
        return Err(AuthError);
    }
    Ok(())
}

async fn ws_chatter(
    State(state): State<AppState>,
    headers: HeaderMap,
    query: Query<std::collections::HashMap<String, String>>,
    ws: WebSocketUpgrade,
) -> Response {
    if check_auth(&headers, &query, &state.token).is_err() {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    ws.on_upgrade(move |socket| handle_ws(socket, state))
}

async fn handle_ws(mut socket: WebSocket, state: AppState) {
    state.stats.ws_clients.fetch_add(1, Ordering::Relaxed);
    let status = serde_json::to_string(&StatusDto { kind: "status", connected: true }).unwrap();
    let _ = socket.send(Message::Text(status)).await;

    let mut rx = state.tx.subscribe();

    loop {
        match rx.recv().await {
            Ok(line) => {
                if socket.send(Message::Text(line)).await.is_err() { break; }
            }
            Err(broadcast::error::RecvError::Closed) => break,
            Err(broadcast::error::RecvError::Lagged(_)) => continue,
        }
    }

    state.stats.ws_clients.fetch_sub(1, Ordering::Relaxed);
}

fn start_ros_subscriptions(tx: broadcast::Sender<String>, stats: Arc<Stats>) {
    std::thread::spawn(move || {
        let context = match Context::default_from_env() {
            Ok(c) => c,
            Err(e) => { error!("rclrs context error: {e:?}"); return; }
        };
        let mut executor = context.create_basic_executor();
        let node = match executor.create_node("ros2_ws_bridge") {
            Ok(n) => n,
            Err(e) => { error!("create_node error: {e:?}"); return; }
        };

        // 1) /chatter（沿用原本文字訊息）
        let tx_chatter = tx.clone();
        let stats_chatter = stats.clone();
        let _sub1 = node.create_subscription("chatter", move |msg: example_interfaces::msg::String| {
            let now = now_sec();
            let data = &msg.data;
            stats_chatter.msgs_total.fetch_add(1, Ordering::Relaxed);
            stats_chatter.bytes_total.fetch_add(data.len() as u64, Ordering::Relaxed);
            stats_chatter.sec_acc.fetch_add(1, Ordering::Relaxed);

            // 後段 KPI 仍沿用 /chatter
            let dto = MsgDto {
                kind: "msg",
                topic: "chatter",
                seq: 0,
                ts: now,
                recv_ts: now,
                size_bytes: data.len(),
                data,
            };
            if let Ok(line) = serde_json::to_string(&dto) {
                let _ = tx_chatter.send(line);
            }
        }).expect("sub chatter");

        // 2) /robot_pose（fake robot：String 內包 JSON）
        let tx_robot = tx.clone();
        let _sub2 = node.create_subscription("robot_pose", move |msg: example_interfaces::msg::String| {
            let now = now_sec();
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&msg.data) {
                let seq = v.get("seq").and_then(|x| x.as_u64()).unwrap_or(0);
                let x   = v.get("x").and_then(|x| x.as_f64()).unwrap_or(0.0);
                let y   = v.get("y").and_then(|x| x.as_f64()).unwrap_or(0.0);
                let th  = v.get("theta").and_then(|x| x.as_f64()).unwrap_or(0.0);
                let dto = RobotDto { kind: "robot", seq, x, y, theta: th, ts: now, recv_ts: now };
                if let Ok(line) = serde_json::to_string(&dto) {
                    let _ = tx_robot.send(line);
                }
            }
        }).expect("sub robot_pose");

        executor.spin(rclrs::SpinOptions::default());
    });
}

fn now_sec() -> f64 {
    let dur = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::from_secs(0));
    dur.as_secs() as f64 + (dur.subsec_nanos() as f64) / 1_000_000_000.0
}

async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
    info!("signal received, shutting down");
}
