use std::time::{Duration, SystemTime, UNIX_EPOCH};
use rclrs::{Context, CreateBasicExecutor};
use rclrs::vendor::example_interfaces;

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::from_secs(0))
        .as_millis()
}

fn main() {
    let context = rclrs::Context::default_from_env().expect("context");
    let mut executor = context.create_basic_executor();
    let node = executor.create_node("fake_robot").expect("node");
    let publisher = node.create_publisher::<example_interfaces::msg::String>("robot_pose").expect("pub");

    // 圓弧路徑設定：半徑 5、角速度 0.3 rad/s、中心 (0,0)
    let r = 5.0f64;
    let omega = 0.3f64;

    let start = now_ms();
    let mut seq: u64 = 0;

    loop {
        let t = (now_ms() - start) as f64 / 1000.0;
        let x = r * (omega * t).cos();
        let y = r * (omega * t).sin();
        let theta = (omega * t) % std::f64::consts::TAU;

        let payload = format!(
            r#"{{"seq":{},"x":{:.4},"y":{:.4},"theta":{:.4},"t_ms":{}}}"#,
            seq, x, y, theta, now_ms()
        );

        let mut msg = example_interfaces::msg::String::default();
        msg.data = payload;

        if let Err(e) = publisher.publish(msg) {
            eprintln!("publish error: {e:?}");
        }

        seq = seq.wrapping_add(1);
        std::thread::sleep(Duration::from_millis(100)); // 10 Hz
    }
}
