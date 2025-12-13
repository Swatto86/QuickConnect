//! Host operations - core business logic for host management
//!
//! Handles all host CRUD operations, delegating to CSV reader/writer for persistence.
//!
//! # Why this exists
//! Encapsulates host management business logic separate from the command layer.
//! Commands should call these functions instead of directly manipulating CSV files.
//!
//! # Why separate
//! Separates business logic (upsert, delete, search, timestamp updates) from
//! I/O operations (CSV reading/writing) and command handling. This enables:
//! - Unit testing without Tauri context
//! - Reuse across different interfaces
//! - Clear separation of concerns

use crate::{Host, AppError};
use crate::core::{csv_reader, csv_writer};
use crate::infra::{debug_log, get_hosts_csv_path};
use std::path::Path;

/// Reads all hosts from the CSV file.
///
/// # Why this exists
/// Provides a simple interface for retrieving all hosts. Delegates to csv_reader
/// but adds logging and error handling appropriate for the core layer.
///
/// # Returns
/// * `Ok(Vec<Host>)` - All hosts from CSV (empty vec if file doesn't exist)
/// * `Err(AppError)` - Failed to read or parse CSV
///
/// # Side Effects
/// - Reads hosts.csv from disk
pub fn get_all_hosts() -> Result<Vec<Host>, AppError> {
    debug_log("DEBUG", "HOST_OPERATIONS", "Reading all hosts", None);
    
    let path = get_hosts_csv_path()
        .map_err(|e| AppError::Other {
            message: format!("Failed to get CSV path: {}", e),
            source: None,
        })?;
    
    let hosts = csv_reader::read_hosts_from_csv(&path)?;
    
    debug_log(
        "DEBUG",
        "HOST_OPERATIONS",
        &format!("Successfully loaded {} hosts", hosts.len()),
        None,
    );
    
    Ok(hosts)
}

/// Searches hosts by hostname or description (case-insensitive).
///
/// # Why this exists
/// Provides filtered host retrieval for search functionality. Keeps search
/// logic in the core layer where it can be tested independently.
///
/// # Arguments
/// * `query` - Search term to match against hostname and description
///
/// # Returns
/// * `Ok(Vec<Host>)` - Filtered hosts matching the query
/// * `Err(AppError)` - Failed to read hosts
///
/// # Side Effects
/// - Reads hosts.csv from disk
pub fn search_hosts(query: &str) -> Result<Vec<Host>, AppError> {
    let hosts = get_all_hosts()?;
    let query = query.to_lowercase();

    let filtered: Vec<Host> = hosts
        .into_iter()
        .filter(|host| {
            host.hostname.to_lowercase().contains(&query)
                || host.description.to_lowercase().contains(&query)
        })
        .collect();

    Ok(filtered)
}

/// Saves or updates a host (upsert operation).
///
/// # Why this exists
/// Encapsulates the upsert logic: update if exists, insert if new. This is
/// business logic that belongs in core, not in the command or persistence layers.
///
/// # Arguments
/// * `host` - The host to save or update
///
/// # Returns
/// * `Ok(())` - Host saved successfully
/// * `Err(AppError)` - Validation failed or persistence error
///
/// # Side Effects
/// - Reads hosts.csv
/// - Writes updated hosts.csv
///
/// # Failure Modes
/// - Empty hostname (validation failure)
/// - CSV read/write errors
/// - Disk full
pub fn upsert_host(host: Host) -> Result<(), AppError> {
    debug_log(
        "INFO",
        "HOST_OPERATIONS",
        &format!("Upserting host: {} - {}", host.hostname, host.description),
        None,
    );

    // Validate hostname
    if host.hostname.trim().is_empty() {
        return Err(AppError::InvalidHostname {
            hostname: host.hostname.clone(),
            reason: "Hostname cannot be empty".to_string(),
        });
    }

    // Read existing hosts
    let mut hosts = get_all_hosts()?;

    // Upsert logic: update existing host or add new one
    // Hostname is the unique identifier for deduplication
    if let Some(idx) = hosts.iter().position(|h| h.hostname == host.hostname) {
        debug_log(
            "DEBUG",
            "HOST_OPERATIONS",
            &format!("Updating existing host: {}", host.hostname),
            None,
        );
        hosts[idx] = host;
    } else {
        debug_log(
            "DEBUG",
            "HOST_OPERATIONS",
            &format!("Adding new host: {}", host.hostname),
            None,
        );
        hosts.push(host);
    }

    // Write back to CSV
    let path = get_hosts_csv_path()
        .map_err(|e| AppError::Other {
            message: format!("Failed to get CSV path: {}", e),
            source: None,
        })?;
    
    csv_writer::write_hosts_to_csv(&path, &hosts)?;

    debug_log(
        "INFO",
        "HOST_OPERATIONS",
        "Host upserted successfully",
        None,
    );

    Ok(())
}

/// Deletes a host by hostname.
///
/// # Why this exists
/// Encapsulates deletion logic. Commands should call this instead of directly
/// manipulating CSV files.
///
/// # Arguments
/// * `hostname` - The hostname of the host to delete
///
/// # Returns
/// * `Ok(())` - Host deleted successfully
/// * `Err(AppError)` - Host not found or persistence error
///
/// # Side Effects
/// - Reads hosts.csv
/// - Writes updated hosts.csv
///
/// # Failure Modes
/// - Host doesn't exist (not treated as error, idempotent delete)
/// - CSV read/write errors
pub fn delete_host(hostname: &str) -> Result<(), AppError> {
    debug_log(
        "INFO",
        "HOST_OPERATIONS",
        &format!("Deleting host: {}", hostname),
        None,
    );

    // Read all hosts and filter out the one to delete
    let hosts: Vec<Host> = get_all_hosts()?
        .into_iter()
        .filter(|h| h.hostname != hostname)
        .collect();

    // Write back to CSV
    let path = get_hosts_csv_path()
        .map_err(|e| AppError::Other {
            message: format!("Failed to get CSV path: {}", e),
            source: None,
        })?;
    
    csv_writer::write_hosts_to_csv(&path, &hosts)?;

    debug_log(
        "INFO",
        "HOST_OPERATIONS",
        &format!("Host {} deleted successfully", hostname),
        None,
    );

    Ok(())
}

/// Deletes all hosts.
///
/// # Why this exists
/// Provides a safe way to clear all hosts. Used during application reset.
///
/// # Returns
/// * `Ok(())` - All hosts deleted successfully
/// * `Err(AppError)` - Persistence error
///
/// # Side Effects
/// - Writes empty hosts.csv (with header only)
pub fn delete_all_hosts() -> Result<(), AppError> {
    debug_log(
        "WARN",
        "HOST_OPERATIONS",
        "Deleting all hosts",
        None,
    );

    let path = get_hosts_csv_path()
        .map_err(|e| AppError::Other {
            message: format!("Failed to get CSV path: {}", e),
            source: None,
        })?;
    
    // Write empty CSV (just header)
    csv_writer::write_hosts_to_csv(&path, &[])?;

    debug_log(
        "INFO",
        "HOST_OPERATIONS",
        "All hosts deleted successfully",
        None,
    );

    Ok(())
}

/// Updates the last_connected timestamp for a host.
///
/// # Why this exists
/// Encapsulates the timestamp update logic. Called automatically after
/// successful RDP connections to track usage.
///
/// # Arguments
/// * `hostname` - The hostname to update
///
/// # Returns
/// * `Ok(())` - Timestamp updated successfully
/// * `Err(AppError)` - Host not found or persistence error
///
/// # Side Effects
/// - Reads hosts.csv
/// - Writes updated hosts.csv with new timestamp
///
/// # Failure Modes
/// - Host not found in CSV
/// - CSV read/write errors
pub fn update_last_connected(hostname: &str) -> Result<(), AppError> {
    use chrono::Local;

    // Generate timestamp in UK date format: DD/MM/YYYY HH:MM:SS
    // This format is used consistently across the application
    let timestamp = Local::now().format("%d/%m/%Y %H:%M:%S").to_string();

    debug_log(
        "INFO",
        "HOST_OPERATIONS",
        &format!("Updating last connected for {} to {}", hostname, timestamp),
        None,
    );

    // Read all hosts
    let mut hosts = get_all_hosts()?;

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
        return Err(AppError::HostNotFound {
            hostname: hostname.to_string(),
        });
    }

    // Write back to CSV
    let path = get_hosts_csv_path()
        .map_err(|e| AppError::Other {
            message: format!("Failed to get CSV path: {}", e),
            source: None,
        })?;
    
    csv_writer::write_hosts_to_csv(&path, &hosts)?;

    debug_log(
        "INFO",
        "HOST_OPERATIONS",
        &format!("Successfully updated last connected for {}", hostname),
        None,
    );

    Ok(())
}

/// Migrates hosts.csv from old location (working directory) to new location (AppData).
///
/// # Why this exists
/// Handles data migration for users upgrading from v1.0.0 to v1.1.0+.
/// This was added when the storage location changed from the application
/// directory to the proper AppData location.
///
/// # Why separate
/// Migration logic is infrastructure/deployment concern, but operates on
/// host data, so it lives in the core::hosts module where it has access
/// to the necessary operations.
///
/// # Side Effects
/// - Checks if hosts.csv exists in working directory
/// - Copies to AppData location if not already there
/// - Deletes old file after successful copy
///
/// # Failure Modes
/// - Logs errors but doesn't fail - migration is best-effort
pub fn migrate_hosts_csv_if_needed() {
    let old_path = Path::new("hosts.csv");

    if !old_path.exists() {
        return;
    }

    let new_path = match get_hosts_csv_path() {
        Ok(path) => path,
        Err(e) => {
            debug_log(
                "ERROR",
                "MIGRATION",
                &format!("Failed to get new CSV path: {}", e),
                None,
            );
            return;
        }
    };

    if new_path.exists() {
        debug_log(
            "INFO",
            "MIGRATION",
            "hosts.csv already exists in AppData, skipping migration",
            None,
        );
        return;
    }

    if let Err(e) = std::fs::copy(old_path, &new_path) {
        debug_log(
            "ERROR",
            "MIGRATION",
            &format!("Failed to migrate hosts.csv to AppData: {}", e),
            None,
        );
        return;
    }

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
