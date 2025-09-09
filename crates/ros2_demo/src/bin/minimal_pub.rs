use rclrs::{Context, CreateBasicExecutor};
use rclrs::vendor::example_interfaces;
use std::{thread, time::Duration};

fn main() -> Result<(), rclrs::RclrsError> {
    // rclrs 0.5：從環境建立 Context，建立 basic executor，再由 executor 建立節點
    let context = Context::default_from_env()?;
    let executor = context.create_basic_executor();
    let node = executor.create_node("minimal_pub")?;

    // 使用 vendored 的 example_interfaces::msg::String
    let publisher = node.create_publisher::<example_interfaces::msg::String>("chatter")?;

    for i in 0..30 {
        let msg = example_interfaces::msg::String {
            data: format!("hello from rclrs {i}"),
        };
        publisher.publish(&msg)?;
        println!("published {i}");
        thread::sleep(Duration::from_millis(100));
    }

    Ok(())
}
