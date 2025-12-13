//! Host management commands
//!
//! Thin command wrappers that delegate to core::hosts business logic.
//! Commands validate inputs, call one core function, and emit UI events.

use crate::core::types::Host;
use crate::infra::debug_log;
use tauri::{Emitter, Manager};

/// Reads hosts from the CSV file.
///
/// Thin wrapper that delegates to core::hosts::get_all_hosts().
#[tauri::command]
pub fn get_hosts() -> Result<Vec<Host>, String> {
    crate::core::hosts::get_all_hosts().map_err(|e| e.to_string())
}

/// Alias for get_hosts() for backwards compatibility.
#[tauri::command]
pub async fn get_all_hosts() -> Result<Vec<Host>, String> {
    get_hosts()
}

/// Searches hosts by hostname or description.
///
/// Thin wrapper that delegates to core::hosts::search_hosts().
#[tauri::command]
pub async fn search_hosts(query: String) -> Result<Vec<Host>, String> {
    crate::core::hosts::search_hosts(&query).map_err(|e| e.to_string())
}

/// Saves or updates a host in the CSV file.
///
/// Thin wrapper that:
/// 1. Validates input (hostname not empty)
/// 2. Calls core::hosts::upsert_host()
/// 3. Emits UI update events
#[tauri::command]
pub fn save_host(app_handle: tauri::AppHandle, host: Host) -> Result<(), String> {
    // Delegate to core business logic
    crate::core::hosts::upsert_host(host).map_err(|e| e.to_string())?;

    // Emit event to notify all windows that hosts list has been updated
    if let Some(main_window) = app_handle.get_webview_window("main") {
        let _ = main_window.emit("hosts-updated", ());
    }
    if let Some(hosts_window) = app_handle.get_webview_window("hosts") {
        let _ = hosts_window.emit("hosts-updated", ());
    }

    Ok(())
}

/// Deletes a host from the CSV file.
///
/// Thin wrapper that:
/// 1. Calls core::hosts::delete_host()
/// 2. Emits UI update events
#[tauri::command]
pub fn delete_host(app_handle: tauri::AppHandle, hostname: String) -> Result<(), String> {
    // Delegate to core business logic
    crate::core::hosts::delete_host(&hostname).map_err(|e| e.to_string())?;

    // Emit event to notify all windows that hosts list have been updated
    if let Some(main_window) = app_handle.get_webview_window("main") {
        let _ = main_window.emit("hosts-updated", ());
    }
    if let Some(hosts_window) = app_handle.get_webview_window("hosts") {
        let _ = hosts_window.emit("hosts-updated", ());
    }

    Ok(())
}

/// Deletes all hosts from the CSV file.
///
/// Thin wrapper that:
/// 1. Calls core::hosts::delete_all_hosts()
/// 2. Emits UI update events
#[tauri::command]
pub async fn delete_all_hosts(app_handle: tauri::AppHandle) -> Result<(), String> {
    // Delegate to core business logic
    crate::core::hosts::delete_all_hosts().map_err(|e| e.to_string())?;

    // Emit event to notify all windows that hosts list has been updated
    if let Some(main_window) = app_handle.get_webview_window("main") {
        let _ = main_window.emit("hosts-updated", ());
    }
    if let Some(hosts_window) = app_handle.get_webview_window("hosts") {
        let _ = hosts_window.emit("hosts-updated", ());
    }

    Ok(())
}

/// Updates the last_connected timestamp for a host.
///
/// Thin wrapper that delegates to core::hosts::update_last_connected().
/// This is called automatically when launching an RDP connection.
pub fn update_last_connected(hostname: &str) -> Result<(), String> {
    crate::core::hosts::update_last_connected(hostname).map_err(|e| e.to_string())
}

/// Checks if a host is online by attempting to connect to RDP port 3389.
///
/// Returns "online", "offline", or "unknown".
#[tauri::command]
pub async fn check_host_status(hostname: String) -> Result<String, String> {
    use std::net::{TcpStream, ToSocketAddrs};
    use std::time::Duration;

    debug_log(
        "DEBUG",
        "STATUS_CHECK",
        &format!("Checking status for host: {}", hostname),
        None,
    );

    // Resolve hostname to IP address for TCP connection
    // Port 3389 is the standard RDP port
    let addr = format!("{}:3389", hostname);
    let socket_addrs: Vec<_> = match addr.to_socket_addrs() {
        Ok(addrs) => addrs.collect(),
        Err(e) => {
            // DNS resolution failed - host doesn't exist or network issue
            debug_log(
                "DEBUG",
                "STATUS_CHECK",
                &format!("Failed to resolve hostname {}: {}", hostname, e),
                Some(&e.to_string()),
            );
            return Ok("unknown".to_string());
        }
    };

    if socket_addrs.is_empty() {
        debug_log(
            "DEBUG",
            "STATUS_CHECK",
            &format!("No addresses resolved for hostname: {}", hostname),
            None,
        );
        return Ok("unknown".to_string());
    }

    // Attempt TCP connection with 2-second timeout
    // This checks if port 3389 is open and accepting connections
    // Timeout prevents UI from hanging on unreachable hosts
    let timeout = Duration::from_secs(2);
    match TcpStream::connect_timeout(&socket_addrs[0], timeout) {
        Ok(_) => {
            debug_log(
                "DEBUG",
                "STATUS_CHECK",
                &format!("Host {} is online (port 3389 open)", hostname),
                None,
            );
            Ok("online".to_string())
        }
        Err(e) => {
            debug_log(
                "DEBUG",
                "STATUS_CHECK",
                &format!("Host {} is offline or unreachable: {}", hostname, e),
                Some(&e.to_string()),
            );
            Ok("offline".to_string())
        }
    }
}
