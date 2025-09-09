use rclrs::{Context, CreateBasicExecutor, SpinOptions};
use rclrs::vendor::example_interfaces;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};

fn main() -> Result<(), rclrs::RclrsError> {
    let context = Context::default_from_env()?;
    let mut executor = context.create_basic_executor();
    let node = executor.create_node("minimal_sub")?;

    // 收到 10 則就結束
    let count = Arc::new(AtomicUsize::new(0));
    let count_cb = Arc::clone(&count);

    let _sub = node.create_subscription(
        "chatter",
        move |msg: example_interfaces::msg::String| {
            println!("{}", msg.data);
            let n = count_cb.fetch_add(1, Ordering::Relaxed) + 1;
            if n >= 10 {
                // 收到足夠訊息，乾淨結束流程
                std::process::exit(0);
            }
        },
    )?;

    // 進入 spin；callback 觸發到 10 次會 exit(0)
    executor.spin(SpinOptions::default());

    Ok(())
}
