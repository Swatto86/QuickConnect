//! Path utilities for QuickConnect application
//!
//! Provides centralized path management for application data directories and files.
//!
//! # Why this exists
//! Centralizes all filesystem path logic in the infrastructure layer, separate from
//! business logic and command handling. This enables easier testing, consistent path
//! handling, and clear separation of concerns.
//!
//! # Why separate
//! Path construction and directory creation are infrastructure concerns, not domain
//! logic. Keeping them in infra/ makes dependencies clear and enables future changes
//! (e.g., supporting custom data directories) without touching core or command layers.

use std::path::PathBuf;

/// Gets the QuickConnect application data directory.
///
/// # Why this exists
/// Provides a single source of truth for the application data directory location.
/// All file operations should use this function to ensure consistency.
///
/// # Returns
/// * `Ok(PathBuf)` - Path to `%APPDATA%\Roaming\QuickConnect`
/// * `Err(String)` - If APPDATA environment variable is not set
///
/// # Side Effects
/// - Creates the QuickConnect directory if it doesn't exist
/// - Creates parent directories as needed
///
/// # Failure Modes
/// - APPDATA environment variable not set (rare on Windows)
/// - Permission denied when creating directory
/// - Disk full
pub fn get_quick_connect_dir() -> Result<PathBuf, String> {
    let appdata_dir =
        std::env::var("APPDATA").map_err(|_| "Failed to get APPDATA directory".to_string())?;
    let quick_connect_dir = PathBuf::from(appdata_dir).join("QuickConnect");
    std::fs::create_dir_all(&quick_connect_dir)
        .map_err(|e| format!("Failed to create QuickConnect directory: {}", e))?;
    Ok(quick_connect_dir)
}

/// Gets the full path to the hosts CSV file.
///
/// # Why this exists
/// Centralizes the hosts CSV file location. All host persistence operations
/// should use this path to ensure consistency.
///
/// # Returns
/// * `Ok(PathBuf)` - Path to `%APPDATA%\Roaming\QuickConnect\hosts.csv`
/// * `Err(String)` - If application directory cannot be accessed
///
/// # Side Effects
/// - Creates the QuickConnect directory if it doesn't exist (via get_quick_connect_dir)
pub fn get_hosts_csv_path() -> Result<PathBuf, String> {
    let quick_connect_dir = get_quick_connect_dir()?;
    Ok(quick_connect_dir.join("hosts.csv"))
}

/// Gets the full path to the recent connections JSON file.
///
/// # Why this exists
/// Centralizes the recent connections file location for consistent access.
///
/// # Returns
/// * `Ok(PathBuf)` - Path to `%APPDATA%\Roaming\QuickConnect\recent_connections.json`
/// * `Err(String)` - If application directory cannot be accessed
///
/// # Side Effects
/// - Creates the QuickConnect directory if it doesn't exist (via get_quick_connect_dir)
pub fn get_recent_connections_path() -> Result<PathBuf, String> {
    let quick_connect_dir = get_quick_connect_dir()?;
    Ok(quick_connect_dir.join("recent_connections.json"))
}

/// Gets the full path to the RDP connections directory.
///
/// # Why this exists
/// Centralizes the RDP files storage location. All RDP file operations
/// should use this path for consistency.
///
/// # Returns
/// * `Ok(PathBuf)` - Path to `%APPDATA%\Roaming\QuickConnect\Connections`
/// * `Err(String)` - If application directory cannot be accessed
///
/// # Side Effects
/// - Creates the QuickConnect directory if it doesn't exist (via get_quick_connect_dir)
/// - Creates the Connections subdirectory if it doesn't exist
#[allow(dead_code)]
pub fn get_connections_dir() -> Result<PathBuf, String> {
    let quick_connect_dir = get_quick_connect_dir()?;
    let connections_dir = quick_connect_dir.join("Connections");
    std::fs::create_dir_all(&connections_dir)
        .map_err(|e| format!("Failed to create Connections directory: {}", e))?;
    Ok(connections_dir)
}
