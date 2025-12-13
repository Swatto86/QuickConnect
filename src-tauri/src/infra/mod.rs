//! Infrastructure module - logging, persistence, configuration

pub mod logging;

pub use logging::{debug_log, init_tracing, set_debug_mode};
