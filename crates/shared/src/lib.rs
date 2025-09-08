use serde::{Serialize, Deserialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, TS, Debug, Clone)]
#[ts(export)]
pub struct CpuTemp {
    pub temp: f32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn export_compiles() {
        CpuTemp { temp: 0.0 };
    }
}
