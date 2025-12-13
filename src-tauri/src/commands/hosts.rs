//! Host management commands
//!
//! Thin command wrappers for host CRUD operations and host status checking.
//! All commands delegate to core logic and use proper error handling.

use crate::core::types::Host;
use crate::infra::logging::debug_log;
use std::path::PathBuf;
use tauri::{Emitter, Manager};

/// Gets the QuickConnect application data directory.
///
/// Returns the path `%APPDATA%\Roaming\QuickConnect` and creates it if it doesn't exist.
/// Public to allow other modules to access app data directory.
pub fn get_quick_connect_dir() -> Result<PathBuf, String> {
    let appdata_dir =
        std::env::var("APPDATA").map_err(|_| "Failed to get APPDATA directory".to_string())?;
    let quick_connect_dir = PathBuf::from(appdata_dir).join("QuickConnect");
    std::fs::create_dir_all(&quick_connect_dir)
        .map_err(|e| format!("Failed to create QuickConnect directory: {}", e))?;
    Ok(quick_connect_dir)
}

/// Gets the full path to the hosts CSV file.
/// Public to allow CSV export/import and migration functions to access it.
pub fn get_hosts_csv_path() -> Result<PathBuf, String> {
    let quick_connect_dir = get_quick_connect_dir()?;
    Ok(quick_connect_dir.join("hosts.csv"))
}

/// Migrates hosts.csv from old location (working directory) to new location (AppData).
///
/// This function was added in version 1.1.0 to move the hosts file from the application
/// directory to the proper AppData location. It automatically runs once on startup.
pub fn migrate_hosts_csv_if_needed() {
    let old_path = std::path::Path::new("hosts.csv");

    if old_path.exists() {
        if let Ok(new_path) = get_hosts_csv_path() {
            if !new_path.exists() {
                if let Err(e) = std::fs::copy(old_path, &new_path) {
                    debug_log(
                        "ERROR",
                        "MIGRATION",
                        &format!("Failed to migrate hosts.csv to AppData: {}", e),
                        None,
                    );
                } else {
                    debug_log(
                        "INFO",
                        "MIGRATION",
                        &format!("Successfully migrated hosts.csv to {}", new_path.display()),
                        None,
                    );

                    if let Err(e) = std::fs::remove_file(old_path) {
                        debug_log(
                            "WARN",
                            "MIGRATION",
                            &format!("Failed to delete old hosts.csv: {}", e),
                            None,
                        );
                    }
                }
            } else {
                debug_log(
                    "INFO",
                    "MIGRATION",
                    "hosts.csv already exists in AppData, skipping migration",
                    None,
                );
            }
        }
    }
}

/// Reads hosts from the CSV file.
///
/// Returns an empty vector if the file doesn't exist.
#[tauri::command]
pub fn get_hosts() -> Result<Vec<Host>, String> {
    debug_log("DEBUG", "CSV_OPERATIONS", "Reading hosts from CSV", None);
    let path = get_hosts_csv_path()?;
    if !path.exists() {
        debug_log(
            "INFO",
            "CSV_OPERATIONS",
            "hosts.csv does not exist, returning empty list",
            None,
        );
        return Ok(Vec::new());
    }

    let contents =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read CSV: {}", e))?;

    let mut hosts = Vec::new();
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .from_reader(contents.as_bytes());

    // Parse each CSV record into a Host struct
    // CSV format: hostname, description, last_connected (optional, added in v1.2.0)
    for result in reader.records() {
        match result {
            Ok(record) => {
                // Minimum 2 columns required (hostname, description)
                if record.len() >= 2 {
                    // last_connected column is optional for backwards compatibility
                    // with v1.1.0 CSV files that didn't have this column
                    let last_connected = if record.len() >= 3 && !record[2].is_empty() {
                        Some(record[2].to_string())
                    } else {
                        None
                    };
                    hosts.push(Host {
                        hostname: record[0].to_string(),
                        description: record[1].to_string(),
                        last_connected,
                    });
                }
            }
            Err(e) => return Err(format!("Failed to parse CSV record: {}", e)),
        }
    }

    debug_log(
        "DEBUG",
        "CSV_OPERATIONS",
        &format!("Successfully loaded {} hosts from CSV", hosts.len()),
        None,
    );
    Ok(hosts)
}

/// Alias for get_hosts() for backwards compatibility.
#[tauri::command]
pub async fn get_all_hosts() -> Result<Vec<Host>, String> {
    get_hosts()
}

/// Searches hosts by hostname or description.
#[tauri::command]
pub async fn search_hosts(query: String) -> Result<Vec<Host>, String> {
    let hosts = get_hosts()?;
    let query = query.to_lowercase();

    let filtered_hosts: Vec<Host> = hosts
        .into_iter()
        .filter(|host| {
            host.hostname.to_lowercase().contains(&query)
                || host.description.to_lowercase().contains(&query)
        })
        .collect();

    Ok(filtered_hosts)
}

/// Saves or updates a host in the CSV file.
///
/// Emits "hosts-updated" event to all windows after successful save.
#[tauri::command]
pub fn save_host(app_handle: tauri::AppHandle, host: Host) -> Result<(), String> {
    debug_log(
        "INFO",
        "CSV_OPERATIONS",
        &format!("Saving host: {} - {}", host.hostname, host.description),
        None,
    );

    // Create hosts.csv if it doesn't exist
    let csv_path = get_hosts_csv_path()?;
    if !csv_path.exists() {
        let mut wtr = csv::WriterBuilder::new()
            .from_path(&csv_path)
            .map_err(|e| format!("Failed to create hosts.csv: {}", e))?;

        wtr.write_record(["hostname", "description"])
            .map_err(|e| format!("Failed to write CSV header: {}", e))?;

        wtr.flush()
            .map_err(|e| format!("Failed to flush CSV writer: {}", e))?;
    }

    let mut hosts = get_hosts()?;

    // Check if hostname is empty or invalid
    if host.hostname.trim().is_empty() {
        return Err("Hostname cannot be empty".to_string());
    }

    // Upsert logic: update existing host or add new one
    // Hostname is the unique identifier for deduplication
    if let Some(idx) = hosts.iter().position(|h| h.hostname == host.hostname) {
        // Update existing host (preserves last_connected if not changed)
        hosts[idx] = host;
    } else {
        // Add new host to the end of the list
        hosts.push(host);
    }

    let csv_path = get_hosts_csv_path()?;
    let mut wtr = csv::WriterBuilder::new()
        .from_path(&csv_path)
        .map_err(|e| format!("Failed to create CSV writer: {}", e))?;

    // Write header
    wtr.write_record(["hostname", "description", "last_connected"])
        .map_err(|e| format!("Failed to write CSV header: {}", e))?;

    // Write records
    for host in hosts {
        debug_log(
            "DEBUG",
            "CSV_OPERATIONS",
            &format!(
                "Writing host to CSV: {} - {}",
                host.hostname, host.description
            ),
            None,
        );
        wtr.write_record([
            &host.hostname,
            &host.description,
            &host.last_connected.unwrap_or_default(),
        ])
        .map_err(|e| format!("Failed to write CSV record: {}", e))?;
    }

    wtr.flush()
        .map_err(|e| format!("Failed to flush CSV writer: {}", e))?;

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
/// Emits "hosts-updated" event to all windows after successful deletion.
#[tauri::command]
pub fn delete_host(app_handle: tauri::AppHandle, hostname: String) -> Result<(), String> {
    debug_log(
        "INFO",
        "CSV_OPERATIONS",
        &format!("Deleting host: {}", hostname),
        None,
    );

    let hosts: Vec<Host> = get_hosts()?
        .into_iter()
        .filter(|h| h.hostname != hostname)
        .collect();

    let csv_path = get_hosts_csv_path()?;
    let mut wtr = csv::WriterBuilder::new()
        .from_path(&csv_path)
        .map_err(|e| format!("Failed to create CSV writer: {}", e))?;

    // Write header
    wtr.write_record(["hostname", "description", "last_connected"])
        .map_err(|e| format!("Failed to write CSV header: {}", e))?;

    // Write records
    for host in hosts {
        wtr.write_record([
            &host.hostname,
            &host.description,
            &host.last_connected.unwrap_or_default(),
        ])
        .map_err(|e| format!("Failed to write CSV record: {}", e))?;
    }

    wtr.flush()
        .map_err(|e| format!("Failed to flush CSV writer: {}", e))?;

    // Emit event to notify all windows that hosts list has been updated
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
/// Emits "hosts-updated" event to all windows after successful deletion.
#[tauri::command]
pub async fn delete_all_hosts(app_handle: tauri::AppHandle) -> Result<(), String> {
    // Create empty file to clear all contents
    let csv_path = get_hosts_csv_path()?;
    std::fs::write(&csv_path, "hostname,description\n")
        .map_err(|e| format!("Failed to clear hosts file: {}", e))?;

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
/// This is called automatically when launching an RDP connection.
pub fn update_last_connected(hostname: &str) -> Result<(), String> {
    use chrono::Local;

    // Generate timestamp in UK date format: DD/MM/YYYY HH:MM:SS
    // This format is used consistently across the application
    let timestamp = Local::now().format("%d/%m/%Y %H:%M:%S").to_string();

    debug_log(
        "INFO",
        "TIMESTAMP_UPDATE",
        &format!("Updating last connected for {} to {}", hostname, timestamp),
        None,
    );

    // Read all hosts
    let mut hosts = get_hosts()?;

    // Find and update the host
    let mut found = false;
    for host in &mut hosts {
        if host.hostname == hostname {
            host.last_connected = Some(timestamp.clone());
            found = true;
            break;
        }
    }

    if !found {
        return Err(format!("Host {} not found in hosts list", hostname));
    }

    // Write back to CSV
    let csv_path = get_hosts_csv_path()?;
    let mut wtr = csv::WriterBuilder::new()
        .from_path(&csv_path)
        .map_err(|e| format!("Failed to create CSV writer: {}", e))?;

    wtr.write_record(["hostname", "description", "last_connected"])
        .map_err(|e| format!("Failed to write CSV header: {}", e))?;

    for host in hosts {
        wtr.write_record([
            &host.hostname,
            &host.description,
            &host.last_connected.unwrap_or_default(),
        ])
        .map_err(|e| format!("Failed to write CSV record: {}", e))?;
    }

    wtr.flush()
        .map_err(|e| format!("Failed to flush CSV writer: {}", e))?;

    debug_log(
        "INFO",
        "TIMESTAMP_UPDATE",
        &format!("Successfully updated last connected for {}", hostname),
        None,
    );

    Ok(())
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
