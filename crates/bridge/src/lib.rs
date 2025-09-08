use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Message<T> {
    pub topic: String,
    pub payload: T,
}

#[cfg(not(feature = "wasm"))]
pub async fn start() -> Result<(), Box<dyn std::error::Error>> {
    // placeholder native implementation
    Ok(())
}

#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn start() {
    // placeholder wasm implementation
}

#[cfg(all(test, not(feature = "wasm")))]
mod tests {
    use super::*;

    #[tokio::test]
    async fn start_runs() {
        start().await.unwrap();
    }
}
