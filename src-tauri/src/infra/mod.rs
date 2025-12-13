//! Infrastructure module - logging, persistence, configuration

pub mod logging;
pub mod paths;

pub use logging::{debug_log, init_tracing, set_debug_mode};
pub use paths::{get_hosts_csv_path, get_recent_connections_path};
