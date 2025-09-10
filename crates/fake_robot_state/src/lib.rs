use rand::Rng;
use shared::CpuTemp;

pub fn gen_cpu_temp() -> CpuTemp {
    let mut rng = rand::thread_rng();
    CpuTemp {
        temp: rng.gen_range(30.0..80.0),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gen_range() {
        let t = gen_cpu_temp();
        assert!((30.0..80.0).contains(&t.temp));
    }
}
