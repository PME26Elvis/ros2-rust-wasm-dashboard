use rclrs::{Context, CreateBasicExecutor};

fn now_ms() -> u128 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis()
}

fn main() {
    let context = Context::default_from_env().expect("ctx");
    let executor = context.create_basic_executor();
    let node = executor.create_node("demo_pub").expect("node");
    let publisher = node
        .create_publisher::<rclrs::vendor::example_interfaces::msg::String>("chatter")
        .expect("pub");

    for i in 0..30 {
        let stamp = now_ms();
        let payload = format!("{}|{}", i, stamp);
        let mut msg = rclrs::vendor::example_interfaces::msg::String::default();
        msg.data = format!("hello from rclrs {}", i); // 終端可讀
        // 真正傳輸的仍是 data；為了不破壞 bridge，我們把原字串尾端附上 " |<seq>|<ms>"
        msg.data = format!("{} |{}|{}", msg.data, i, stamp);
        publisher.publish(msg).ok();
        println!("published {}", i);
        std::thread::sleep(std::time::Duration::from_millis(1000));
    }
}
